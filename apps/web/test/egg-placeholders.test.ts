import { describe, expect, test } from "bun:test";

import { resolvePlaceholders } from "@/lib/eggs/placeholders";
import type { PlaceholderContext } from "@/lib/eggs/placeholders";

const ctx: PlaceholderContext = {
  dockerInterface: "172.18.0.1",
  env: { MAX_PLAYERS: "20", SERVER_JARFILE: "server.jar" },
  ip: "203.0.113.10",
  memory: 4096,
  name: "My Server",
  port: 25_565,
  ports: [25_565, 25_566, 25_567],
};

describe("resolvePlaceholders", () => {
  test("resolves Pterodactyl startup placeholders", () => {
    expect(
      resolvePlaceholders(
        "java -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}} --port {{SERVER_PORT}}",
        ctx
      )
    ).toBe("java -Xmx4096M -jar server.jar --port 25565");
  });

  test("resolves config-file style placeholders", () => {
    expect(
      resolvePlaceholders(
        "{{server.build.default.ip}}:{{server.build.default.port}}",
        ctx
      )
    ).toBe("203.0.113.10:25565");
    expect(
      resolvePlaceholders(
        "{{server.build.env.MAX_PLAYERS}} / {{env.MAX_PLAYERS}}",
        ctx
      )
    ).toBe("20 / 20");
    expect(resolvePlaceholders("{{config.docker.interface}}", ctx)).toBe(
      "172.18.0.1"
    );
    expect(resolvePlaceholders("{{server.name}}", ctx)).toBe("My Server");
  });

  test("resolves additional allocation ports", () => {
    expect(
      resolvePlaceholders("{{SERVER_PORT_1}},{{SERVER_PORT_2}}", ctx)
    ).toBe("25566,25567");
  });

  test("leaves unknown placeholders untouched", () => {
    expect(resolvePlaceholders("{{NOPE}} {{SERVER_PORT_9}}", ctx)).toBe(
      "{{NOPE}} {{SERVER_PORT_9}}"
    );
  });
});
