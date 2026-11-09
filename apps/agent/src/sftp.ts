import { existsSync } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rmdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import type { Stats } from "node:fs";

import ssh2 from "ssh2";
import type { Attributes, Connection, FileEntry, SFTPWrapper } from "ssh2";

import type { Config } from "./config";
import { logger } from "./log";
import type { ActivityBuffer, PanelClient } from "./panel";
import { PanelError } from "./panel";
import { FilesystemError } from "./server/filesystem";
import type { ServerManager } from "./server/manager";
import type { Server } from "./server/server";

const log = logger("sftp");
const { OPEN_MODE, STATUS_CODE, flagsToString } = ssh2.utils.sftp;

const READ_CHUNK_MAX = 256 * 1024;
const READDIR_BATCH = 100;
const ACTIVITY_FLUSH_MS = 5000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Handle =
  | { kind: "file"; fd: FileHandle; path: string; written: boolean }
  | { kind: "dir"; path: string; entries: Promise<FileEntry[]> | null };

// Loads the node's SSH host key, generating an ed25519 one on first start.
export const loadHostKey = async (path: string): Promise<string> => {
  if (existsSync(path)) {
    return readFile(path, "utf-8");
  }
  const { private: key } = ssh2.utils.generateKeyPairSync("ed25519");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, key, { mode: 0o600 });
  log.info(`generated SSH host key at ${path}`);
  return key;
};

const toAttrs = (info: Stats): Attributes => ({
  atime: Math.floor(info.atimeMs / 1000),
  gid: info.gid,
  mode: info.mode,
  mtime: Math.floor(info.mtimeMs / 1000),
  size: info.size,
  uid: info.uid,
});

const permissionString = (mode: number): string => {
  const type = (mode & 0o170_000) === 0o040_000 ? "d" : (mode & 0o170_000) === 0o120_000 ? "l" : "-";
  let bits = "";
  for (const shift of [6, 3, 0]) {
    const triple = (mode >> shift) & 7;
    bits += `${triple & 4 ? "r" : "-"}${triple & 2 ? "w" : "-"}${triple & 1 ? "x" : "-"}`;
  }
  return type + bits;
};

// `ls -l` style line; clients like FileZilla parse it for directory listings.
const longname = (name: string, info: Stats): string => {
  const date = info.mtime;
  const when =
    Date.now() - date.getTime() < 180 * 24 * 3600 * 1000
      ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
      : String(date.getFullYear());
  return [
    permissionString(info.mode),
    "1 container container",
    String(info.size).padStart(10),
    `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2)} ${when.padStart(5)}`,
    name,
  ].join(" ");
};

// Client paths are absolute from the server root ("/" = the volume).
const virtualPath = (path: string): string => posix.normalize(posix.join("/", path || "."));

const statusFor = (error: unknown): number => {
  if (error instanceof FilesystemError) {
    return error.status === 404 ? STATUS_CODE.NO_SUCH_FILE : STATUS_CODE.PERMISSION_DENIED;
  }
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return STATUS_CODE.NO_SUCH_FILE;
  }
  if (code === "EACCES" || code === "EPERM" || code === "EISDIR") {
    return STATUS_CODE.PERMISSION_DENIED;
  }
  return STATUS_CODE.FAILURE;
};

