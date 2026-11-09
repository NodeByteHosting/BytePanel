import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { requestIp } from "@/lib/servers/access";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

const bodySchema = z.object({ truncate: z.boolean().default(false) });

export const POST = daemonRoute<{ id: string; backupId: string }>(
  "admin",
  async ({ access, daemon, params, request }) => {
    const { backupId } = params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { server } = access;
    if (server.status) {
      return NextResponse.json(
        { error: `Server is ${server.status.replaceAll("_", " ")}` },
        { status: 409 }
      );
    }
    const backup = await prisma.backup.findFirst({
      where: {
        deletedAt: null,
        id: backupId,
        isSuccessful: true,
        serverId: server.id,
      },
    });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    await prisma.server.update({
      data: { status: "restoring_backup" },
      where: { id: server.id },
    });
    try {
      await daemon.restoreBackup(
        server.uuid,
        backup.uuid,
        parsed.data.truncate
      );
    } catch (error) {
      await prisma.server.update({
        data: { status: null },
        where: { id: server.id },
      });
      throw error;
    }
    await emitActivity({
      actorId: access.user.id,
      ip: requestIp(request.headers),
      message: `Restoring backup "${backup.name}"`,
      phase: "server:backup.restore",
      serverId: server.id,
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  }
);
