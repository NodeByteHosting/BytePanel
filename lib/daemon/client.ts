import "server-only";
import type { Node } from "@prisma/client";

import {
  daemonServerDetailsSchema,
  filesListResultSchema,
  systemInfoSchema,
} from "@/protocol";
import type {
  DaemonServerDetails,
  FilesListResult,
  PowerAction,
  SystemInfo,
} from "@/protocol";

import { DaemonError } from "./errors";
import { nodeToken } from "./tokens";
import { daemonBaseUrl } from "./urls";

export { DaemonError } from "./errors";

const contentTypeHeader = (init: {
  json?: unknown;
  contentType?: string;
}): Record<string, string> => {
  if (init.json !== undefined) {
    return { "content-type": "application/json" };
  }
  return init.contentType ? { "content-type": init.contentType } : {};
};

// Panel → daemon HTTP client (one per node). Mirrors the Wings API surface.
export class DaemonClient {
  private readonly base: string;
  private readonly token: string;

  constructor(node: Node) {
    this.base = daemonBaseUrl(node);
    this.token = nodeToken(node);
  }

  private async request(
    method: string,
    path: string,
    init: {
      json?: unknown;
      body?: BodyInit;
      timeoutMs?: number;
      contentType?: string;
    } = {}
  ): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        body: init.json === undefined ? init.body : JSON.stringify(init.json),
        cache: "no-store",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.token}`,
          ...contentTypeHeader(init),
        },
        method,
        signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
      });
    } catch (error) {
      throw new DaemonError(
        `Node is unreachable (${error instanceof Error ? error.message : "network error"})`,
        502
      );
    }
    if (!res.ok) {
      let message = `Daemon responded ${res.status}`;
      try {
        message = ((await res.json()) as { error?: string }).error ?? message;
      } catch {
        // non-JSON error body
      }
      throw new DaemonError(message, res.status);
    }
    return res;
  }

  async system(): Promise<SystemInfo> {
    const res = await this.request("GET", "/api/system", { timeoutMs: 5000 });
    return systemInfoSchema.parse(await res.json());
  }

  async createServer(uuid: string, startOnCompletion: boolean): Promise<void> {
    await this.request("POST", "/api/servers", {
      json: { startOnCompletion, uuid },
    });
  }

  async getServer(uuid: string): Promise<DaemonServerDetails> {
    const res = await this.request("GET", `/api/servers/${uuid}`, {
      timeoutMs: 5000,
    });
    return daemonServerDetailsSchema.parse(await res.json());
  }

  async deleteServer(uuid: string): Promise<void> {
    try {
      await this.request("DELETE", `/api/servers/${uuid}`, {
        timeoutMs: 120_000,
      });
    } catch (error) {
      if (!(error instanceof DaemonError && error.status === 404)) {
        throw error;
      }
    }
  }

  async power(uuid: string, action: PowerAction): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/power`, {
      json: { action },
    });
  }

  async sendCommands(uuid: string, commands: string[]): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/commands`, {
      json: { commands },
    });
  }

  async sync(uuid: string): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/sync`);
  }

  async reinstall(uuid: string): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/reinstall`);
  }

  async logs(uuid: string, size = 100): Promise<string[]> {
    const res = await this.request(
      "GET",
      `/api/servers/${uuid}/logs?size=${size}`
    );
    return ((await res.json()) as { data: string[] }).data;
  }

  // ─── files ─────────────────────────────────────────────────────────────────

  async listDirectory(
    uuid: string,
    directory: string
  ): Promise<FilesListResult> {
    const res = await this.request(
      "GET",
      `/api/servers/${uuid}/files/list-directory?directory=${encodeURIComponent(directory)}`
    );
    return filesListResultSchema.parse(await res.json());
  }

  async getFileContents(uuid: string, file: string): Promise<string> {
    const res = await this.request(
      "GET",
      `/api/servers/${uuid}/files/contents?file=${encodeURIComponent(file)}`
    );
    return res.text();
  }

  async writeFile(uuid: string, file: string, content: string): Promise<void> {
    await this.request(
      "POST",
      `/api/servers/${uuid}/files/write?file=${encodeURIComponent(file)}`,
      { body: content, contentType: "text/plain; charset=utf-8" }
    );
  }

  async deleteFiles(
    uuid: string,
    root: string,
    files: string[]
  ): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/files/delete`, {
      json: { files, root },
    });
  }

  async renameFiles(
    uuid: string,
    root: string,
    files: { from: string; to: string }[]
  ): Promise<void> {
    await this.request("PUT", `/api/servers/${uuid}/files/rename`, {
      json: { files, root },
    });
  }

  async createDirectory(
    uuid: string,
    path: string,
    name: string
  ): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/files/create-directory`, {
      json: { name, path },
    });
  }

  async pullFile(
    uuid: string,
    input: {
      url: string;
      directory: string;
      filename?: string;
      sha256?: string;
    }
  ): Promise<{ path: string; bytes: number; sha256: string }> {
    const res = await this.request("POST", `/api/servers/${uuid}/files/pull`, {
      json: input,
      timeoutMs: 30 * 60_000,
    });
    return (await res.json()) as {
      path: string;
      bytes: number;
      sha256: string;
    };
  }

  async compressFiles(
    uuid: string,
    root: string,
    files: string[]
  ): Promise<string> {
    const res = await this.request(
      "POST",
      `/api/servers/${uuid}/files/compress`,
      {
        json: { files, root },
        timeoutMs: 10 * 60_000,
      }
    );
    return ((await res.json()) as { name: string }).name;
  }

  async decompressFile(
    uuid: string,
    root: string,
    file: string
  ): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/files/decompress`, {
      json: { file, root },
      timeoutMs: 10 * 60_000,
    });
  }

  // ─── backups ───────────────────────────────────────────────────────────────

  async createBackup(
    uuid: string,
    backupUuid: string,
    ignore: string
  ): Promise<void> {
    await this.request("POST", `/api/servers/${uuid}/backup`, {
      json: { ignore, uuid: backupUuid },
    });
  }

  async deleteBackup(uuid: string, backupUuid: string): Promise<void> {
    await this.request("DELETE", `/api/servers/${uuid}/backup/${backupUuid}`);
  }

  async restoreBackup(
    uuid: string,
    backupUuid: string,
    truncateDirectory: boolean
  ): Promise<void> {
    await this.request(
      "POST",
      `/api/servers/${uuid}/backup/${backupUuid}/restore`,
      {
        json: { truncateDirectory },
      }
    );
  }
}

export const daemonFor = (node: Node) => new DaemonClient(node);
