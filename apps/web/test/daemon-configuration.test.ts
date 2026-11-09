import { describe, expect, test } from "bun:test";

import { serverConfigurationSchema } from "@nodebyte/protocol";

import {
  buildInstallScript,
  buildServerConfiguration,
} from "@/lib/daemon/configuration";
import type { ServerForConfig } from "@/lib/daemon/configuration";

const now = new Date();

const allocation = (id: string, port: number) => ({
  createdAt: now,
  id,
  ip: "0.0.0.0",
  ipAlias: "play.example.com",
  nodeId: "node",
  notes: null,
  port,
  serverId: "srv",
  updatedAt: now,
});

const variable = (id: string, envVariable: string, defaultValue: string) => ({
  createdAt: now,
  defaultValue,
  description: "",
  eggId: "egg",
  envVariable,
  id,
  name: envVariable,
  rules: "nullable|string",
  sort: 0,
  updatedAt: now,
  userEditable: true,
  userViewable: true,
});

const makeServer = (
  overrides: Partial<ServerForConfig> = {}
): ServerForConfig => {
  const primary = allocation("a1", 27_015);
  return {
    allocation: primary,
    allocationId: primary.id,
    allocationLimit: 2,
    allocations: [allocation("a2", 27_016), primary],
    backupLimit: 2,
    cpu: 200,
    createdAt: now,
    deletedAt: null,
    description: null,
    disk: 20_480,
    egg: {
      author: "x",
      configFiles: [
        {
          file: "server.cfg",
          parser: "file",
          replace: [{ match: "hostname", value: 'hostname "{{server.name}}"' }],
        },
      ],
      configStartupDone: ["Server ready"],
      configStop: "^SIGTERM",
      containerPorts: [0, 27_020],
      containerUser: "image",
      createdAt: now,
      description: null,
      dockerImages: { Default: "example/game:latest" },
      enabled: true,
      extraMounts: [{ source: "server", target: "/opt/game" }],
      features: [],
      fileDenylist: [],
      id: "egg",
      image: null,
      invocationMode: "args",
      minDisk: 0,
      minMemory: 0,
      mountPath: "/data",
      name: "Game",
      nestId: "nest",
      scriptContainer: "alpine:3",
      scriptEntry: "sh",
      scriptInstall: "echo hi",
      slug: "game",
      startup:
        "+port {{SERVER_PORT}} +tv {{SERVER_PORT_1}} +max {{MAX_PLAYERS}}",
      stripAnsi: false,
      updatedAt: now,
      variables: [
        variable("v1", "MAX_PLAYERS", "10"),
        variable("v2", "GAME_PORT", "{{SERVER_PORT}}"),
        variable("v3", "HOSTNAME", "{{server.name}}"),
      ],
      volumeOwner: "1000:1000",
    },
    eggId: "egg",
    errorReason: null,
    id: "srv",
    image: "example/game:latest",
    installedAt: null,
    io: 500,
    lastSuspendedAt: null,
    memory: 4096,
    name: "My Server",
    nodeId: "node",
    oomDisabled: true,
    planId: null,
    skipScripts: false,
    startup: "+port {{SERVER_PORT}} +tv {{SERVER_PORT_1}} +max {{MAX_PLAYERS}}",
    status: null,
    swap: 0,
    threads: null,
    updatedAt: now,
    userId: "user",
    uuid: "0b6f4c8e-4f1a-4c11-9a5e-3f0d6a2b9c11",
    variables: [
      {
        createdAt: now,
        id: "sv1",
        serverId: "srv",
        updatedAt: now,
        value: "32",
        variableId: "v1",
      },
    ],
    ...overrides,
  } as ServerForConfig;
};

describe("buildServerConfiguration", () => {
  test("produces a payload the daemon accepts", () => {
    const config = buildServerConfiguration(makeServer());
    expect(() => serverConfigurationSchema.parse(config)).not.toThrow();
  });

  test("orders allocations primary-first and maps fixed container ports", () => {
    const { allocations } = buildServerConfiguration(makeServer());
    expect(allocations.default).toEqual({ ip: "0.0.0.0", port: 27_015 });
    expect(allocations.mappings).toEqual([
      { containerPort: 27_015, ip: "0.0.0.0", port: 27_015 },
      { containerPort: 27_020, ip: "0.0.0.0", port: 27_016 },
    ]);
  });

  test("resolves placeholders in startup, variables and config files", () => {
    const config = buildServerConfiguration(makeServer());
    expect(config.invocation).toBe("+port 27015 +tv 27016 +max 32");
    expect(config.environment).toEqual({
      GAME_PORT: "27015",
      HOSTNAME: "My Server",
      MAX_PLAYERS: "32",
    });
    expect(config.process.configs[0]?.replace[0]?.value).toBe(
      'hostname "My Server"'
    );
  });

  test("maps egg container settings and stop signal", () => {
    const config = buildServerConfiguration(makeServer());
    expect(config.container).toEqual({
      extraMounts: [{ source: "server", target: "/opt/game" }],
      image: "example/game:latest",
      mountPath: "/data",
      user: "image",
      volumeOwner: { gid: 1000, uid: 1000 },
    });
    expect(config.invocationMode).toBe("args");
    expect(config.process.stop).toEqual({ type: "signal", value: "SIGTERM" });
    expect(config.build).toMatchObject({
      cpuLimit: 200,
      diskSpace: 20_480,
      memoryLimit: 4096,
    });
  });

  test("flags suspended servers", () => {
    expect(
      buildServerConfiguration(makeServer({ status: "suspended" })).suspended
    ).toBe(true);
  });

  test("builds the install script with resolved environment", () => {
    const script = buildInstallScript(makeServer());
    expect(script).toEqual({
      containerImage: "alpine:3",
      entrypoint: "sh",
      environment: {
        GAME_PORT: "27015",
        HOSTNAME: "My Server",
        MAX_PLAYERS: "32",
      },
      script: "echo hi",
    });
  });
});
