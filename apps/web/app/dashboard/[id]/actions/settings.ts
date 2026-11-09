"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { DaemonError } from "@/lib/daemon/client";
import { prisma } from "@/lib/db";
import { debugErrorMessage } from "@/lib/debug";
import { emitActivity } from "@/lib/events/emit";
import { getServerAccess, requestIp } from "@/lib/servers/access";
import {
  reinstallServer as reinstall,
  ServiceError,
  trySyncServer,
  updateStartup,
} from "@/lib/servers/service";

type Result = { ok: true } | { error: string; ok: false };

const failure = (error: unknown): Result => {
  if (error instanceof ServiceError || error instanceof DaemonError) {
    return { error: error.message, ok: false };
  }
  const debug = debugErrorMessage(error);
  if (debug) {
    return { error: debug, ok: false };
  }
  throw error;
};

const startupSchema = z.object({
  environment: z.record(z.string(), z.string()),
  image: z.string().min(1).optional(),
  serverId: z.string().min(1),
});

// Startup variables / docker image (Pterodactyl's "Startup" tab). Applied the
// next time the server starts.
export const updateServerStartup = async (
  input: z.infer<typeof startupSchema>
): Promise<Result> => {
  const parsed = startupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }
  const access = await getServerAccess(parsed.data.serverId, "admin");
  if (!access) {
    return { error: "Not found", ok: false };
  }
  try {
    await updateStartup(access.server.id, {
      asAdmin: access.isSystemAdmin,
      environment: parsed.data.environment,
      image: parsed.data.image,
    });
    await trySyncServer(access.server.id);
  } catch (error) {
    return failure(error);
  }
  await emitActivity({
    actorId: access.user.id,
    ip: requestIp(await headers()),
    message: "Updated startup variables",
    metadata: { variables: Object.keys(parsed.data.environment) },
    phase: "server:startup.edit",
    serverId: access.server.id,
  });
  revalidatePath(`/dashboard/${access.server.id}`, "layout");
  return { ok: true };
};

const renameSchema = z.object({
  description: z.string().max(500).nullable(),
  name: z.string().trim().min(3).max(40),
  serverId: z.string().min(1),
});

export const renameServer = async (
  input: z.infer<typeof renameSchema>
): Promise<Result> => {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Name must be 3–40 characters", ok: false };
  }
  const access = await getServerAccess(parsed.data.serverId, "admin");
  if (!access) {
    return { error: "Not found", ok: false };
  }
  await prisma.server.update({
    data: { description: parsed.data.description, name: parsed.data.name },
    where: { id: access.server.id },
  });
  await trySyncServer(access.server.id);
  await emitActivity({
    actorId: access.user.id,
    message: `Renamed server to "${parsed.data.name}"`,
    phase: "server:settings.rename",
    serverId: access.server.id,
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
};

const reinstallSchema = z.object({ serverId: z.string().min(1) });

export const reinstallServer = async (
  input: z.infer<typeof reinstallSchema>
): Promise<Result> => {
  const parsed = reinstallSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }
  const access = await getServerAccess(parsed.data.serverId, "admin");
  if (!access) {
    return { error: "Not found", ok: false };
  }
  try {
    await reinstall(access.server.id);
  } catch (error) {
    return failure(error);
  }
  await emitActivity({
    actorId: access.user.id,
    ip: requestIp(await headers()),
    message: "Reinstalled server",
    phase: "server:reinstall",
    serverId: access.server.id,
  });
  revalidatePath(`/dashboard/${access.server.id}`, "layout");
  return { ok: true };
};
