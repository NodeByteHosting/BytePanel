"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { start } from "workflow/api";
import { z } from "zod";

import { getGame, validateSettings } from "@/games";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendServerCreatedEmail } from "@/lib/mail";
import { requireUser } from "@/lib/session";
import { provisionServer } from "@/lib/workflows/provision-server";

const inputSchema = z.object({
  serverId: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type ApproveProvisionInput = z.infer<typeof inputSchema>;

export type ApproveProvisionResult =
  | { ok: true }
  | { error: string; ok: false };

export const approveProvision = async (
  input: ApproveProvisionInput
): Promise<ApproveProvisionResult> => {
  const user = await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  const server = await prisma.server.findFirst({
    include: { user: { select: { email: true, name: true } } },
    where: { deletedAt: null, id: parsed.data.serverId, userId: user.id },
  });
  if (!server) {
    return { error: "Not found", ok: false };
  }

  if (server.phase !== "pending") {
    return { error: "Server is not awaiting approval", ok: false };
  }

  // Save game-config settings the user reviewed on this page before launching
  if (parsed.data.settings && Object.keys(parsed.data.settings).length > 0) {
    const game = getGame(server.game);
    if (game) {
      const validation = validateSettings(game.settings, parsed.data.settings);
      if (!validation.ok) {
        return { error: validation.error, ok: false };
      }
      await prisma.server.update({
        data: {
          settings: {
            ...(server.settings as Record<string, unknown> | null),
            ...validation.data,
          } as Prisma.InputJsonValue,
        },
        where: { id: parsed.data.serverId },
      });
    }
  }

  // Transition to queued and kick off the provisioning workflow
  await prisma.server.update({
    data: { phase: "queued" },
    where: { id: parsed.data.serverId },
  });

  await start(provisionServer, [{ serverId: parsed.data.serverId }]);

  // Notify the user that provisioning has started (fire-and-forget)
  if (server.user) {
    void sendServerCreatedEmail({
      game: server.game,
      region: server.location,
      serverName: server.name,
      serverUrl: `${env.BETTER_AUTH_URL}/dashboard/${parsed.data.serverId}`,
      toEmail: server.user.email,
      userName: server.user.name,
    });
  }

  revalidatePath("/dashboard", "layout");

  return { ok: true };
};
