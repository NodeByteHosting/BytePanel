import "server-only";
import type {
  ConfigFile,
  InstallScript,
  ServerConfiguration,
} from "@nodebyte/protocol";
import type { Prisma } from "@prisma/client";

import { resolvePlaceholders } from "@/lib/eggs/placeholders";
import type { PlaceholderContext } from "@/lib/eggs/placeholders";
import { API_URL } from "@/lib/env";

import { nodeToken } from "./tokens";

// Default docker bridge gateway configured by the daemon (config.ts). Used for
// the {{config.docker.interface}} placeholder.
const DOCKER_INTERFACE = "172.18.0.1";

export const serverConfigInclude = {
  allocation: true,
  allocations: true,
  egg: { include: { variables: true } },
  variables: true,
} satisfies Prisma.ServerInclude;

export type ServerForConfig = Prisma.ServerGetPayload<{
  include: typeof serverConfigInclude;
}>;

// Effective environment: egg defaults overridden by the server's values.
export const serverEnvironment = (
  server: ServerForConfig
): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const variable of server.egg?.variables ?? []) {
    const override = server.variables.find((v) => v.variableId === variable.id);
    env[variable.envVariable] = override?.value ?? variable.defaultValue;
  }
  return env;
};

// Primary allocation first, then the rest by port.
const orderedAllocations = (server: ServerForConfig) => [
  ...(server.allocation ? [server.allocation] : []),
  ...server.allocations
    .filter((a) => a.id !== server.allocationId)
    .toSorted((a, b) => a.port - b.port),
];

const placeholderContext = (server: ServerForConfig): PlaceholderContext => ({
  dockerInterface: DOCKER_INTERFACE,
  env: serverEnvironment(server),
  ip: server.allocation?.ip ?? "0.0.0.0",
  memory: server.memory,
  name: server.name,
  port: server.allocation?.port ?? 0,
  ports: orderedAllocations(server).map((a) => a.port),
});

// Variable values may themselves reference placeholders (e.g. a hidden
// GAME_PORT variable defaulting to "{{SERVER_PORT}}"), so resolve them once.
const resolvedEnvironment = (ctx: PlaceholderContext): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ctx.env).map(([key, value]) => [
      key,
      resolvePlaceholders(value, ctx),
    ])
  );

const parseOwner = (
  raw: string | null
): { uid: number; gid: number } | null => {
  const match = /^(?<uid>\d+):(?<gid>\d+)$/u.exec(raw ?? "");
  return match?.groups
    ? { gid: Number(match.groups.gid), uid: Number(match.groups.uid) }
    : null;
};

const parseStop = (raw: string): ServerConfiguration["process"]["stop"] => {
  const value = raw.trim();
  if (value === "native" || value === "") {
    return { type: "native", value: "" };
  }
  if (value === "^C") {
    return { type: "signal", value: "^C" };
  }
  if (value.startsWith("^")) {
    return { type: "signal", value: value.slice(1) };
  }
  return { type: "command", value };
};

const asStringArray = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

const asNumberArray = (value: Prisma.JsonValue): number[] =>
  Array.isArray(value)
    ? value.filter((v): v is number => typeof v === "number")
    : [];

export const buildServerConfiguration = (
  server: ServerForConfig
): ServerConfiguration => {
  const { egg } = server;
  if (!egg) {
    throw new Error(`Server ${server.id} has no egg`);
  }
  const rawCtx = placeholderContext(server);
  const env = resolvedEnvironment(rawCtx);
  const ctx = { ...rawCtx, env };
  const ordered = orderedAllocations(server);
  const containerPorts = asNumberArray(egg.containerPorts);

  const configFiles = (Array.isArray(egg.configFiles)
    ? egg.configFiles
    : []) as unknown as ConfigFile[];

  return {
    allocations: {
      default: { ip: ctx.ip, port: ctx.port },
      mappings: ordered.map((allocation, index) => ({
        containerPort: containerPorts[index] || allocation.port,
        ip: allocation.ip,
        port: allocation.port,
      })),
    },
    build: {
      cpuLimit: server.cpu,
      diskSpace: server.disk,
      ioWeight: Math.min(1000, Math.max(10, server.io)),
      memoryLimit: server.memory,
      oomDisabled: server.oomDisabled,
      swap: server.swap,
      threads: server.threads,
    },
    container: {
      extraMounts: (Array.isArray(egg.extraMounts) ? egg.extraMounts : []) as {
        source: string;
        target: string;
      }[],
      image: server.image,
      mountPath: egg.mountPath,
      user: egg.containerUser === "image" ? "image" : "daemon",
      volumeOwner: parseOwner(egg.volumeOwner),
    },
    environment: env,
    invocation: resolvePlaceholders(server.startup, ctx),
    invocationMode:
      egg.invocationMode === "args" || egg.invocationMode === "shell"
        ? egg.invocationMode
        : "env",
    name: server.name,
    process: {
      configs: configFiles.map((file) => ({
        ...file,
        replace: file.replace.map((r) => ({
          ...r,
          value: resolvePlaceholders(r.value, ctx),
        })),
      })),
      startup: {
        done: asStringArray(egg.configStartupDone),
        stripAnsi: egg.stripAnsi,
      },
      stop: parseStop(egg.configStop),
    },
    skipEggScripts: server.skipScripts,
    suspended: server.status === "suspended",
    uuid: server.uuid,
  };
};

export const buildInstallScript = (server: ServerForConfig): InstallScript => {
  const { egg } = server;
  if (!egg) {
    throw new Error(`Server ${server.id} has no egg`);
  }
  return {
    containerImage: egg.scriptContainer,
    entrypoint: egg.scriptEntry,
    environment: resolvedEnvironment(placeholderContext(server)),
    script: egg.scriptInstall,
  };
};

// The daemon's /etc/nodebyte/daemon.json for a node.
export const buildNodeDaemonConfig = (node: {
  uuid: string;
  fqdn: string;
  daemonTokenId: string;
  daemonToken: string;
  daemonListen: number;
  daemonSftp: number;
  daemonBase: string;
  scheme: string;
  behindProxy: boolean;
  uploadSize: number;
}) => ({
  api: {
    host: "0.0.0.0",
    port: node.daemonListen,
    // Same certificate locations Pterodactyl's generated config assumes
    // (certbot certonly -d <fqdn>).
    ssl: {
      cert: `/etc/letsencrypt/live/${node.fqdn}/fullchain.pem`,
      enabled: node.scheme === "https" && !node.behindProxy,
      key: `/etc/letsencrypt/live/${node.fqdn}/privkey.pem`,
    },
    uploadLimitMb: node.uploadSize,
  },
  remote: API_URL,
  sftp: { port: node.daemonSftp },
  system: { data: node.daemonBase },
  token: nodeToken(node),
  tokenId: node.daemonTokenId,
  uuid: node.uuid,
});
