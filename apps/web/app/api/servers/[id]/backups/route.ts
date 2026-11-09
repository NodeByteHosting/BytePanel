import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { requestIp } from "@/lib/servers/access";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

const serialize = (backup: {
  id: string;
  uuid: string;
  name: string;
  isSuccessful: boolean;
  isLocked: boolean;
  checksum: string | null;
  bytes: bigint;
  completedAt: Date | null;
  createdAt: Date;
}) => ({
  bytes: Number(backup.bytes),
  checksum: backup.checksum,
  completedAt: backup.completedAt?.toISOString() ?? null,
  createdAt: backup.createdAt.toISOString(),
  id: backup.id,
  isLocked: backup.isLocked,
  isSuccessful: backup.isSuccessful,
  name: backup.name,
  uuid: backup.uuid,
});

export type BackupView = ReturnType<typeof serialize>;

export const GET = daemonRoute("admin", async ({ access }) => {
  const backups = await prisma.backup.findMany({
    orderBy: { createdAt: "desc" },
    where: { deletedAt: null, serverId: access.server.id },
  });
  return NextResponse.json({
    backups: backups.map(serialize),
    limit: access.server.backupLimit,
  });
});

const createSchema = z.object({
  ignored: z.string().max(10_000).default(""),
  name: z.string().trim().max(100).optional(),
});

export const POST = daemonRoute(
  "admin",
  async ({ access, daemon, request }) => {
    const parsed = createSchema.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { server } = access;
    const count = await prisma.backup.count({
      where: { deletedAt: null, serverId: server.id },
    });
    if (count >= server.backupLimit) {
      return NextResponse.json(
        {
          error:
            server.backupLimit === 0
              ? "Your plan doesn't include backups."
              : `Backup limit reached (${server.backupLimit}). Delete an old backup first.`,
        },
        { status: 400 }
      );
    }
    const backup = await prisma.backup.create({
      data: {
        id: ulid(),
        ignoredFiles: parsed.data.ignored,
        name:
          parsed.data.name ||
          `Backup ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
        serverId: server.id,
        uuid: randomUUID(),
      },
    });
    try {
      await daemon.createBackup(server.uuid, backup.uuid, parsed.data.ignored);
    } catch (error) {
      await prisma.backup.delete({ where: { id: backup.id } });
      throw error;
    }
    await emitActivity({
      actorId: access.user.id,
      ip: requestIp(request.headers),
      message: `Started backup "${backup.name}"`,
      phase: "server:backup.start",
      serverId: server.id,
    });
    return NextResponse.json({ backup: serialize(backup) }, { status: 202 });
  }
);
