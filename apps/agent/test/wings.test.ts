import { describe, expect, test } from "bun:test";

import { configSchema } from "../src/config";
import { planWingsImport, wingsConfigSchema } from "../src/wings";

const NODE = "3f2c8a1e-6b1d-4c3a-9a51-0d6e2b7f9c10";

const agentConfig = (ssl = true) =>
  configSchema.parse({
    api: {
      ssl: {
        cert: "/etc/letsencrypt/live/node.example.com/fullchain.pem",
        enabled: ssl,
        key: "/etc/letsencrypt/live/node.example.com/privkey.pem",
      },
    },
    remote: "https://panel.example.com",
    system: { data: "/var/lib/pterodactyl/volumes" },
    token: "x".repeat(64),
    tokenId: "abcdefgh12345678",
    uuid: NODE,
  });

const WINGS_YAML = `
debug: false
uuid: ${NODE}
token_id: oldtokenid
token: oldtoken
api:
  host: 0.0.0.0
  port: 8080
  ssl:
    enabled: true
    cert: /etc/ssl/custom/node.crt
    key: /etc/ssl/custom/node.key
  upload_limit: 100
system:
  data: /srv/pterodactyl/volumes
  sftp:
    bind_port: 2022
  timezone: Europe/London
  user:
    uid: 997
    gid: 996
docker:
  network:
    name: pterodactyl_nw
    dns:
      - 9.9.9.9
allowed_origins:
  - https://panel.example.com
remote: https://old-panel.example.com
`;

const wings = () => wingsConfigSchema.parse(Bun.YAML.parse(WINGS_YAML));

describe("wingsConfigSchema", () => {
  test("parses a real config and fills Wings' default paths", () => {
    const parsed = wings();
    expect(parsed.system.backup_directory).toBe("/var/lib/pterodactyl/backups");
    expect(parsed.system.root_directory).toBe("/var/lib/pterodactyl");
    expect(parsed.system.user).toEqual({ gid: 996, uid: 997 });
  });

  test("accepts a minimal config", () => {
    const parsed = wingsConfigSchema.parse({ uuid: NODE });
    expect(parsed.system.data).toBe("/var/lib/pterodactyl/volumes");
  });
});

describe("planWingsImport", () => {
  test("carries over data path, ownership, timezone, dns, origins and certs", () => {
    const { config, notes } = planWingsImport(wings(), agentConfig());
    expect(config.system.data).toBe("/srv/pterodactyl/volumes");
    expect(config.system.user).toEqual({ gid: 996, uid: 997 });
    expect(config.system.timezone).toBe("Europe/London");
    expect(config.system.backups).toBe("/var/lib/bytepanel/backups");
    expect(config.docker.dns).toEqual(["9.9.9.9"]);
    expect(config.allowedOrigins).toEqual(["https://panel.example.com"]);
    expect(config.api.ssl).toEqual({
      cert: "/etc/ssl/custom/node.crt",
      enabled: true,
      key: "/etc/ssl/custom/node.key",
    });
    expect(config.token).toBe("x".repeat(64));
    expect(notes.join("\n")).toContain("daemon base");
    expect(() => configSchema.parse(config)).not.toThrow();
  });

  test("leaves TLS off when the panel says the node is behind a proxy", () => {
    const { config } = planWingsImport(wings(), agentConfig(false));
    expect(config.api.ssl.enabled).toBe(false);
  });

  test("refuses a Wings config from another node unless forced", () => {
    const other = { ...wings(), uuid: "00000000-0000-4000-8000-000000000000" };
    expect(() => planWingsImport(other, agentConfig())).toThrow(/--force/u);
    expect(planWingsImport(other, agentConfig(), true).notes[0]).toContain("--force");
  });
});
