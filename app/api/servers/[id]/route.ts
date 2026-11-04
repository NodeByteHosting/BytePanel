import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getServerAccess } from "@/lib/servers/access";

export const runtime = "nodejs";

export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id } = await context.params;
  const access = await getServerAccess(id, "viewer");
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const server = await prisma.server.findUniqueOrThrow({
    select: {
      allocation: { select: { ip: true, ipAlias: true, port: true } },
      cpu: true,
      disk: true,
      egg: { select: { image: true, name: true } },
      errorReason: true,
      id: true,
      memory: true,
      name: true,
      nodeId: true,
      status: true,
      uuid: true,
    },
    where: { id },
  });
  return NextResponse.json({ server });
};
