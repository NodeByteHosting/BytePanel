"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import { DaemonError } from "@/lib/daemon/client";
import { sendServerDeletedEmail } from "@/lib/mail";
import { getServerAccess } from "@/lib/servers/access";
import { destroyServer } from "@/lib/servers/service";

const inputSchema = z.object({ serverId: z.string().min(1) });

export type DeleteServerInput = z.infer<typeof inputSchema>;

export type DeleteServerResult = { ok: true } | { error: string; ok: false };

export const deleteServer = async (
  input: DeleteServerInput
): Promise<DeleteServerResult> => {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }
  const access = await getServerAccess(parsed.data.serverId, "owner");
  if (!access) {
    return { error: "Not found", ok: false };
  }
  const { server, user } = access;

  try {
    await destroyServer(server.id);
  } catch (error) {
    if (error instanceof DaemonError) {
      return {
        error: `Could not remove the server from its node: ${error.message}`,
        ok: false,
      };
    }
    throw error;
  }

  await logEvent({
    action: "server.delete",
    actorEmail: user.email,
    actorId: user.id,
    targetId: server.id,
    targetType: "server",
  });

  void sendServerDeletedEmail({
    serverName: server.name,
    toEmail: user.email,
    userName: user.name,
  });

  revalidatePath("/dashboard", "layout");
  return { ok: true };
};
