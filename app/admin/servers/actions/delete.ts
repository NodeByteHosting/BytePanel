"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { sendServerDeletedEmail } from "@/lib/mail";
import { getProviderForUser } from "@/lib/providers";
import { requireAdmin } from "@/lib/session";

const inputSchema = z.object({ serverId: z.string().min(1) });

export type AdminDeleteServerInput = z.infer<typeof inputSchema>;

export type AdminDeleteServerResult =
  | { ok: true }
  | { error: string; ok: false };

/**
 * Admin delete server action
 * Immediately deletes server from provider (bypassing workflow)
 * Used by admins to force-delete problematic servers
 */
export const adminDeleteServer = async (
  input: AdminDeleteServerInput
): Promise<AdminDeleteServerResult> => {
  await requireAdmin();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  const server = await prisma.server.findFirst({
    include: { user: { select: { email: true, id: true, name: true } } },
    where: { id: parsed.data.serverId },
  });

  if (!server) {
    return { error: "Not found", ok: false };
  }

  try {
    // Delete from provider if server exists there
    if (server.providerServerId) {
      const provider = await getProviderForUser(server.user.id);
      try {
        await provider.deleteServer(server.providerServerId);
      } catch (error) {
        // Log but don't fail - server might already be gone
        console.error(
          `[admin-delete] Provider delete failed for ${server.id}:`,
          error
        );
      }
    }

    // Mark as deleted in database
    await prisma.server.update({
      data: {
        deletedAt: new Date(),
        desiredState: "deleted",
      },
      where: { id: parsed.data.serverId },
    });

    // Clean up any associated records
    await prisma.serverMember.deleteMany({
      where: { serverId: parsed.data.serverId },
    });

    // Notify the server owner (fire-and-forget)
    void sendServerDeletedEmail({
      serverName: server.name,
      toEmail: server.user.email,
      userName: server.user.name,
    });

    revalidatePath("/admin/servers");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[admin-delete] Failed to delete server ${server.id}:`,
      error
    );
    return { error: message, ok: false };
  }
};
