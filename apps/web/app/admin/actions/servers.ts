"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";
import { DaemonError } from "@/lib/daemon/client";
import { prisma } from "@/lib/db";
import { debugErrorMessage } from "@/lib/debug";
import { sendServerDeletedEmail } from "@/lib/mail";
import {
  deployServer,
  destroyServer,
  prepareServer,
  reinstallServer,
  ServiceError,
  setSuspended,
  updateBuild,
} from "@/lib/servers/service";
import { requireAdmin } from "@/lib/session";

import type { ActionResult } from "./infrastructure";

const failure = (error: unknown) => {
  if (error instanceof ServiceError || error instanceof DaemonError) {
    return { error: error.message, ok: false } as const;
  }
  const debug = debugErrorMessage(error);
  if (debug) {
    return { error: debug, ok: false } as const;
  }
  throw error;
};

const audit = (
  user: { id: string; email: string },
  action: AuditAction,
  serverId: string,
  metadata?: Record<string, unknown>
) =>
  logEvent({
    action,
    actorEmail: user.email,
    actorId: user.id,
    metadata,
    targetId: serverId,
    targetType: "server",
  });

const limitsSchema = z.object({
  allocationLimit: z.coerce.number().int().min(1).max(20),
  backupLimit: z.coerce.number().int().min(0).max(100),
  cpu: z.coerce.number().int().min(0),
  disk: z.coerce.number().int().min(0),
  io: z.coerce.number().int().min(10).max(1000).default(500),
  memory: z.coerce.number().int().min(0),
  oomDisabled: z.boolean().default(true),
  swap: z.coerce.number().int().min(-1).default(0),
  threads: z.string().trim().max(100).nullable().default(null),
});

const createSchema = z.object({
  eggId: z.string().min(1),
  environment: z.record(z.string(), z.string()).default({}),
  image: z.string().min(1).optional(),
  limits: limitsSchema,
  locationId: z.string().nullable(),
  name: z.string().trim().min(3).max(40),
  nodeId: z.string().nullable(),
  ownerEmail: z.string().email(),
  planId: z.string().nullable(),
  startOnCompletion: z.boolean().default(true),
});

export type AdminCreateServerInput = z.input<typeof createSchema>;

export const adminCreateServer = async (
  input: AdminCreateServerInput
): Promise<ActionResult<{ id: string }>> => {
  const user = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      ok: false,
    };
  }
  const owner = await prisma.user.findUnique({
    where: { email: parsed.data.ownerEmail.toLowerCase() },
  });
  if (!owner) {
    return { error: "No user with that email", ok: false };
  }
  let id: string;
  try {
    id = await prepareServer({
      asAdmin: true,
      eggId: parsed.data.eggId,
      environment: parsed.data.environment,
      image: parsed.data.image,
      limits: parsed.data.limits,
      name: parsed.data.name,
      planId: parsed.data.planId,
      userId: owner.id,
    });
    await deployServer(id, {
      locationId: parsed.data.locationId,
      nodeId: parsed.data.nodeId ?? undefined,
      startOnCompletion: parsed.data.startOnCompletion,
    });
  } catch (error) {
    return failure(error);
  }
  await audit(user, "admin.server.create", id, { ownerId: owner.id });
  revalidatePath("/admin/servers");
  return { data: { id }, ok: true };
};

export const adminDeployServer = async (
  serverId: string,
  nodeId?: string
): Promise<ActionResult> => {
  const user = await requireAdmin();
  try {
    await deployServer(serverId, { nodeId });
  } catch (error) {
    return failure(error);
  }
  await audit(user, "admin.server.create", serverId, { redeploy: true });
  revalidatePath(`/admin/servers/${serverId}`);
  return { ok: true };
};

export const adminDeleteServer = async (input: {
  serverId: string;
  force?: boolean;
}): Promise<ActionResult> => {
  const user = await requireAdmin();
  const server = await prisma.server.findFirst({
    include: { user: { select: { email: true, name: true } } },
    where: { deletedAt: null, id: input.serverId },
  });
  if (!server) {
    return { error: "Not found", ok: false };
  }
  try {
    await destroyServer(server.id, { force: input.force });
  } catch (error) {
    if (error instanceof DaemonError) {
      return {
        error: `${error.message}. Use force delete to remove it from the panel anyway.`,
        ok: false,
      };
    }
    return failure(error);
  }
  await prisma.serverMember.deleteMany({ where: { serverId: server.id } });
  await audit(user, "admin.server.delete", server.id, {
    force: input.force ?? false,
  });
  void sendServerDeletedEmail({
    serverName: server.name,
    toEmail: server.user.email,
    userName: server.user.name,
  });
  revalidatePath("/admin/servers");
  return { ok: true };
};

export const adminSetSuspended = async (
  serverId: string,
  suspended: boolean
): Promise<ActionResult> => {
  const user = await requireAdmin();
  try {
    await setSuspended(serverId, suspended);
  } catch (error) {
    if (!(error instanceof DaemonError)) {
      throw error;
    }
  }
  await audit(
    user,
    suspended ? "admin.server.suspend" : "admin.server.unsuspend",
    serverId
  );
  revalidatePath(`/admin/servers/${serverId}`);
  return { ok: true };
};

export const adminReinstallServer = async (
  serverId: string
): Promise<ActionResult> => {
  const user = await requireAdmin();
  try {
    await reinstallServer(serverId);
  } catch (error) {
    return failure(error);
  }
  await audit(user, "admin.server.reinstall", serverId);
  revalidatePath(`/admin/servers/${serverId}`);
  return { ok: true };
};

export const adminUpdateBuild = async (
  serverId: string,
  input: z.input<typeof limitsSchema>
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = limitsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      ok: false,
    };
  }
  try {
    await updateBuild(serverId, parsed.data);
  } catch (error) {
    if (!(error instanceof DaemonError)) {
      return failure(error);
    }
  }
  await audit(user, "admin.server.build_changed", serverId, parsed.data);
  revalidatePath(`/admin/servers/${serverId}`);
  return { ok: true };
};
