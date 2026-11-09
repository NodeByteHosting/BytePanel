import { backupStatusSchema } from "@nodebyte/protocol";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { parseJson, remoteHandler } from "@/lib/remote/handler";

export const runtime = "nodejs";

// Daemon reports a finished (or failed) backup.
export const POST = remoteHandler<{ uuid: string }>(
  async ({ node, params, request }) => {
    const backup = await prisma.backup.findFirst({
      include: { server: true },
      where: { server: { nodeId: node.id }, uuid: params.uuid },
    });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    const body = await parseJson(request, backupStatusSchema);
    if ("response" in body) {
      return body.response;
    }
    await prisma.backup.update({
      data: {
        bytes: BigInt(body.data.size),
        checksum: body.data.checksum ? `sha1:${body.data.checksum}` : null,
        completedAt: new Date(),
        isSuccessful: body.data.successful,
      },
      where: { id: backup.id },
    });
    await emitActivity({
      message: body.data.successful
        ? `Backup "${backup.name}" completed`
        : `Backup "${backup.name}" failed`,
      phase: body.data.successful
        ? "server:backup.complete"
        : "server:backup.fail",
      serverId: backup.serverId,
      source: "daemon",
    });
    return new NextResponse(null, { status: 204 });
  }
);
