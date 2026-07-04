import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, unlink, open, writeFile as writeFileFs } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { FileEntry } from "../../protocol";

const ignore = (): undefined => undefined;

const DATA_ROOT =
  process.env.nodebyte_DATA_ROOT ?? "/var/lib/nodebyte/game/data";
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;
const MAX_READ_BYTES = 1 * 1024 * 1024;

const resolveInRoot = (relative: string): string => {
  const cleaned = normalize(`/${relative}`).replace(/^\/+/u, "");
  const resolved = resolve(DATA_ROOT, cleaned);
  if (resolved !== DATA_ROOT && !resolved.startsWith(DATA_ROOT + sep)) {
    throw new Error("path escapes data root");
  }
  return resolved;
};

const normalizeRelativePath = (relativePath: string): string => normalize(`/${relativePath}`).replace(/^\/+/u, "");

const tryDecodeUtf8 = (bytes: Buffer, trucated: boolean): string | null => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    if (!trucated) {
      return null;
    }
  }

  for (let trim = 1; trim <= 3; trim +=1) {
    if (bytes.length <= trim) {
      break;
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, bytes.length - trim))
    } catch {

    }
  }

  return null;
}

export const listFiles = async (
  relativePath: string
): Promise<{ path: string; entries: FileEntry[] }> => {
  const abs = resolveInRoot(relativePath);
  await mkdir(abs, { recursive: true });
  const dirents = await readdir(abs, { withFileTypes: true });
  const entries: FileEntry[] = [];
  for (const dirent of dirents) {
    try {
      const info = await stat(join(abs, dirent.name));
      entries.push({
        mtime: info.mtime.toISOString(),
        name: dirent.name,
        size: info.isFile() ? info.size : 0,
        type: info.isDirectory() ? "dir" : "file",
      });
    } catch {
      // skip unreadable entries (broken symlinks etc)
    }
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  const normalized = normalize(`/${relativePath}`).replace(/^\/+/u, "");
  return { entries, path: normalized };
};

export const readFile = async (relativePath: string): Promise<{
  path: string;
  content: string;
  encoding: "utf8" | "base64";
  size: number;
  truncated: boolean;
}> => {
  const abs = resolveInRoot(relativePath);
  const info = await stat(abs);

  if (!info.isFile()) {
    throw new Error("Path is not a file")
  }

  const size = info.size;
  const truncated = size > MAX_READ_BYTES;
  const bytesToRead = Math.min(size, MAX_READ_BYTES);
  const handle = await open(abs, "r")

  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    const chunk = bytesRead == buffer.length ? buffer : buffer.subarray(0, bytesRead);
    const utf8 = tryDecodeUtf8(chunk, truncated);
    const normalizedPath = normalizeRelativePath(relativePath);

    if (utf8 !== null) {
      return {
        content: utf8,
        encoding: "utf8",
        path: normalizedPath,
        size,
        truncated
      }
    }

    return {
        content: chunk.toString("base64"),
        encoding: "base64",
        path: normalizedPath,
        size,
        truncated
      }
  } finally {
    await handle.close()
  }
}

export const writeFile = async (input: {path: string, content: string, encoding?: "utf8" | "base64"}): Promise<void> => {
  const abs = resolveInRoot(input.path);

  if (abs == DATA_ROOT) {
    throw new Error("Cannot write data root")
  }

  const encoding = input.encoding ?? "utf8";
  const contentBytes = encoding == "base64" ? Buffer.from(input.content, "base64") : Buffer.from(input.content, "utf8");

  if (contentBytes.byteLength > MAX_READ_BYTES) {
    throw new Error(`Contant too big (You know You know ;) ) ${MAX_READ_BYTES} bytes`)
  }

  await mkdir(dirname(abs), { recursive: true });

  const tempPath = `${abs}.part`;

  try {
    await writeFileFs(tempPath, contentBytes);
    await rm(abs, { force: true });
    await rename(tempPath, abs);
  } catch (error) {
    await unlink(tempPath).catch(ignore);
    throw error;
  }
}

export const deleteFile = async (relativePath: string): Promise<void> => {
  const abs = resolveInRoot(relativePath);
  if (abs === DATA_ROOT) {
    throw new Error("cannot delete data root");
  }
  const info = await stat(abs);
  await (info.isDirectory() ? rm(abs, { recursive: true }) : unlink(abs));
};

export const installFromUrl = async (input: {
  url: string;
  destPath: string;
  sha256?: string;
}): Promise<{ bytesWritten: number; sha256: string }> => {
  const abs = resolveInRoot(input.destPath);
  if (abs === DATA_ROOT) {
    throw new Error("destPath must be a file");
  }
  await mkdir(dirname(abs), { recursive: true });

  const res = await fetch(input.url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status}`);
  }
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`file too large: ${contentLength} > ${MAX_DOWNLOAD_BYTES}`);
  }

  const hash = createHash("sha256");
  let bytesWritten = 0;
  const tempPath = `${abs}.part`;
  const sink = createWriteStream(tempPath);
  try {
    const source = Readable.fromWeb(res.body as unknown as NodeReadableStream);
    source.on("data", (chunk: Buffer) => {
      bytesWritten += chunk.length;
      if (bytesWritten > MAX_DOWNLOAD_BYTES) {
        source.destroy(new Error(`file exceeds ${MAX_DOWNLOAD_BYTES} bytes`));
        return;
      }
      hash.update(chunk);
    });
    await pipeline(source, sink);
  } catch (error) {
    await unlink(tempPath).catch(ignore);
    throw error;
  }

  const digest = hash.digest("hex");
  if (input.sha256 && digest.toLowerCase() !== input.sha256.toLowerCase()) {
    await unlink(tempPath).catch(ignore);
    throw new Error("sha256 mismatch");
  }

  await rm(abs, { force: true });
  await rename(tempPath, abs);
  return { bytesWritten, sha256: digest };
};
