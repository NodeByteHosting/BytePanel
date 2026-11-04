"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { DaemonError, daemonFor } from "@/lib/daemon/client";
import { emitActivity } from "@/lib/events/emit";
import { getServerAccess, requestIp } from "@/lib/servers/access";
import { POWER_ACTIONS } from "@/protocol";

const inputSchema = z.object({
  action: z.enum(POWER_ACTIONS),
  serverId: z.string().min(1),
});

export type PowerServerInput = z.infer<typeof inputSchema>;

export type PowerServerResult = { ok: true } | { error: string; ok: false };

// HTTP fallback for power actions (the console normally sends them over the
// daemon websocket).
export const sendPowerAction = async (
  input: PowerServerInput
): Promise<PowerServerResult> => {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }
  const access = await getServerAccess(parsed.data.serverId, "member");
  if (!access) {
    return { error: "Not found", ok: false };
  }
  const { server, user } = access;
  if (!server.node) {
    return { error: "Server is not deployed yet", ok: false };
  }
  if (server.status && server.status !== "install_failed") {
    return {
      error: `Server is ${server.status.replaceAll("_", " ")}`,
      ok: false,
    };
  }
  try {
    await daemonFor(server.node).power(server.uuid, parsed.data.action);
  } catch (error) {
    if (error instanceof DaemonError) {
      return { error: error.message, ok: false };
    }
    throw error;
  }
  await emitActivity({
    actorId: user.id,
    ip: requestIp(await headers()),
    message: `Sent power action: ${parsed.data.action}`,
    phase: `server:power.${parsed.data.action}`,
    serverId: server.id,
  });
  return { ok: true };
};
