import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  const { id } = await context.params;

  const server = await prisma.server.findFirst({
    include: {
      agent: {
        select: {
          cpuPercent: true,
          diskTotalBytes: true,
          diskUsedBytes: true,
          lastHeartbeatAt: true,
          maxPlayers: true,
          memTotalBytes: true,
          memUsedBytes: true,
          networkInBps: true,
          networkOutBps: true,
          playerCount: true,
          tps: true,
          uptimeSeconds: true,
        },
      },
    },
    where: {
      OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }],
      deletedAt: null,
      id,
    },
  });

  if (!server) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (server.observedState !== "running") {
    return NextResponse.json(
      { error: "Server is not running" },
      { status: 409 }
    );
  }

  const { agent } = server;
  if (!agent || !agent.lastHeartbeatAt) {
    return NextResponse.json({ metrics: null });
  }

  // Consider metrics stale if no heartbeat in the last 60 seconds
  const staleSec = (Date.now() - agent.lastHeartbeatAt.getTime()) / 1000;
  if (staleSec > 60) {
    return NextResponse.json({ metrics: null });
  }

  const memTotal = agent.memTotalBytes ?? 0;
  const memUsed = agent.memUsedBytes ?? 0;
  const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  return NextResponse.json({
    metrics: {
      cpu: agent.cpuPercent ?? 0,
      diskPercent:
        agent.diskTotalBytes && agent.diskTotalBytes > 0
          ? ((agent.diskUsedBytes ?? 0) / agent.diskTotalBytes) * 100
          : undefined,
      maxPlayers: agent.maxPlayers ?? undefined,
      memory: memPercent,
      networkIn: agent.networkInBps ?? 0,
      networkOut: agent.networkOutBps ?? 0,
      playerCount: agent.playerCount ?? undefined,
      tps: agent.tps ?? undefined,
      uptime: agent.uptimeSeconds ?? 0,
    },
  });
};
