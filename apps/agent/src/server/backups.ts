import { createHash } from "node:crypto";
import { rm, stat, statfs } from "node:fs/promises";
import { join } from "node:path";

import { WS_EVENTS } from "@bytepanel/protocol";
import type { Config } from "../config";
import { errorMessage, logger } from "../log";
import type { PanelClient } from "../panel";
import type { Server } from "./server";
import { ServerError } from "./server";

const log = logger("backups");

const backupPath = (node: Config, backupUuid: string) =>
  join(node.system.backups, `${backupUuid}.tar.gz`);

const sha1File = async (path: string): Promise<string> => {
  const hash = createHash("sha1");
  for await (const chunk of Bun.file(path).stream()) {
    hash.update(chunk);
  }
  return hash.digest("hex");
};

const runTar = async (args: string[]): Promise<void> => {
  const proc = Bun.spawn({ cmd: ["tar", ...args], stderr: "pipe", stdout: "ignore" });
  const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0 && code !== 1) {
    throw new Error(err.trim().slice(0, 300));
  }
};

export class Backups {
  constructor(
    private readonly node: Config,
    private readonly panel: PanelClient,
  ) {}

  file(backupUuid: string): string {
    return backupPath(this.node, backupUuid);
  }

  create(server: Server, backupUuid: string, ignore: string): void {
    void (async () => {
      const target = backupPath(this.node, backupUuid);
      try {
        const disk = await statfs(this.node.system.backups);
        if (disk.bavail * disk.bsize < (await server.fs.diskUsage(true))) {
          throw new Error("not enough free space on the node for this backup");
        }
        const excludes = ignore
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
          .flatMap((pattern) => ["--exclude", pattern.replace(/^\//u, "./")]);
        await runTar(["-czf", target, ...excludes, "-C", server.fs.root, "."]);
        const { size } = await stat(target);
        const checksum = await sha1File(target);
        await this.panel.setBackupStatus(backupUuid, { checksum, size, successful: true });
        server.emit(WS_EVENTS.BACKUP_COMPLETED, JSON.stringify({ checksum, size, successful: true, uuid: backupUuid }));
      } catch (error) {
        log.error(`backup ${backupUuid} failed`, error);
        await rm(target, { force: true });
        await this.panel
          .setBackupStatus(backupUuid, { checksum: null, size: 0, successful: false })
          .catch(() => undefined);
        server.emit(WS_EVENTS.BACKUP_COMPLETED, JSON.stringify({ successful: false, uuid: backupUuid }));
      }
    })();
  }

  async remove(backupUuid: string): Promise<void> {
    await rm(backupPath(this.node, backupUuid), { force: true });
  }

  async restore(server: Server, backupUuid: string, truncate: boolean): Promise<void> {
    const archive = backupPath(this.node, backupUuid);
    if (!(await Bun.file(archive).exists())) {
      throw new ServerError("backup not found on this node", 404);
    }
    if (server.state !== "offline") {
      throw new ServerError("stop the server before restoring a backup");
    }
    server.restoring = true;
    void (async () => {
      let successful = false;
      try {
        server.daemonMessage("Restoring backup…");
        if (truncate) {
          await rm(server.fs.root, { force: true, recursive: true });
          await server.fs.ensureRoot();
        }
        await server.fs.restoreArchive(archive);
        successful = true;
        server.daemonMessage("Backup restored.");
      } catch (error) {
        server.daemonMessage(`Backup restore failed: ${errorMessage(error)}`);
      } finally {
        server.restoring = false;
        await this.panel.setRestoreStatus(backupUuid, successful).catch(() => undefined);
      }
    })();
  }
}
