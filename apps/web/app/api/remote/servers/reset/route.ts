import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { remoteHandler } from "@/lib/remote/handler";

export const runtime = "nodejs";

export const POST = remoteHandler(async ({ node }) => {
  await prisma.$transaction([
    prisma.server.updateMany({
      data: {
        errorReason: "Install was interrupted by a node restart",
        status: "install_failed",
      },
      where: { deletedAt: null, nodeId: node.id, status: "installing" },
    }),
    prisma.server.updateMany({
      data: { status: null },
      where: { deletedAt: null, nodeId: node.id, status: "restoring_backup" },
    }),
  ]);
  return new NextResponse(null, { status: 204 });
});
