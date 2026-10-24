import { setTimeout as delay } from "node:timers/promises";

import {
  installScriptSchema,
  serverConfigurationPageSchema,
  serverConfigurationSchema,
} from "../../protocol";
import type {
  BackupStatus,
  DaemonActivity,
  InstallScript,
  InstallStatus,
  ServerConfiguration,
} from "../../protocol";
import type { Config } from "./config";
import { logger } from "./log";

const log = logger("panel");

export class PanelError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Client for the panel's /api/remote/* endpoints, authenticated with the
// node's `tokenId.token` pair.
export class PanelClient {
  constructor(private readonly config: Config) {}

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    attempts = 3,
  ): Promise<unknown> {
    const url = new URL(path, this.config.remote);
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const res = await fetch(url, {
          body: body === undefined ? undefined : JSON.stringify(body),
          headers: {
            accept: "application/json",
            authorization: `Bearer ${this.config.tokenId}.${this.config.token}`,
            "content-type": "application/json",
            "user-agent": "nodebyte-daemon",
          },
          method,
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 204) {
          return null;
        }
        const text = await res.text();
        if (!res.ok) {
          const error = new PanelError(
            `${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`,
            res.status,
          );
          // 4xx won't get better by retrying.
          if (res.status < 500) {
            throw error;
          }
          lastError = error;
        } else {
          return text.length > 0 ? JSON.parse(text) : null;
        }
      } catch (error) {
        if (error instanceof PanelError && error.status < 500) {
          throw error;
        }
        lastError = error;
      }
      if (attempt < attempts) {
        await delay(attempt * 1000);
      }
    }
    throw lastError;
  }

  async getServers(): Promise<ServerConfiguration[]> {
    const all: ServerConfiguration[] = [];
    let page: number | null = 1;
    while (page !== null) {
      const raw = await this.request("GET", `/api/remote/servers?page=${page}`);
      const parsed = serverConfigurationPageSchema.parse(raw);
      all.push(...parsed.data);
      page = parsed.nextPage;
    }
    return all;
  }

  async getServer(uuid: string): Promise<ServerConfiguration> {
    return serverConfigurationSchema.parse(
      await this.request("GET", `/api/remote/servers/${uuid}`),
    );
  }

  async getInstallScript(uuid: string): Promise<InstallScript> {
    return installScriptSchema.parse(
      await this.request("GET", `/api/remote/servers/${uuid}/install`),
    );
  }

  async setInstallStatus(uuid: string, status: InstallStatus): Promise<void> {
    await this.request("POST", `/api/remote/servers/${uuid}/install`, status, 5);
  }

  async resetServerStates(): Promise<void> {
    await this.request("POST", "/api/remote/servers/reset");
  }

  async setBackupStatus(backupUuid: string, status: BackupStatus): Promise<void> {
    await this.request("POST", `/api/remote/backups/${backupUuid}`, status, 5);
  }

  async setRestoreStatus(backupUuid: string, successful: boolean): Promise<void> {
    await this.request(
      "POST",
      `/api/remote/backups/${backupUuid}/restore`,
      { successful },
      5,
    );
  }

  async sendActivity(data: DaemonActivity[]): Promise<void> {
    if (data.length === 0) {
      return;
    }
    await this.request("POST", "/api/remote/activity", { data }, 1);
  }
}

// Buffers user-attributed events (websocket power actions, console commands)
// and ships them to the panel in batches.
export class ActivityBuffer {
  private queue: DaemonActivity[] = [];

  constructor(private readonly panel: PanelClient) {}

  push(entry: Omit<DaemonActivity, "timestamp">): void {
    this.queue.push({ ...entry, timestamp: new Date().toISOString() });
    if (this.queue.length > 2000) {
      this.queue.splice(0, this.queue.length - 2000);
    }
  }

  async flush(): Promise<void> {
    const batch = this.queue.splice(0, 500);
    if (batch.length === 0) {
      return;
    }
    try {
      await this.panel.sendActivity(batch);
    } catch (error) {
      log.warn("activity flush failed; will retry", error);
      this.queue.unshift(...batch);
    }
  }

  start(signal: AbortSignal): void {
    const timer = setInterval(() => void this.flush(), 10_000);
    signal.addEventListener("abort", () => clearInterval(timer));
  }
}
