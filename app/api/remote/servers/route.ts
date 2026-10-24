import { NextResponse } from "next/server";

import {
  buildServerConfiguration,
  serverConfigInclude,
} from "@/lib/daemon/configuration";
import { prisma } from "@/lib/db";
import { remoteHandler } from "@/lib/remote/handler";
import type { ServerConfigurationPage } from "@/protocol";

export const runtime = "nodejs";

const PER_PAGE = 50;

// Every server assigned to the calling node, paginated. The daemon loads this
// on boot.
export const GET = remoteHandler(async ({ node, request }) => {
  const page = Math.max(
    1,
    Number(new URL(request.url).searchParams.get("page")) || 1
  );
  const servers = await prisma.server.findMany({
    include: serverConfigInclude,
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE + 1,
    where: { deletedAt: null, eggId: { not: null }, nodeId: node.id },
  });
  const body: ServerConfigurationPage = {
    data: servers.slice(0, PER_PAGE).map(buildServerConfiguration),
    nextPage: servers.length > PER_PAGE ? page + 1 : null,
  };
  return NextResponse.json(body);
});
