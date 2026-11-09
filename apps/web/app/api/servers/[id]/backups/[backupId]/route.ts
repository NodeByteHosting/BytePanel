import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { requestIp } from "@/lib/servers/access";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

interface Params {
  id: string;
  backupId: string;
}

export const DELETE = daemonRoute<Params>(
  "admin",
  async ({ access, daemon, params, request }) => {
    const backup = await prisma.backup.findFirst({
      where: {
        deletedAt: null,
        id: params.backupId,
        serverId: access.server.id,
      },
    });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    if (backup.isLocked) {
      return NextResponse.json(
        { error: "Unlock the backup before deleting it" },
        { status: 400 }
      );
    }
    await daemon.deleteBackup(access.server.uuid, backup.uuid);
    await prisma.backup.update({
      data: { deletedAt: new Date() },
      where: { id: backup.id },
    });
    await emitActivity({
      actorId: access.user.id,
      ip: requestIp(request.headers),
      message: `Deleted backup "${backup.name}"`,
      phase: "server:backup.delete",
      serverId: access.server.id,
    });
    return NextResponse.json({ ok: true });
  }
);

const patchSchema = z.object({ isLocked: z.boolean() });

// Lock / unlock (locked backups can't be deleted).
export const PATCH = daemonRoute<Params>(
  "admin",
  async ({ access, params, request }) => {
    const parsed = patchSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { count } = await prisma.backup.updateMany({
      data: { isLocked: parsed.data.isLocked },
      where: {
        deletedAt: null,
        id: params.backupId,
        serverId: access.server.id,
      },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }
);
