import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import {
  lchown,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import { isIP } from "node:net";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { FileEntry } from "@bytepanel/protocol";

export class FilesystemError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const MAX_EDITOR_BYTES = 4 * 1024 * 1024;
const MAX_PULL_BYTES = 2 * 1024 * 1024 * 1024;

const isPrivateAddress = (address: string): boolean => {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) {
      return isPrivateAddress(lower.slice(7));
    }
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80")
    );
  }
  const [a = 0, b = 0] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

type Owner = { uid: number; gid: number };

const run = async (
  cmd: string[],
  cwd: string,
  options: { as?: Owner | null; stdin?: ReturnType<typeof Bun.file> } = {},
): Promise<void> => {
  const full = options.as
    ? ["setpriv", `--reuid=${options.as.uid}`, `--regid=${options.as.gid}`, "--clear-groups", ...cmd]
    : cmd;
  const proc = Bun.spawn({
    cmd: full,
    cwd,
    stderr: "pipe",
    stdin: options.stdin ?? "ignore",
    stdout: "ignore",
  });
  const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) {
    throw new FilesystemError(`${cmd[0]} failed: ${err.trim().slice(0, 300)}`, 500);
  }
};

const capture = async (cmd: string[]): Promise<string> => {
  const proc = Bun.spawn({ cmd, stderr: "ignore", stdout: "pipe" });
  const [code, out] = await Promise.all([proc.exited, new Response(proc.stdout).text()]);
  if (code !== 0) {
    throw new FilesystemError("could not read the archive");
  }
  return out;
};

export const parseTarListing = (listing: string): number =>
  listing.split("\n").reduce((total, line) => {
    const size = Number(line.trim().split(/\s+/u)[2]);
    return Number.isFinite(size) ? total + size : total;
  }, 0);

export const parseZipSummary = (summary: string): number => {
  const match = /([\d,]+) bytes uncompressed/u.exec(summary);
  if (!match?.[1]) {
    throw new FilesystemError("could not read the archive");
  }
  return Number(match[1].replaceAll(",", ""));
};

export class Filesystem {
  private cachedUsage = 0;
  private usageCheckedAt = 0;

  constructor(
    readonly root: string,
    private readonly owner: () => Owner | null,
    private readonly diskLimitBytes: () => number,
    private readonly isIdle: () => boolean = () => true,
  ) {}