// One authenticated SFTP channel, jailed to a single server's volume.
class SftpSession {
  private handles = new Map<number, Handle>();
  private nextHandle = 1;
  private pending = new Map<string, string[]>();
  private timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly sftp: SFTPWrapper,
    private readonly server: Server,
    private readonly user: { uuid: string; ip: string },
    private readonly activity: ActivityBuffer,
  ) {
    this.timer = setInterval(() => this.flushActivity(), ACTIVITY_FLUSH_MS);
    this.timer.unref();
    sftp.on("close", () => void this.close());
    this.bind();
  }

  private get fs() {
    return this.server.fs;
  }

  // Batches file events so an upload of 1000 files is one activity entry.
  private record(event: string, path: string): void {
    const list = this.pending.get(event) ?? [];
    list.push(path);
    this.pending.set(event, list);
  }

  private flushActivity(): void {
    for (const [event, files] of this.pending) {
      this.activity.push({
        event,
        ip: this.user.ip,
        metadata: { count: files.length, files: files.slice(0, 100) },
        serverUuid: this.server.uuid,
        userUuid: this.user.uuid,
      });
    }
    this.pending.clear();
  }

  private async close(): Promise<void> {
    clearInterval(this.timer);
    for (const handle of this.handles.values()) {
      if (handle.kind === "file") {
        await this.closeFile(handle).catch(() => undefined);
      }
    }
    this.handles.clear();
    this.flushActivity();
  }

  private async closeFile(handle: Extract<Handle, { kind: "file" }>): Promise<void> {
    await handle.fd.close();
    if (handle.written) {
      await this.fs.fixOwnership(await this.fs.safePath(handle.path));
      this.record("server:sftp.write", handle.path);
    }
  }

  private allocate(handle: Handle): Buffer {
    const id = this.nextHandle;
    this.nextHandle += 1;
    this.handles.set(id, handle);
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(id);
    return buf;
  }

  private lookup(buf: Buffer): [number, Handle | undefined] {
    const id = buf.length === 4 ? buf.readUInt32BE(0) : -1;
    return [id, this.handles.get(id)];
  }

  // Runs a request handler, turning thrown errors into SFTP status replies.
  private handle<A extends unknown[]>(
    name: string,
    fn: (reqId: number, ...args: A) => Promise<void>,
  ): (reqId: number, ...args: A) => void {
    return (reqId, ...args) => {
      fn(reqId, ...args).catch((error: unknown) => {
        const code = statusFor(error);
        if (code === STATUS_CODE.FAILURE) {
          log.debug(`${name} on ${this.server.uuid} failed`, error);
        }
        // OS errors name host paths; only our own messages go to the client.
        this.sftp.status(reqId, code, error instanceof FilesystemError ? error.message : undefined);
      });
    };
  }

  private async writable(path: string): Promise<string> {
    if (this.server.config.suspended) {
      throw new FilesystemError("server is suspended");
    }
    const abs = await this.fs.safePath(path);
    if (abs === this.fs.root) {
      throw new FilesystemError("cannot modify the server root");
    }
    return abs;
  }

  private async listDirectory(path: string): Promise<FileEntry[]> {
    const abs = await this.fs.safePath(path);
    const entries = await Promise.all(
      (await readdir(abs)).map(async (name) => {
        const info = await lstat(join(abs, name)).catch(() => null);
        return info ? { attrs: toAttrs(info), filename: name, longname: longname(name, info) } : null;
      }),
    );
    return entries.filter((entry) => entry !== null);
  }

  private bind(): void {
    const { sftp } = this;

    sftp.on(
      "REALPATH",
      this.handle("REALPATH", async (reqId, path: string) => {
        const resolved = virtualPath(path);
        sftp.name(reqId, [{ attrs: {} as Attributes, filename: resolved, longname: resolved }]);
      }),
    );

    const statHandler = (follow: boolean) =>
      this.handle("STAT", async (reqId, path: string) => {
        const abs = await this.fs.safePath(path);
        sftp.attrs(reqId, toAttrs(follow ? await stat(abs) : await lstat(abs)));
      });
    sftp.on("STAT", statHandler(true));
    sftp.on("LSTAT", statHandler(false));

    sftp.on(
      "OPEN",
      this.handle("OPEN", async (reqId, path: string, flags: number) => {
        const mode = flagsToString(flags);
        if (!mode) {
          throw new FilesystemError("unsupported open flags");
        }
        const writing = (flags & (OPEN_MODE.WRITE | OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.TRUNC)) !== 0;
        const virtual = virtualPath(path);
        const abs = writing ? await this.writable(virtual) : await this.fs.safePath(virtual);
        if (writing && !(await this.fs.hasSpaceFor(0))) {
          sftp.status(reqId, STATUS_CODE.FAILURE, "not enough disk space");
          return;
        }
        const fd = await open(abs, mode, 0o644);
        sftp.handle(reqId, this.allocate({ fd, kind: "file", path: virtual, written: writing }));
      }),
    );

    sftp.on(
      "READ",
      this.handle("READ", async (reqId, raw: Buffer, offset: number, length: number) => {
        const [, handle] = this.lookup(raw);
        if (handle?.kind !== "file") {
          sftp.status(reqId, STATUS_CODE.FAILURE, "invalid handle");
          return;
        }
        const buf = Buffer.alloc(Math.min(length, READ_CHUNK_MAX));
        const { bytesRead } = await handle.fd.read(buf, 0, buf.length, offset);
        if (bytesRead === 0) {
          sftp.status(reqId, STATUS_CODE.EOF);
          return;
        }
        sftp.data(reqId, buf.subarray(0, bytesRead));
      }),
    );

    sftp.on(
      "WRITE",
      this.handle("WRITE", async (reqId, raw: Buffer, offset: number, data: Buffer) => {
        const [, handle] = this.lookup(raw);
        if (handle?.kind !== "file") {
          sftp.status(reqId, STATUS_CODE.FAILURE, "invalid handle");
          return;
        }
        if (this.server.config.suspended) {
          throw new FilesystemError("server is suspended");
        }
        if (!(await this.fs.hasSpaceFor(data.length))) {
          sftp.status(reqId, STATUS_CODE.FAILURE, "not enough disk space");
          return;
        }
        await handle.fd.write(data, 0, data.length, offset);
        handle.written = true;
        this.fs.noteWritten(data.length);
        sftp.status(reqId, STATUS_CODE.OK);
      }),
    );

    sftp.on(
      "FSTAT",
      this.handle("FSTAT", async (reqId, raw: Buffer) => {
        const [, handle] = this.lookup(raw);
        if (handle?.kind !== "file") {
          sftp.status(reqId, STATUS_CODE.FAILURE, "invalid handle");
          return;
        }
        sftp.attrs(reqId, toAttrs(await handle.fd.stat()));
      }),
    );

    // Mode bits and timestamps only; ownership always stays with the server.
    const setstat = async (abs: string, attrs: Partial<Attributes>) => {
      if (typeof attrs.mode === "number") {
        await chmod(abs, attrs.mode & 0o777);
      }
      if (typeof attrs.atime === "number" && typeof attrs.mtime === "number") {
        await utimes(abs, attrs.atime, attrs.mtime);
      }
    };
    sftp.on(
      "SETSTAT",
      this.handle("SETSTAT", async (reqId, path: string, attrs: Partial<Attributes>) => {
        await setstat(await this.writable(path), attrs);
        sftp.status(reqId, STATUS_CODE.OK);
      }),
    );
    sftp.on(
      "FSETSTAT",
      this.handle("FSETSTAT", async (reqId, raw: Buffer, attrs: Partial<Attributes>) => {
        const [, handle] = this.lookup(raw);
        if (handle?.kind !== "file") {
          sftp.status(reqId, STATUS_CODE.FAILURE, "invalid handle");
          return;
        }
        await setstat(await this.writable(handle.path), attrs);
        sftp.status(reqId, STATUS_CODE.OK);
      }),
    );

    sftp.on(
      "CLOSE",
      this.handle("CLOSE", async (reqId, raw: Buffer) => {
        const [id, handle] = this.lookup(raw);
        if (!handle) {
          sftp.status(reqId, STATUS_CODE.FAILURE, "invalid handle");
          return;
        }
        this.handles.delete(id);
        if (handle.kind === "file") {
          await this.closeFile(handle);
        }
        sftp.status(reqId, STATUS_CODE.OK);
      }),
    );

    sftp.on(
      "OPENDIR",
      this.handle("OPENDIR", async (reqId, path: string) => {
        const virtual = virtualPath(path);
        const abs = await this.fs.safePath(virtual);
        if (!(await stat(abs)).isDirectory()) {
          sftp.status(reqId, STATUS_CODE.NO_SUCH_FILE, "not a directory");
          return;
        }
        sftp.handle(reqId, this.allocate({ entries: null, kind: "dir", path: virtual }));
      }),
    );

    sftp.on(
      "READDIR",
      this.handle("READDIR", async (reqId, raw: Buffer) => {
        const [, handle] = this.lookup(raw);
        if (handle?.kind !== "dir") {
          sftp.status(reqId, STATUS_CODE.FAILURE, "invalid handle");
          return;
        }
        // Clients pipeline READDIRs on one handle; they must share one listing.
        handle.entries ??= this.listDirectory(handle.path);
        const entries = await handle.entries;
        const batch = entries.splice(0, READDIR_BATCH);
        if (batch.length === 0) {
          sftp.status(reqId, STATUS_CODE.EOF);
          return;
        }
        sftp.name(reqId, batch);
      }),
    );

    sftp.on(
      "MKDIR",
      this.handle("MKDIR", async (reqId, path: string) => {
        const virtual = virtualPath(path);
        const abs = await this.writable(virtual);
        await mkdir(abs);
        await this.fs.fixOwnership(abs);
        this.record("server:sftp.create-directory", virtual);
        sftp.status(reqId, STATUS_CODE.OK);
      }),
    );

    const remove = (directory: boolean) =>
      this.handle(directory ? "RMDIR" : "REMOVE", async (reqId, path: string) => {
        const virtual = virtualPath(path);
        const abs = await this.writable(virtual);
        await (directory ? rmdir(abs) : unlink(abs));
        this.fs.invalidateUsage();
        this.record("server:sftp.delete", virtual);
        sftp.status(reqId, STATUS_CODE.OK);
      });
    sftp.on("REMOVE", remove(false));
    sftp.on("RMDIR", remove(true));

    sftp.on(
      "RENAME",
      this.handle("RENAME", async (reqId, from: string, to: string) => {
        const source = await this.writable(from);
        const target = await this.writable(to);
        // SFTPv3 rename never overwrites.
        if (await lstat(target).catch(() => null)) {
          sftp.status(reqId, STATUS_CODE.FAILURE, "target already exists");
          return;
        }
        await rename(source, target);
        this.record("server:sftp.rename", `${virtualPath(from)} → ${virtualPath(to)}`);
        sftp.status(reqId, STATUS_CODE.OK);
      }),
    );

    // Links could be used to point outside the volume; not offered.
    for (const event of ["READLINK", "SYMLINK"] as const) {
      sftp.on(event, (reqId: number) => sftp.status(reqId, STATUS_CODE.OP_UNSUPPORTED));
    }
  }
}

