import type { Config } from "../config";
import type { Docker } from "../docker";
import { logger } from "../log";
import type { PanelClient } from "../panel";
import { Server } from "./server";

const log = logger("manager");

export class ServerManager {
  private servers = new Map<string, Server>();
  private diskTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly node: Config,
    private readonly docker: Docker,
    private readonly panel: PanelClient,
  ) {}

  get(uuid: string): Server | undefined {
    return this.servers.get(uuid);
  }

  all(): Server[] {
    return [...this.servers.values()];
  }

  async boot(): Promise<void> {
    const restarts: Server[] = [];
    const configs = await this.panel.getServers();
    log.info(`loaded ${configs.length} server(s) from the panel`);
    await Promise.all(
      configs.map(async (config) => {
        const server = new Server(config, this.node, this.docker, this.panel);
        this.servers.set(config.uuid, server);
        try {
          if (await server.restore()) {
            restarts.push(server);
          }
        } catch (error) {
          log.warn(`could not restore ${config.uuid}`, error);
        }
      }),
    );
    await this.panel.resetServerStates().catch((error) => log.warn("state reset failed", error));
    void this.restartServers(restarts);
    this.scheduleDiskCheck();
  }

  private async restartServers(servers: Server[]): Promise<void> {
    for (const server of servers) {
      log.info(`starting ${server.uuid} after a node restart`);
      await server
        .power("start")
        .catch((error) => log.warn(`could not start ${server.uuid} after a node restart`, error));
    }
  }

  private scheduleDiskCheck(): void {
    this.diskTimer = setTimeout(() => {
      void this.checkDisks().finally(() => this.scheduleDiskCheck());
    }, this.node.system.diskCheckIntervalSeconds * 1000);
    this.diskTimer.unref();
  }

  private async checkDisks(): Promise<void> {
    for (const server of this.all()) {
      await server
        .enforceDiskLimit()
        .catch((error) => log.warn(`disk check for ${server.uuid} failed`, error));
    }
  }

  async create(uuid: string, startOnCompletion: boolean): Promise<Server> {
    if (this.servers.has(uuid)) {
      return this.servers.get(uuid) as Server;
    }
    const config = await this.panel.getServer(uuid);
    const server = new Server(config, this.node, this.docker, this.panel);
    this.servers.set(uuid, server);
    await server.fs.ensureRoot();
    void (async () => {
      await server.install(false);
      if (startOnCompletion && !server.config.suspended) {
        await server.power("start").catch((error) => log.warn(`autostart of ${uuid} failed`, error));
      }
    })();
    return server;
  }

  async remove(uuid: string): Promise<void> {
    const server = this.servers.get(uuid);
    this.servers.delete(uuid);
    await server?.destroy();
  }
}
