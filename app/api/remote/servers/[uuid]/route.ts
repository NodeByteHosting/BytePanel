import { NextResponse } from "next/server";

import {
  buildServerConfiguration,
  serverConfigInclude,
} from "@/lib/daemon/configuration";
import { prisma } from "@/lib/db";
import { notFound, remoteHandler } from "@/lib/remote/handler";

export const runtime = "nodejs";

export const GET = remoteHandler<{ uuid: string }>(async ({ node, params }) => {
  const server = await prisma.server.findFirst({
    include: serverConfigInclude,
    where: { deletedAt: null, nodeId: node.id, uuid: params.uuid },
  });
  if (!server) {
    return notFound();
  }
  return NextResponse.json(buildServerConfiguration(server));
});