  async safePath(userPath: string): Promise<string> {
    const cleaned = normalize(`/${userPath}`).replace(/^[/\\]+/u, "");
    const target = resolve(this.root, cleaned);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new FilesystemError("path escapes server root");
    }
    const rootReal = await realpath(this.root).catch(() => null);
    if (!rootReal) {
      return target;
    }
    let current = this.root;
    for (const part of relative(this.root, target).split(sep).filter(Boolean)) {
      current = join(current, part);
      const info = await lstat(current).catch(() => null);
      if (!info) {
        return target;
      }
      if (info.isSymbolicLink()) {
        const real = await realpath(current).catch(() => null);
        if (!real || (real !== rootReal && !real.startsWith(rootReal + sep))) {
          throw new FilesystemError("path escapes server root");
        }
      }
    }
    return target;
  }

  async safeEntryPath(userPath: string): Promise<string> {
    const cleaned = normalize(`/${userPath}`);
    return join(await this.safePath(dirname(cleaned)), basename(cleaned));
  }

  private tempPath(abs: string): string {
    return join(dirname(abs), `.${randomUUID()}.bytepanel-part`);
  }

  async fixOwnership(path: string): Promise<void> {
    const owner = this.owner();
    if (!owner) {
      return;
    }
    try {
      await lchown(path, owner.uid, owner.gid);
    } catch {
    }
  }

  async chownRecursive(): Promise<void> {
    const owner = this.owner();
    if (!owner) {
      return;
    }
    await run(["chown", "-hR", `${owner.uid}:${owner.gid}`, this.root], this.root).catch(
      () => undefined,
    );
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await this.fixOwnership(this.root);
  }

  async diskUsage(force = false): Promise<number> {
    if (!force && Date.now() - this.usageCheckedAt < 60_000) {
      return this.cachedUsage;
    }
    try {
      const proc = Bun.spawn({ cmd: ["du", "-sb", this.root], stderr: "ignore", stdout: "pipe" });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      this.cachedUsage = Number.parseInt(out.split(/\s/u)[0] ?? "0", 10) || 0;
    } catch {
    }
    this.usageCheckedAt = Date.now();
    return this.cachedUsage;
  }

  noteWritten(bytes: number): void {
    this.cachedUsage += bytes;
  }

  invalidateUsage(): void {
    this.usageCheckedAt = 0;
  }

  async hasSpaceFor(bytes: number): Promise<boolean> {
    const limit = this.diskLimitBytes();
    if (limit <= 0) {
      return true;
    }
    return (await this.diskUsage()) + bytes <= limit;
  }

  async list(dir: string): Promise<{ path: string; entries: FileEntry[] }> {
    const abs = await this.safePath(dir);
    let dirents;
    try {
      dirents = await readdir(abs, { withFileTypes: true });
    } catch {
      throw new FilesystemError("directory not found", 404);
    }
    const entries: FileEntry[] = [];
    for (const dirent of dirents) {
      try {
        const info = await lstat(join(abs, dirent.name));
        entries.push({
          mime: dirent.isFile() ? Bun.file(join(abs, dirent.name)).type : undefined,
          mode: (info.mode & 0o777).toString(8).padStart(3, "0"),
          mtime: info.mtime.toISOString(),
          name: dirent.name,
          size: info.isFile() ? info.size : 0,
          type: info.isSymbolicLink() ? "symlink" : info.isDirectory() ? "dir" : "file",
        });
      } catch {
      }
    }
    entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1,
    );
    return { entries, path: `/${relative(this.root, abs).split(sep).join("/")}` };
  }

  async readForEditor(path: string): Promise<Blob> {
    const abs = await this.safePath(path);
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) {
      throw new FilesystemError("file not found", 404);
    }
    if (info.size > MAX_EDITOR_BYTES) {
      throw new FilesystemError("file is too large to open in the editor", 413);
    }
    return Bun.file(abs);
  }

  async fileForDownload(path: string): Promise<{ file: Blob; name: string }> {
    const abs = await this.safePath(path);
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) {
      throw new FilesystemError("file not found", 404);
    }
    return { file: Bun.file(abs), name: basename(abs) };
  }

  async write(path: string, data: Blob | ArrayBuffer | string): Promise<void> {
    const abs = await this.safePath(path);
    if (abs === this.root) {
      throw new FilesystemError("cannot write to the server root");
    }
    const size =
      typeof data === "string"
        ? Buffer.byteLength(data)
        : data instanceof Blob
          ? data.size
          : data.byteLength;
    const existing = await stat(abs).catch(() => null);
    if (!(await this.hasSpaceFor(size - (existing?.size ?? 0)))) {
      throw new FilesystemError("not enough disk space", 507);
    }
    await this.mkdirp(dirname(abs));
    const temp = this.tempPath(abs);
    const bytes =
      typeof data === "string"
        ? Buffer.from(data)
        : Buffer.from(data instanceof Blob ? await data.arrayBuffer() : data);
    const handle = await open(temp, "wx", 0o644);
    try {
      await handle.writeFile(bytes);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    } finally {
      await handle.close();
    }
    await rename(temp, abs);
    await this.fixOwnership(abs);
    this.usageCheckedAt = 0;
  }

  private async mkdirp(abs: string): Promise<void> {
    await mkdir(abs, { recursive: true });
    let current = abs;
    while (current.startsWith(this.root) && current !== this.root) {
      await this.fixOwnership(current);
      current = dirname(current);
    }
  }

  async createDirectory(parent: string, name: string): Promise<void> {
    const abs = await this.safePath(join(parent, name));
    await this.mkdirp(abs);
  }

  async rename(root: string, files: { from: string; to: string }[]): Promise<void> {
    for (const file of files) {
      const from = await this.safePath(join(root, file.from));
      const to = await this.safePath(join(root, file.to));
      if (from === this.root || to === this.root) {
        throw new FilesystemError("cannot rename the server root");
      }
      if (await stat(to).catch(() => null)) {
        throw new FilesystemError(`${file.to} already exists`, 409);
      }
      await this.mkdirp(dirname(to));
      await rename(from, to);
    }
  }

  async delete(root: string, files: string[]): Promise<void> {
    for (const file of files) {
      const abs = await this.safeEntryPath(join(root, file));
      if (abs === this.root) {
        throw new FilesystemError("cannot delete the server root");
      }
      await rm(abs, { force: true, recursive: true });
    }
    this.usageCheckedAt = 0;
  }

  async compress(root: string, files: string[]): Promise<string> {
    const base = await this.safePath(root);
    const names: string[] = [];
    for (const file of files) {
      const abs = await this.safePath(join(root, file));
      names.push(relative(base, abs));
    }
    const archiveName = `archive-${new Date().toISOString().replace(/[:.]/gu, "-")}.tar.gz`;
    const temp = this.tempPath(join(base, archiveName));
    try {
      await run(["tar", "-czf", temp, "--", ...names], base);
      await rename(temp, join(base, archiveName));
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
    await this.fixOwnership(join(base, archiveName));
    this.usageCheckedAt = 0;
    return archiveName;
  }

  async decompress(root: string, file: string): Promise<void> {
    const base = await this.safePath(root);
    const archive = await this.safePath(join(root, file));
    const info = await stat(archive).catch(() => null);
    if (!info?.isFile()) {
      throw new FilesystemError("archive not found", 404);
    }
    const zip = archive.endsWith(".zip");
    const expanded = zip
      ? parseZipSummary(await capture(["unzip", "-Zt", archive]))
      : parseTarListing(await capture(["tar", "-tvf", archive]));
    await this.diskUsage(true);
    if (!(await this.hasSpaceFor(expanded))) {
      throw new FilesystemError("not enough disk space", 507);
    }
    const as = await this.extractionUser(base);
    if (zip) {
      await run(["unzip", "-o", "-q", archive, "-d", base], base, { as });
    } else {
      await run(["tar", "--no-same-owner", "-xf", archive, "-C", base], base, { as });
    }
    await this.removeEscapingLinks(base);
    await this.chownRecursive();
    this.usageCheckedAt = 0;
  }

  async restoreArchive(archive: string): Promise<void> {
    await this.ensureRoot();
    const as = await this.extractionUser(this.root);
    await run(["tar", "--no-same-owner", "-xzf", "-", "-C", this.root], this.root, {
      as,
      stdin: Bun.file(archive),
    });
    await this.removeEscapingLinks(this.root);
    await this.chownRecursive();
    this.usageCheckedAt = 0;
  }

  private async extractionUser(base: string): Promise<Owner | null> {
    if (process.getuid?.() !== 0) {
      return null;
    }
    const owner = this.owner();
    if (owner && owner.uid !== 0) {
      return owner;
    }
    const info = await lstat(base);
    if (info.uid !== 0) {
      return { gid: info.gid, uid: info.uid };
    }
    if (!this.isIdle()) {
      throw new FilesystemError("stop the server before extracting this archive", 409);
    }
    await this.removeEscapingLinks(this.root);
    return null;
  }

  private async removeEscapingLinks(dir: string): Promise<void> {
    const rootReal = await realpath(this.root);
    for (const dirent of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, dirent.name);
      if (dirent.isSymbolicLink()) {
        const target = await realpath(abs).catch(() => null);
        if (!target || (target !== rootReal && !target.startsWith(rootReal + sep))) {
          await unlink(abs);
        }
      } else if (dirent.isDirectory()) {
        await this.removeEscapingLinks(abs);
      }
    }
  }

  async pull(input: {
    url: string;
    directory: string;
    filename?: string;
    sha256?: string;
  }): Promise<{ path: string; bytes: number; sha256: string }> {
    let url = new URL(input.url);
    let res: Response | null = null;
    for (let hop = 0; hop < 5; hop += 1) {
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new FilesystemError("only http(s) URLs are allowed");
      }
      const { address } = await lookup(url.hostname);
      if (isPrivateAddress(address)) {
        throw new FilesystemError("URL resolves to a private address");
      }
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30 * 60_000) });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url);
        res = null;
        continue;
      }
      break;
    }
    if (!res?.ok || !res.body) {
      throw new FilesystemError(res ? `download failed with HTTP ${res.status}` : "too many redirects");
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_PULL_BYTES || !(await this.hasSpaceFor(declared))) {
      throw new FilesystemError("file too large", 507);
    }
    const name =
      input.filename ?? (basename(decodeURIComponent(url.pathname)) || "download");
    const abs = await this.safePath(join(input.directory, name));
    await this.mkdirp(dirname(abs));
    const temp = this.tempPath(abs);
    const limit = this.diskLimitBytes();
    const available =
      limit > 0 ? Math.max(0, limit - (await this.diskUsage(true))) : Number.POSITIVE_INFINITY;
    const hash = createHash("sha256");
    let bytes = 0;
    const source = Readable.fromWeb(res.body as unknown as NodeReadableStream);
    source.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      hash.update(chunk);
      if (bytes > MAX_PULL_BYTES || bytes > available) {
        source.destroy(new FilesystemError("file too large", 507));
      }
    });
    try {
      await pipeline(source, createWriteStream(temp, { flags: "wx", mode: 0o644 }));
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
    const digest = hash.digest("hex");
    if (input.sha256 && input.sha256.toLowerCase() !== digest) {
      await unlink(temp);
      throw new FilesystemError("sha256 mismatch");
    }
    await rename(temp, abs);
    await this.fixOwnership(abs);
    this.usageCheckedAt = 0;
    return { bytes, path: `/${relative(this.root, abs).split(sep).join("/")}`, sha256: digest };
  }
}