// SSH server that only offers the SFTP subsystem. Credentials are checked by
// the panel; each connection is bound to the one server the username names.
export class SftpServer {
  private ssh: InstanceType<typeof ssh2.Server>;
  private connections = new Map<string, Set<Connection>>();

  constructor(
    private readonly config: Config,
    hostKey: string,
    private readonly panel: PanelClient,
    private readonly manager: ServerManager,
    private readonly activity: ActivityBuffer,
  ) {
    this.ssh = new ssh2.Server({ hostKeys: [hostKey], ident: "NodeByte" }, (client, info) =>
      this.accept(client, info.ip),
    );
    this.ssh.on("error", (error: Error) => log.error("ssh server error", error));
  }

  listen(): Promise<void> {
    const { host, port } = this.config.sftp;
    return new Promise((resolve) => {
      this.ssh.listen(port, host, () => {
        log.info(`listening on sftp://${host}:${port}`);
        resolve();
      });
    });
  }

  // Drops every SFTP connection to a server (suspension, deletion).
  disconnect(serverUuid: string): void {
    for (const client of this.connections.get(serverUuid) ?? []) {
      client.end();
    }
    this.connections.delete(serverUuid);
  }

  close(): void {
    for (const uuid of this.connections.keys()) {
      this.disconnect(uuid);
    }
    this.ssh.close();
  }

