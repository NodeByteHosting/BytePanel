"use server";

import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";
import { generateDaemonToken } from "@/lib/daemon/tokens";
import { prisma } from "@/lib/db";
import { parsePorts } from "@/lib/servers/ports";
import { requireAdmin } from "@/lib/session";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const fail = (error: string) => ({ error, ok: false }) as const;

const audit = (
  user: { id: string; email: string },
  action: AuditAction,
  targetId: string,
  metadata?: Record<string, unknown>
) =>
  logEvent({
    action,
    actorEmail: user.email,
    actorId: user.id,
    metadata,
    targetId,
    targetType: action.split(".")[1],
  });

const locationSchema = z.object({
  long: z.string().trim().max(100).optional(),
  short: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[a-z0-9-]+$/u, "Use lowercase letters, numbers and dashes"),
});

export const createLocation = async (
  input: z.infer<typeof locationSchema>
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (
    await prisma.location.findUnique({ where: { short: parsed.data.short } })
  ) {
    return fail("A location with that code already exists");
  }
  const id = ulid();
  await prisma.location.create({
    data: { id, long: parsed.data.long || null, short: parsed.data.short },
  });
  await audit(user, "admin.location.create", id, parsed.data);
  revalidatePath("/admin/locations");
  return { ok: true };
};

export const deleteLocation = async (id: string): Promise<ActionResult> => {
  const user = await requireAdmin();
  if (await prisma.node.count({ where: { locationId: id } })) {
    return fail("Move or delete this location's nodes first");
  }
  await prisma.location.delete({ where: { id } });
  await audit(user, "admin.location.delete", id);
  revalidatePath("/admin/locations");
  return { ok: true };
};

const nodeSchema = z.object({
  behindProxy: z.boolean().default(false),
  daemonBase: z.string().trim().min(1).default("/var/lib/bytepanel/volumes"),
  daemonListen: z.coerce.number().int().min(1).max(65_535).default(8080),
  daemonSftp: z.coerce.number().int().min(1).max(65_535).default(2022),
  description: z.string().trim().max(500).optional(),
  disk: z.coerce.number().int().min(1024),
  diskOverallocate: z.coerce.number().int().min(-1).default(0),
  fqdn: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9.-]+$/u, "Enter a hostname or IP address"),
  locationId: z.string().min(1),
  maintenanceMode: z.boolean().default(false),
  memory: z.coerce.number().int().min(512),
  memoryOverallocate: z.coerce.number().int().min(-1).default(0),
  name: z.string().trim().min(1).max(100),
  public: z.boolean().default(true),
  scheme: z.enum(["https", "http"]),
  uploadSize: z.coerce.number().int().min(1).max(10_240).default(100),
});

export type NodeInput = z.input<typeof nodeSchema>;

export const createNode = async (
  input: NodeInput
): Promise<ActionResult<{ id: string }>> => {
  const user = await requireAdmin();
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (
    parsed.data.scheme === "https" &&
    isIP(parsed.data.fqdn) &&
    !parsed.data.behindProxy
  ) {
    return fail(
      "HTTPS needs a domain name (certificates can't be issued for a bare IP)"
    );
  }
  const { daemonToken, daemonTokenId } = generateDaemonToken();
  const id = ulid();
  await prisma.node.create({
    data: {
      ...parsed.data,
      daemonToken,
      daemonTokenId,
      description: parsed.data.description || null,
      id,
      uuid: randomUUID(),
    },
  });
  await audit(user, "admin.node.create", id, {
    fqdn: parsed.data.fqdn,
    name: parsed.data.name,
  });
  revalidatePath("/admin/nodes");
  return { data: { id }, ok: true };
};

export const updateNode = async (
  id: string,
  input: NodeInput
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = nodeSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await prisma.node.update({
    data: { ...parsed.data, description: parsed.data.description || null },
    where: { id },
  });
  await audit(user, "admin.node.update", id);
  revalidatePath(`/admin/nodes/${id}`);
  return { ok: true };
};

export const resetNodeToken = async (id: string): Promise<ActionResult> => {
  const user = await requireAdmin();
  const { daemonToken, daemonTokenId } = generateDaemonToken();
  await prisma.node.update({
    data: { daemonToken, daemonTokenId },
    where: { id },
  });
  await audit(user, "admin.node.reset_token", id);
  revalidatePath(`/admin/nodes/${id}`);
  return { ok: true };
};

export const deleteNode = async (id: string): Promise<ActionResult> => {
  const user = await requireAdmin();
  if (await prisma.server.count({ where: { deletedAt: null, nodeId: id } })) {
    return fail("This node still has servers. Delete or move them first.");
  }
  await prisma.server.updateMany({
    data: { nodeId: null },
    where: { nodeId: id },
  });
  await prisma.node.delete({ where: { id } });
  await audit(user, "admin.node.delete", id);
  revalidatePath("/admin/nodes");
  return { ok: true };
};

const allocationSchema = z.object({
  alias: z.string().trim().max(255).optional(),
  ip: z
    .string()
    .trim()
    .refine((v) => isIP(v) !== 0, "Enter a valid IP address"),
  nodeId: z.string().min(1),
  ports: z.string().min(1),
});

export const createAllocations = async (
  input: z.infer<typeof allocationSchema>
): Promise<ActionResult<{ created: number }>> => {
  const user = await requireAdmin();
  const parsed = allocationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  let ports: number[];
  try {
    ports = parsePorts(parsed.data.ports);
  } catch (error) {
    return fail((error as Error).message);
  }
  const { count } = await prisma.allocation.createMany({
    data: ports.map((port) => ({
      id: ulid(),
      ip: parsed.data.ip,
      ipAlias: parsed.data.alias || null,
      nodeId: parsed.data.nodeId,
      port,
    })),
    skipDuplicates: true,
  });
  await audit(user, "admin.allocation.create", parsed.data.nodeId, {
    count,
    ip: parsed.data.ip,
    ports: parsed.data.ports,
  });
  revalidatePath(`/admin/nodes/${parsed.data.nodeId}`);
  return { data: { created: count }, ok: true };
};

export const deleteAllocations = async (
  nodeId: string,
  ids: string[]
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const { count } = await prisma.allocation.deleteMany({
    where: { id: { in: ids }, nodeId, serverId: null },
  });
  if (count < ids.length) {
    await audit(user, "admin.allocation.delete", nodeId, { count });
    revalidatePath(`/admin/nodes/${nodeId}`);
    return fail(
      `Deleted ${count}; allocations assigned to servers can't be deleted`
    );
  }
  await audit(user, "admin.allocation.delete", nodeId, { count });
  revalidatePath(`/admin/nodes/${nodeId}`);
  return { ok: true };
};

export const setAllocationAlias = async (
  nodeId: string,
  id: string,
  alias: string
): Promise<ActionResult> => {
  await requireAdmin();
  await prisma.allocation.updateMany({
    data: { ipAlias: alias.trim() || null },
    where: { id, nodeId },
  });
  revalidatePath(`/admin/nodes/${nodeId}`);
  return { ok: true };
};
