"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

const sendRconCommandSchema = z.object({
  command: z.string().min(1).max(1024),
  serverId: z.string().min(1),
});

export type SendRconCommandInput = z.infer<typeof sendRconCommandSchema>;

export type SendRconCommandResult =
  | { ok: true; commandId: string }
  | { error: string; ok: false };

/**
 * Send an RCON command to a running game server.
 * The command is queued for execution by the server agent.
 *
 * @param input - The server ID and command to execute
 * @returns Success with command ID or error
 */
export const sendRconCommand = async (
  input: SendRconCommandInput
): Promise<SendRconCommandResult> => {
  const user = await requireUser();

  const parsed = sendRconCommandSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  const server = await prisma.server.findFirst({
    select: { id: true, observedState: true },
    where: { deletedAt: null, id: parsed.data.serverId, userId: user.id },
  });

  if (!server) {
    return { error: "Server not found", ok: false };
  }

  if (server.observedState !== "running") {
    return { error: "Server is not running", ok: false };
  }

  try {
    // RCON is not yet fully implemented in the protocol
    // For now, return a not-implemented error
    return { error: "RCON commands are not yet supported", ok: false };
  } catch {
    return { error: "Failed to queue command", ok: false };
  }
};
