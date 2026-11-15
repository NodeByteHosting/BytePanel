import { NextResponse } from "next/server";

import { signTransferToken } from "@/lib/daemon/jwt";
import { daemonBaseUrl } from "@/lib/daemon/urls";
import { prisma } from "@/lib/db";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

export const GET = daemonRoute<{ id: string; backupId: string }>(
  "admin",
  async ({ access, params }) => {
    const { backupId } = params;
    const backup = await prisma.backup.findFirst({
      where: {
        deletedAt: null,
        id: backupId,
        isSuccessful: true,
        serverId: access.server.id,
      },
    });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    const token = await signTransferToken(access.server.node, {
      kind: "backup",
      path: backup.uuid,
      serverUuid: access.server.uuid,
      userUuid: access.user.id,
    });
    return NextResponse.json({
      url: `${daemonBaseUrl(access.server.node)}/download/backup?token=${token}`,
    });
  }
);