  private accept(client: Connection, ip: string): void {
    let session: { server: Server; userUuid: string } | null = null;

    client.on("error", (error) => log.debug(`connection from ${ip} errored`, error));

    client.on("authentication", (ctx) => {
      if (ctx.method !== "password") {
        ctx.reject(["password"]);
        return;
      }
      void (async () => {
        try {
          const result = await this.panel.validateSftpCredentials({
            ip,
            password: ctx.password,
            username: ctx.username,
          });
          const server = this.manager.get(result.serverUuid);
          if (!server) {
            throw new FilesystemError("server is not on this node");
          }
          session = { server, userUuid: result.userUuid };
          ctx.accept();
        } catch (error) {
          if (!(error instanceof PanelError && error.status < 500)) {
            log.warn(`login check for ${ctx.username} failed`, error);
          }
          ctx.reject(["password"]);
        }
      })();
    });

    client.on("ready", () => {
      if (!session) {
        client.end();
        return;
      }
      const { server, userUuid } = session;
      const set = this.connections.get(server.uuid) ?? new Set();
      set.add(client);
      this.connections.set(server.uuid, set);
      client.on("close", () => set.delete(client));

      // Shell, exec and port forwarding requests have no listener, so ssh2
      // rejects them.
      client.on("session", (acceptSession) => {
        acceptSession().on("sftp", (acceptSftp) => {
          new SftpSession(acceptSftp(), server, { ip, uuid: userUuid }, this.activity);
        });
      });
    });
  }
}
