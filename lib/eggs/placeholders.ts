// Resolves Pterodactyl-style placeholders in startup commands and config
// file values:
//   {{SERVER_MEMORY}} {{SERVER_PORT}} {{SERVER_IP}} {{ANY_EGG_VARIABLE}}
//   {{server.build.default.port}} {{server.build.default.ip}}
//   {{server.build.memory}} {{server.build.env.VAR}} {{env.VAR}}
//   {{config.docker.interface}}
// NodeByte extension: {{SERVER_PORT_1}}, {{SERVER_PORT_2}}, … are the ports
// of the server's additional allocations (in assignment order).
// Unknown placeholders are left untouched so problems are visible.

export interface PlaceholderContext {
  env: Record<string, string>;
  ip: string;
  port: number;
  // All allocation ports, primary first.
  ports: number[];
  memory: number;
  dockerInterface: string;
  // Server display name ({{server.name}}).
  name: string;
}

const resolveKey = (
  key: string,
  ctx: PlaceholderContext
): string | undefined => {
  if (key in ctx.env) {
    return ctx.env[key];
  }
  const extraPort = /^SERVER_PORT_(?<index>\d+)$/u.exec(key);
  if (extraPort?.groups) {
    const port = ctx.ports[Number(extraPort.groups.index)];
    return port === undefined ? undefined : String(port);
  }
  switch (key) {
    case "SERVER_MEMORY":
    case "server.build.memory": {
      return String(ctx.memory);
    }
    case "SERVER_PORT":
    case "server.build.default.port":
    case "server.allocations.default.port": {
      return String(ctx.port);
    }
    case "SERVER_IP":
    case "server.build.default.ip":
    case "server.allocations.default.ip": {
      return ctx.ip;
    }
    case "config.docker.interface": {
      return ctx.dockerInterface;
    }
    case "server.name": {
      return ctx.name;
    }
    default: {
      break;
    }
  }
  const envMatch = /^(?:server\.build\.)?env\.(?<name>.+)$/u.exec(key);
  if (envMatch?.groups) {
    return ctx.env[envMatch.groups.name ?? ""];
  }
  return undefined;
};

export const resolvePlaceholders = (
  template: string,
  ctx: PlaceholderContext
): string =>
  template.replaceAll(
    /\{\{\s*(?<key>[\w.]+)\s*\}\}/gu,
    (whole, key: string) => resolveKey(key, ctx) ?? whole
  );
