/* oxlint-disable no-await-in-loop */
import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import {
  DAEMON_TOKEN_ID_LENGTH,
  DAEMON_TOKEN_LENGTH,
} from "@bytepanel/protocol";
import type { Prisma, ServerMemberRole, ServerStatus } from "@prisma/client";
import { SQL } from "bun";
import { ulid } from "ulid";

import { prisma } from "@/lib/db";
import { parsePtdlEgg } from "@/lib/eggs/ptdl";
import { parseMysqlDump } from "@/lib/import/mysql-dump";

type Tx = Prisma.TransactionClient;
type Flag = number | boolean;

interface PtUser {
  id: number;
  email: string;
  username: string;
  name_first: string | null;
  name_last: string | null;
  password: string;
  root_admin: Flag;
  created_at: Date | null;
}
interface PtLocation {
  id: number;
  short: string;
  long: string | null;
}
interface PtNode {
  id: number;
  uuid: string;
  public: Flag;
  name: string;
  description: string | null;
  location_id: number;
  fqdn: string;
  scheme: string;
  behind_proxy: Flag;
  maintenance_mode: Flag;
  memory: number;
  memory_overallocate: number;
  disk: number;
  disk_overallocate: number;
  upload_size: number;
  daemonListen: number;
  daemonSFTP: number;
  daemonBase: string;
}
interface PtAllocation {
  id: number;
  node_id: number;
  ip: string;
  ip_alias: string | null;
  port: number;
  server_id: number | null;
  notes: string | null;
}
interface PtNest {
  id: number;
  name: string;
  description: string | null;
  author: string;
}
interface PtEgg {
  id: number;
  nest_id: number;
  author: string;
  name: string;
  description: string | null;
  features: unknown;
  docker_images: unknown;
  file_denylist: unknown;
  config_files: string | null;
  config_startup: string | null;
  config_stop: string | null;
  config_from: number | null;
  startup: string | null;
  script_container: string;
  script_entry: string;
  script_install: string | null;
  copy_script_from: number | null;
}
interface PtEggVariable {
  id: number;
  egg_id: number;
  name: string;
  description: string | null;
  env_variable: string;
  default_value: string | null;
  user_viewable: Flag;
  user_editable: Flag;
  rules: string;
}
interface PtServer {
  id: number;
  external_id: string | null;
  uuid: string;
  node_id: number;
  name: string;
  description: string | null;
  status: string | null;
  skip_scripts: Flag;
  owner_id: number;
  memory: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
  threads: string | null;
  oom_disabled: Flag;
  allocation_id: number;
  egg_id: number;
  startup: string;
  image: string;
  allocation_limit: number | null;
  backup_limit: number;
  installed_at: Date | null;
  created_at: Date | null;
}
interface PtServerVariable {
  server_id: number;
  variable_id: number;
  variable_value: string | null;
}
interface PtBackup {
  server_id: number;
  uuid: string;
  name: string;
  ignored_files: unknown;
  is_successful: Flag;
  is_locked: Flag;
  checksum: string | null;
  bytes: number | bigint | null;
  completed_at: Date | null;
  created_at: Date | null;
  deleted_at: Date | null;
}
interface PtSubuser {
  user_id: number;
  server_id: number;
  permissions: unknown;
}

// Tables with no BytePanel equivalent, or whose data can't carry over.
const SKIPPED: Record<string, string> = {
  "activity_logs, activity_log_subjects, audit_logs, api_logs": "history only",
  "api_keys, user_ssh_keys, recovery_tokens":
    "credential formats differ; users recreate these",
  "database_hosts, databases": "BytePanel has no managed databases",
  "mounts, egg_mount, mount_node, mount_server":
    "re-create as egg extraMounts by hand",
  "schedules, tasks, tasks_log": "BytePanel has no schedules",
  "server_transfers, auto_allocations, auto_allocation_additional":
    "transient Pterodactyl state",
  "sessions, password_resets, jobs, failed_jobs, notifications, migrations, settings":
    "panel runtime state",
  "users.totp_secret": "2FA is not enabled in BytePanel; users re-enrol",
};

const SERVER_STATUSES = new Set<string>([
  "installing",
  "install_failed",
  "reinstall_failed",
  "suspended",
  "restoring_backup",
]);

const TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

class DryRunRollbackError extends Error {
  constructor() {
    super("Dry run");
    this.name = "DryRunRollbackError";
  }
}

