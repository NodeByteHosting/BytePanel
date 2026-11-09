import type { Config } from "../config";
import type { Docker } from "../docker";
import { logger } from "../log";
import type { PanelClient } from "../panel";
import { Server } from "./server";

const log = logger("manager");

export class ServerManager {
  private servers = new Map<string, Server>();

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

  // Loads every server assigned to this node from the panel and re-attaches to
  // containers that survived a daemon restart.
  async boot(): Promise<void> {
    const configs = await this.panel.getServers();
    log.info(`loaded ${configs.length} server(s) from the panel`);
    await Promise.all(
      configs.map(async (config) => {
        const server = new Server(config, this.node, this.docker, this.panel);
        this.servers.set(config.uuid, server);
        try {
          await server.restore();
        } catch (error) {
          log.warn(`could not restore ${config.uuid}`, error);
        }
      }),
    );
    // Any server the panel still thinks is installing was interrupted.
    await this.panel.resetServerStates().catch((error) => log.warn("state reset failed", error));
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
