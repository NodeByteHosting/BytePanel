import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SignJWT } from "jose";

import { websocketClaimsSchema } from "../../protocol";
import { configSchema } from "../src/config";
import { computeCpuPercent, computeMemoryBytes, splitImage } from "../src/docker";
import { checkBearer, TokenError, verifyPanelJwt } from "../src/http/auth";
import { Filesystem, FilesystemError } from "../src/server/filesystem";
import { splitArgs } from "../src/server/server";

describe("splitArgs", () => {
  test("splits on whitespace and honours quotes", () => {
    expect(splitArgs('+server.hostname "My Server" +rcon.password \'p a s s\' -flag')).toEqual([
      "+server.hostname",
      "My Server",
      "+rcon.password",
      "p a s s",
      "-flag",
    ]);
  });

  test("keeps empty quoted arguments and escapes", () => {
    expect(splitArgs('-password "" -motd a\\ b')).toEqual(["-password", "", "-motd", "a b"]);
  });
});

describe("splitImage", () => {
  test("handles tags, registries with ports and digests", () => {
    expect(splitImage("ghcr.io/pterodactyl/yolks:java_21")).toEqual(["ghcr.io/pterodactyl/yolks", "java_21"]);
    expect(splitImage("registry:5000/game")).toEqual(["registry:5000/game", "latest"]);
    expect(splitImage("alpine@sha256:abc")).toEqual(["alpine", "latest"]);
  });
});

describe("docker stats maths", () => {
  test("computes CPU like docker stats", () => {
    const pct = computeCpuPercent({
      cpu_stats: { cpu_usage: { total_usage: 2_000 }, online_cpus: 4, system_cpu_usage: 20_000 },
      memory_stats: {},
      precpu_stats: { cpu_usage: { total_usage: 1_000 }, system_cpu_usage: 10_000 },
    });
    expect(pct).toBe(40);
  });

  test("subtracts inactive page cache from memory", () => {
    expect(
      computeMemoryBytes({
        cpu_stats: { cpu_usage: { total_usage: 0 } },
        memory_stats: { stats: { inactive_file: 100 }, usage: 1_000 },
        precpu_stats: { cpu_usage: { total_usage: 0 } },
      })
    ).toBe(900);
  });
});

const config = configSchema.parse({
  remote: "https://panel.example.com",
  token: "t".repeat(64),
  tokenId: "abcdefghijklmnop",
  uuid: "0b6f4c8e-4f1a-4c11-9a5e-3f0d6a2b9c11",
});

describe("auth", () => {
  test("bearer token must match exactly", () => {
    const req = (value: string) => new Request("http://x", { headers: { authorization: value } });
    expect(checkBearer(req(`Bearer ${config.token}`), config)).toBe(true);
    expect(checkBearer(req(`Bearer ${config.token}x`), config)).toBe(false);
    expect(checkBearer(req("Basic abc"), config)).toBe(false);
  });

  const sign = (audience: string, key = config.token, exp = "5m") =>
    new SignJWT({ permissions: ["websocket.connect"], serverUuid: config.uuid, userUuid: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience(audience)
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(key));

  test("accepts panel-signed JWTs for this node", async () => {
    const claims = await verifyPanelJwt(await sign(config.uuid), config, websocketClaimsSchema);
    expect(claims.userUuid).toBe("user");
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
  });

  test("rejects other audiences, keys and expired tokens", async () => {
    await expect(verifyPanelJwt(await sign("other-node"), config, websocketClaimsSchema)).rejects.toBeInstanceOf(
      TokenError
    );
    await expect(
      verifyPanelJwt(await sign(config.uuid, "k".repeat(64)), config, websocketClaimsSchema)
    ).rejects.toBeInstanceOf(TokenError);
    await expect(verifyPanelJwt(await sign(config.uuid, config.token, "-1m"), config, websocketClaimsSchema)).rejects.toBeInstanceOf(
      TokenError
    );
  });
});

describe("Filesystem.safePath", () => {
  test("keeps paths inside the server root", async () => {
    const root = await mkdtemp(join(tmpdir(), "nb-fs-"));
    try {
      const fs = new Filesystem(root, () => null, () => 0);
      expect(await fs.safePath("/plugins/a.jar")).toBe(join(root, "plugins", "a.jar"));
      expect(await fs.safePath("../../etc/passwd")).toBe(join(root, "etc", "passwd"));
      expect(await fs.safePath("/")).toBe(root);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  test.skipIf(process.platform === "win32")("refuses symlinks that escape the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "nb-fs-"));
    const outside = await mkdtemp(join(tmpdir(), "nb-out-"));
    try {
      await symlink(outside, join(root, "escape"));
      const fs = new Filesystem(root, () => null, () => 0);
      await expect(fs.safePath("escape/secret")).rejects.toBeInstanceOf(FilesystemError);
    } finally {
      await rm(root, { force: true, recursive: true });
      await rm(outside, { force: true, recursive: true });
    }
  });

  test("enforces the disk limit on writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "nb-fs-"));
    try {
      const fs = new Filesystem(root, () => null, () => 10);
      await expect(fs.write("big.txt", "x".repeat(100))).rejects.toBeInstanceOf(FilesystemError);
      await fs.write("ok.txt", "hi");
      expect(await Bun.file(join(root, "ok.txt")).text()).toBe("hi");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