const { values: args } = parseArgs({
  options: {
    "dry-run": { default: false, type: "boolean" },
    prefix: { default: "", type: "string" },
    source: { type: "string" },
  },
});

const sourceUrl = args.source ?? process.env.PTERODACTYL_DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
if (!sourceUrl) {
  throw new Error(
    "Pass --source mysql://... or --source dump.sql, or set PTERODACTYL_DATABASE_URL"
  );
}
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET must be set (it encrypts node tokens)");
}

const randomString = (length: number): string => {
  let out = "";
  for (const byte of randomBytes(length)) {
    out += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  }
  return out;
};

// Mirrors lib/crypto.ts, which is server-only and can't be imported here.
const encryptSecret = (plaintext: string): string => {
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      authSecret,
      "bytepanel.user-secrets.v1",
      "user-secrets",
      32
    )
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64"
  );
};

const maybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const stringArray = (value: unknown): string[] => {
  const parsed = maybeJson(value);
  return Array.isArray(parsed)
    ? parsed.filter((v): v is string => typeof v === "string")
    : [];
};

const json = (value: unknown) => value as Prisma.InputJsonValue;

const need = <K, V>(map: Map<K, V>, key: K, what: string): V => {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Missing ${what} ${String(key)}`);
  }
  return value;
};

const memberRole = (permissions: string[]): ServerMemberRole => {
  if (permissions.some((p) => p.startsWith("user.") && p !== "user.read")) {
    return "admin";
  }
  const readOnly = permissions.every(
    (p) => /\.read(?:-content)?$/u.test(p) || p === "websocket.connect"
  );
  return readOnly ? "viewer" : "member";
};

const TABLES = [
  "allocations",
  "backups",
  "egg_variables",
  "eggs",
  "locations",
  "nests",
  "nodes",
  "server_variables",
  "servers",
  "subusers",
  "users",
];

interface Source {
  read: (name: string) => Promise<unknown[]>;
  close: () => Promise<void>;
}

const databaseSource = (url: string): Source => {
  const db = new SQL(url);
  return {
    close: () => db.close(),
    read: (name) =>
      db.unsafe(`SELECT * FROM \`${args.prefix}${name}\` ORDER BY 1`),
  };
};

