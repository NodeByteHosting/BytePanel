export interface PlaceholderContext {
  env: Record<string, string>;
  ip: string;
  port: number;
  ports: number[];
  memory: number;
  dockerInterface: string;
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
