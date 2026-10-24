import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import {
  chown,
  lstat,
  mkdir,
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

import type { FileEntry } from "../../../protocol";

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

// Rejects loopback, link-local, private and CGNAT ranges so "pull from URL"
// can't be used to reach the node's internal network or metadata services.
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

const run = async (cmd: string[], cwd: string): Promise<void> => {
  const proc = Bun.spawn({ cmd, cwd, stderr: "pipe", stdout: "ignore" });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new FilesystemError(`${cmd[0]} failed: ${err.trim().slice(0, 300)}`, 500);
  }
};

export class Filesystem {
  private cachedUsage = 0;
  private usageCheckedAt = 0;

  constructor(
    readonly root: string,
    private readonly owner: () => { uid: number; gid: number } | null,
    private readonly diskLimitBytes: () => number,
  ) {}

  // Resolves a user path inside the root, following symlinks on the deepest
  // existing ancestor so a link can't point outside the volume.
  async safePath(userPath: string): Promise<string> {
    const cleaned = normalize(`/${userPath}`).replace(/^[/\\]+/u, "");
    const target = resolve(this.root, cleaned);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new FilesystemError("path escapes server root");
    }
    let probe = target;
    let suffix = "";
    while (true) {
      try {
        const real = await realpath(probe);
        const resolved = suffix ? join(real, suffix) : real;
        const rootReal = await realpath(this.root);
        if (resolved !== rootReal && !resolved.startsWith(rootReal + sep)) {
          throw new FilesystemError("path escapes server root");
        }
        return target;
      } catch (error) {
        if (error instanceof FilesystemError) {
          throw error;
        }
        if (probe === this.root) {
          return target;
        }
        suffix = suffix ? join(basename(probe), suffix) : basename(probe);
        probe = dirname(probe);
      }
    }
  }

  private async fixOwnership(path: string): Promise<void> {
    const owner = this.owner();
    if (!owner) {
      return;
    }
    try {
      await chown(path, owner.uid, owner.gid);
    } catch {
      // best effort (e.g. running unprivileged in development)
    }
  }

  async chownRecursive(): Promise<void> {
    const owner = this.owner();
    if (!owner) {
      return;
    }
    await run(["chown", "-R", `${owner.uid}:${owner.gid}`, this.root], this.root).catch(
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
      // keep the previous value
    }
    this.usageCheckedAt = Date.now();
    return this.cachedUsage;
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
        // unreadable entry
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
    const temp = `${abs}.nodebyte-part`;
    await Bun.write(temp, data);
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
      const abs = await this.safePath(join(root, file));
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
    await run(["tar", "-czf", join(base, archiveName), "--", ...names], base);
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
    if (!(await this.hasSpaceFor(info.size))) {
      throw new FilesystemError("not enough disk space", 507);
    }
    if (archive.endsWith(".zip")) {
      await run(["unzip", "-o", "-q", archive, "-d", base], base);
    } else {
      // --no-same-owner / no absolute paths: tar strips leading "/" by default.
      await run(["tar", "--no-same-owner", "-xf", archive, "-C", base], base);
    }
    // Archives may contain symlinks pointing outside; remove any that do.
    await this.removeEscapingLinks(base);
    await this.chownRecursive();
    this.usageCheckedAt = 0;
  }

  private async removeEscapingLinks(dir: string): Promise<void> {
    for (const dirent of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, dirent.name);
      if (dirent.isSymbolicLink()) {
        const target = await realpath(abs).catch(() => null);
        if (!target || (target !== this.root && !target.startsWith(this.root + sep))) {
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
    // Follow redirects by hand so every hop is checked against private ranges
    // (GitHub release downloads, for example, redirect to a CDN).
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
    const temp = `${abs}.nodebyte-part`;
    const hash = createHash("sha256");
    let bytes = 0;
    const source = Readable.fromWeb(res.body as unknown as NodeReadableStream);
    source.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      hash.update(chunk);
      if (bytes > MAX_PULL_BYTES) {
        source.destroy(new FilesystemError("file too large", 507));
      }
    });
    try {
      await pipeline(source, createWriteStream(temp));
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
