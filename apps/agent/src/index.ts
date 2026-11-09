import { parseArgs } from "node:util";

import { CONFIG_PATH, ensureDirectories, loadConfig, saveConfig, VERSION } from "./config";
import { Docker } from "./docker";
import { createFetchHandler } from "./http/router";
import type { SocketData } from "./http/websocket";
import { websocketHandlers } from "./http/websocket";
import { logger } from "./log";
import { ActivityBuffer, PanelClient } from "./panel";
import { Backups } from "./server/backups";
import { ServerManager } from "./server/manager";
import { loadHostKey, SftpServer } from "./sftp";

const log = logger("daemon");

// `nodebyte-daemon configure --panel https://panel.example --token <id>.<token>`
// fetches this node's configuration from the panel and writes it to disk.
const configure = async (args: string[]) => {
  const { values } = parseArgs({
    args,
    options: {
      config: { default: CONFIG_PATH, type: "string" },
      panel: { type: "string" },
      token: { type: "string" },
    },
  });
  if (!values.panel || !values.token) {
    console.error("usage: nodebyte-daemon configure --panel <url> --token <tokenId.token>");
    process.exit(2);
  }
  const res = await fetch(new URL("/api/remote/configuration", values.panel), {
    headers: { accept: "application/json", authorization: `Bearer ${values.token}` },
  });
  if (!res.ok) {
    console.error(`panel responded ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const saved = await saveConfig(await res.json(), values.config);
  console.log(`Configuration for node ${saved.uuid} written to ${values.config}`);
};

const run = async () => {
  const config = await loadConfig();
  await ensureDirectories(config);
  log.info(`NodeByte daemon v${VERSION} starting for node ${config.uuid}`);

  const docker = new Docker(config.docker.socket);
  const dockerVersion = await docker.version();
  if (!dockerVersion) {
    throw new Error(`cannot reach Docker at ${config.docker.socket}`);
  }
  log.info(`docker ${dockerVersion}`);
  await docker.ensureNetwork(config.docker.network);

  const panel = new PanelClient(config);
  const activity = new ActivityBuffer(panel);
  const manager = new ServerManager(config, docker, panel);
  const backups = new Backups(config, panel);
  await manager.boot();

  const abort = new AbortController();
  activity.start(abort.signal);

  const sftp = config.sftp.enabled
    ? new SftpServer(config, await loadHostKey(config.sftp.hostKey), panel, manager, activity)
    : null;
  await sftp?.listen();

  const server = Bun.serve<SocketData>({
    fetch: createFetchHandler({ backups, config, docker, manager, sftp }),
    hostname: config.api.host,
    maxRequestBodySize: config.api.uploadLimitMb * 1024 * 1024 + 1024 * 1024,
    port: config.api.port,
    tls: config.api.ssl.enabled
      ? { cert: Bun.file(config.api.ssl.cert), key: Bun.file(config.api.ssl.key) }
      : undefined,
    websocket: websocketHandlers(config, activity),
  });
  log.info(`listening on ${config.api.ssl.enabled ? "https" : "http"}://${server.hostname}:${server.port}`);

  const shutdown = async () => {
    log.info("shutting down (game servers keep running)");
    abort.abort();
    sftp?.close();
    await activity.flush();
    server.stop(true);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
};

const [command = "run", ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "configure": {
      await configure(rest);
      break;
    }
    case "version":
    case "--version": {
      console.log(VERSION);
      break;
    }
    case "run": {
      await run();
      break;
    }
    default: {
      console.error(`unknown command ${command}. Commands: run, configure, version`);
      process.exit(2);
    }
  }
} catch (error) {
  log.error("fatal", error);
  process.exit(1);
}