const dumpSource = async (path: string): Promise<Source> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Dump file not found: ${path}`);
  }
  let bytes = await file.bytes();
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = Bun.gunzipSync(bytes);
  }
  const tables = parseMysqlDump(
    new TextDecoder().decode(bytes),
    new Set(TABLES.map((name) => `${args.prefix}${name}`))
  );
  return {
    close: () => Promise.resolve(),
    read: (name) => {
      const rows = tables.get(`${args.prefix}${name}`);
      return rows
        ? Promise.resolve(rows)
        : Promise.reject(
            new Error(
              `Table ${args.prefix}${name} is not in the dump (wrong --prefix?)`
            )
          );
    },
  };
};

const source = /^(?:mysql|mariadb):\/\//iu.test(sourceUrl)
  ? databaseSource(sourceUrl)
  : await dumpSource(sourceUrl);
const table = async <T>(name: string) => (await source.read(name)) as T[];

console.log("Reading Pterodactyl data...");
const pt = {
  allocations: await table<PtAllocation>("allocations"),
  backups: await table<PtBackup>("backups"),
  eggVariables: await table<PtEggVariable>("egg_variables"),
  eggs: await table<PtEgg>("eggs"),
  locations: await table<PtLocation>("locations"),
  nests: await table<PtNest>("nests"),
  nodes: await table<PtNode>("nodes"),
  serverVariables: await table<PtServerVariable>("server_variables"),
  servers: await table<PtServer>("servers"),
  subusers: await table<PtSubuser>("subusers"),
  users: await table<PtUser>("users"),
};
await source.close();

const counts: Record<string, number> = {};
const bump = (key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};
const warnings: string[] = [];
const newNodes: string[] = [];

const migrateUsers = async (tx: Tx) => {
  const ids = new Map<number, string>();
  for (const row of pt.users) {
    const name =
      `${row.name_first ?? ""} ${row.name_last ?? ""}`.trim() || row.username;
    const role = row.root_admin ? "admin" : "user";
    const user = await tx.user.upsert({
      create: {
        createdAt: row.created_at ?? undefined,
        email: row.email.toLowerCase(),
        emailVerified: true,
        id: ulid(),
        name,
        role,
      },
      select: { id: true },
      update: { name, role },
      where: { email: row.email.toLowerCase() },
    });
    ids.set(row.id, user.id);
    // Keep the bcrypt hash; lib/auth.ts verifies it. Never overwrite a
    // password the user may have changed since an earlier run.
    const existing = await tx.account.findFirst({
      where: { providerId: "credential", userId: user.id },
    });
    if (!existing) {
      await tx.account.create({
        data: {
          accountId: user.id,
          id: ulid(),
          password: row.password,
          providerId: "credential",
          userId: user.id,
        },
      });
    }
    bump("users");
  }
  return ids;
};

const migrateLocations = async (tx: Tx) => {
  const ids = new Map<number, string>();
  for (const row of pt.locations) {
    const location = await tx.location.upsert({
      create: { id: ulid(), long: row.long, short: row.short },
      select: { id: true },
      update: { long: row.long },
      where: { short: row.short },
    });
    ids.set(row.id, location.id);
    bump("locations");
  }
  return ids;
};

const migrateNodes = async (tx: Tx, locationIds: Map<number, string>) => {
  const ids = new Map<number, string>();
  for (const row of pt.nodes) {
    const data = {
      behindProxy: Boolean(row.behind_proxy),
      daemonBase: row.daemonBase,
      daemonListen: row.daemonListen,
      daemonSftp: row.daemonSFTP,
      description: row.description,
      disk: row.disk,
      diskOverallocate: row.disk_overallocate,
      fqdn: row.fqdn,
      locationId: need(locationIds, row.location_id, "location"),
      maintenanceMode: Boolean(row.maintenance_mode),
      memory: row.memory,
      memoryOverallocate: row.memory_overallocate,
      name: row.name,
      public: Boolean(row.public),
      scheme: row.scheme,
      uploadSize: row.upload_size,
    };
    const existing = await tx.node.findUnique({
      select: { id: true },
      where: { uuid: row.uuid },
    });
    if (existing) {
      await tx.node.update({ data, where: { id: existing.id } });
      ids.set(row.id, existing.id);
    } else {
      // Wings tokens are encrypted with Laravel's APP_KEY and the BytePanel
      // daemon is a different agent anyway, so every node gets a fresh token.
      const id = ulid();
      await tx.node.create({
        data: {
          ...data,
          daemonToken: encryptSecret(randomString(DAEMON_TOKEN_LENGTH)),
          daemonTokenId: randomString(DAEMON_TOKEN_ID_LENGTH),
          id,
          uuid: row.uuid,
        },
      });
      ids.set(row.id, id);
      newNodes.push(row.name);
    }
    bump("nodes");
  }
  return ids;
};

const migrateAllocations = async (tx: Tx, nodeIds: Map<number, string>) => {
  const ids = new Map<number, string>();
  for (const row of pt.allocations) {
    const nodeId = need(nodeIds, row.node_id, "node");
    const allocation = await tx.allocation.upsert({
      create: {
        id: ulid(),
        ip: row.ip,
        ipAlias: row.ip_alias,
        nodeId,
        notes: row.notes,
        port: row.port,
      },
      select: { id: true },
      update: { ipAlias: row.ip_alias, notes: row.notes },
      where: { nodeId_ip_port: { ip: row.ip, nodeId, port: row.port } },
    });
    ids.set(row.id, allocation.id);
    bump("allocations");
  }
  return ids;
};

const migrateNests = async (tx: Tx) => {
  const ids = new Map<number, string>();
  for (const row of pt.nests) {
    const nest = await tx.nest.upsert({
      create: {
        author: row.author,
        description: row.description,
        id: ulid(),
        name: row.name,
      },
      select: { id: true },
      update: {},
      where: { name: row.name },
    });
    ids.set(row.id, nest.id);
    bump("nests");
  }
  return ids;
};

// Shapes a database egg like a Pterodactyl export so parsePtdlEgg can convert
// it, resolving config_from / copy_script_from inheritance first.
const exportShape = (row: PtEgg, byId: Map<number, PtEgg>) => {
  const configParent = row.config_from ? byId.get(row.config_from) : undefined;
  const scriptParent = row.copy_script_from
    ? byId.get(row.copy_script_from)
    : undefined;
  const images = maybeJson(row.docker_images);
  return {
    author: row.author,
    config: {
      files: row.config_files ?? configParent?.config_files ?? undefined,
      startup: row.config_startup ?? configParent?.config_startup ?? undefined,
      stop: row.config_stop ?? configParent?.config_stop ?? undefined,
    },
    description: row.description,
    docker_images: Array.isArray(images)
      ? Object.fromEntries(images.map((image: string) => [image, image]))
      : (images as Record<string, string>),
    features: stringArray(row.features),
    file_denylist: stringArray(row.file_denylist),
    name: row.name,
    scripts: {
      installation: {
        container: (scriptParent ?? row).script_container,
        entrypoint: (scriptParent ?? row).script_entry,
        script: (scriptParent ?? row).script_install,
      },
    },
    startup: row.startup,
    variables: pt.eggVariables
      .filter((v) => v.egg_id === row.id)
      .map((v) => ({
        default_value: v.default_value,
        description: v.description,
        env_variable: v.env_variable,
        name: v.name,
        rules: v.rules,
        user_editable: v.user_editable,
        user_viewable: v.user_viewable,
      })),
  };
};

const migrateEggs = async (tx: Tx, nestIds: Map<number, string>) => {
  const eggIds = new Map<number, string>();
  const variableIds = new Map<number, string>();
  const byId = new Map(pt.eggs.map((egg) => [egg.id, egg]));
  for (const row of pt.eggs) {
    const nestId = need(nestIds, row.nest_id, "nest");
    const parsed = parsePtdlEgg(exportShape(row, byId));
    warnings.push(...parsed.warnings.map((w) => `Egg "${row.name}": ${w}`));
    const data = {
      author: parsed.author,
      configFiles: json(parsed.configFiles),
      configStartupDone: json(parsed.configStartupDone),
      configStop: parsed.configStop,
      description: parsed.description,
      dockerImages: json(parsed.dockerImages),
      features: json(parsed.features),
      fileDenylist: json(parsed.fileDenylist),
      name: parsed.name,
      nestId,
      scriptContainer: parsed.scriptContainer,
      scriptEntry: parsed.scriptEntry,
      scriptInstall: parsed.scriptInstall,
      startup: parsed.startup,
    };
    const existing = await tx.egg.findFirst({
      select: { id: true },
      where: { name: row.name, nestId },
    });
    const eggId = existing?.id ?? ulid();
    await (existing
      ? tx.egg.update({ data, where: { id: eggId } })
      : tx.egg.create({ data: { ...data, id: eggId } }));
    eggIds.set(row.id, eggId);
    bump("eggs");

    // parsePtdlEgg keeps variable order, so index i maps back to sources[i].
    const sources = pt.eggVariables.filter((v) => v.egg_id === row.id);
    for (const [index, variable] of parsed.variables.entries()) {
      const saved = await tx.eggVariable.upsert({
        create: { ...variable, eggId, id: ulid() },
        select: { id: true },
        update: variable,
        where: {
          eggId_envVariable: { eggId, envVariable: variable.envVariable },
        },
      });
      const sourceId = sources[index]?.id;
      if (sourceId !== undefined) {
        variableIds.set(sourceId, saved.id);
      }
      bump("egg variables");
    }
  }
  return { eggIds, variableIds };
};

const migrateServers = async (
  tx: Tx,
  ids: {
    allocations: Map<number, string>;
    eggs: Map<number, string>;
    nodes: Map<number, string>;
    users: Map<number, string>;
  }
) => {
  const serverIds = new Map<number, string>();
  for (const row of pt.servers) {
    const data = {
      allocationLimit:
        row.allocation_limit ??
        Math.max(
          1,
          pt.allocations.filter((a) => a.server_id === row.id).length
        ),
      backupLimit: row.backup_limit,
      cpu: row.cpu,
      description: row.description,
      disk: row.disk,
      eggId: need(ids.eggs, row.egg_id, "egg"),
      externalId: row.external_id,
      image: row.image,
      installedAt: row.installed_at,
      io: row.io,
      memory: row.memory,
      name: row.name,
      nodeId: need(ids.nodes, row.node_id, "node"),
      oomDisabled: Boolean(row.oom_disabled),
      skipScripts: Boolean(row.skip_scripts),
      startup: row.startup,
      status:
        row.status && SERVER_STATUSES.has(row.status)
          ? (row.status as ServerStatus)
          : null,
      swap: row.swap,
      threads: row.threads,
      userId: need(ids.users, row.owner_id, "user"),
    };
    const server = await tx.server.upsert({
      create: {
        ...data,
        createdAt: row.created_at ?? undefined,
        id: ulid(),
        uuid: row.uuid,
      },
      select: { id: true },
      update: data,
      where: { uuid: row.uuid },
    });
    serverIds.set(row.id, server.id);
    bump("servers");
  }

  for (const row of pt.allocations) {
    if (row.server_id === null) {
      continue;
    }
    await tx.allocation.update({
      data: { serverId: need(serverIds, row.server_id, "server") },
      where: { id: need(ids.allocations, row.id, "allocation") },
    });
  }
  for (const row of pt.servers) {
    await tx.server.update({
      data: { allocationId: ids.allocations.get(row.allocation_id) ?? null },
      where: { id: need(serverIds, row.id, "server") },
    });
  }
  return serverIds;
};

const migrateServerVariables = async (
  tx: Tx,
  serverIds: Map<number, string>,
  variableIds: Map<number, string>
) => {
  for (const row of pt.serverVariables) {
    const serverId = serverIds.get(row.server_id);
    const variableId = variableIds.get(row.variable_id);
    if (!(serverId && variableId)) {
      continue;
    }
    const value = row.variable_value ?? "";
    await tx.serverVariable.upsert({
      create: { id: ulid(), serverId, value, variableId },
      update: { value },
      where: { serverId_variableId: { serverId, variableId } },
    });
    bump("server variables");
  }
};

const migrateBackups = async (tx: Tx, serverIds: Map<number, string>) => {
  for (const row of pt.backups) {
    const data = {
      bytes: BigInt(row.bytes ?? 0),
      checksum: row.checksum,
      completedAt: row.completed_at,
      deletedAt: row.deleted_at,
      ignoredFiles: stringArray(row.ignored_files).join("\n"),
      isLocked: Boolean(row.is_locked),
      isSuccessful: Boolean(row.is_successful),
      name: row.name,
      serverId: need(serverIds, row.server_id, "server"),
    };
    await tx.backup.upsert({
      create: {
        ...data,
        createdAt: row.created_at ?? undefined,
        id: ulid(),
        uuid: row.uuid,
      },
      update: data,
      where: { uuid: row.uuid },
    });
    bump("backups");
  }
};

const migrateSubusers = async (
  tx: Tx,
  serverIds: Map<number, string>,
  userIds: Map<number, string>
) => {
  for (const row of pt.subusers) {
    const serverId = need(serverIds, row.server_id, "server");
    const userId = need(userIds, row.user_id, "user");
    const role = memberRole(stringArray(row.permissions));
    await tx.serverMember.upsert({
      create: { id: ulid(), role, serverId, userId },
      update: { role },
      where: { serverId_userId: { serverId, userId } },
    });
    bump("server members");
  }
};

try {
  await prisma.$transaction(
    async (tx) => {
      const users = await migrateUsers(tx);
      const locations = await migrateLocations(tx);
      const nodes = await migrateNodes(tx, locations);
      const allocations = await migrateAllocations(tx, nodes);
      const nests = await migrateNests(tx);
      const { eggIds, variableIds } = await migrateEggs(tx, nests);
      const servers = await migrateServers(tx, {
        allocations,
        eggs: eggIds,
        nodes,
        users,
      });
      await migrateServerVariables(tx, servers, variableIds);
      await migrateBackups(tx, servers);
      await migrateSubusers(tx, servers, users);
      if (args["dry-run"]) {
        throw new DryRunRollbackError();
      }
    },
    { maxWait: 10_000, timeout: 30 * 60_000 }
  );
} catch (error) {
  if (!(error instanceof DryRunRollbackError)) {
    throw error;
  }
} finally {
  await prisma.$disconnect();
}

console.table(counts);
for (const warning of warnings) {
  console.warn(`warn: ${warning}`);
}
console.log("\nNot migrated:");
for (const [tables, reason] of Object.entries(SKIPPED)) {
  console.log(`  ${tables}: ${reason}`);
}
if (args["dry-run"]) {
  console.log("\nDry run: all changes were rolled back.");
} else if (newNodes.length > 0) {
  console.log(
    `\nNew nodes need the BytePanel daemon configured from the admin panel: ${newNodes.join(", ")}`
  );
}
