import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GET /api/servers/[id]/metrics/live
 *
 * Returns current live server metrics (CPU, Memory, Network, etc.)
 * This endpoint would typically pull from an agent monitoring system
 * or container monitoring service.
 *
 * In a production system, this would:
 * - Query Prometheus/Grafana
 * - Call the server agent API
 * - Poll container stats (docker stats)
 * - Get game-specific metrics from the server
 */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  const { id } = await context.params;

  const server = await prisma.server.findFirst({
    select: {
      id: true,
      lastHeartbeatAt: true,
      observedState: true,
    },
    where: { deletedAt: null, id, userId: user.id },
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

  // Integrate with monitoring system (Prometheus, agent API, container stats, etc.)
  // For now, return mock data to demonstrate the API structure

  const uptime = (server.lastHeartbeatAt as Date | null)
    ? Math.floor(
        (Date.now() - (server.lastHeartbeatAt as Date).getTime()) / 1000
      )
    : 0;

  return NextResponse.json({
    metrics: {
      // System metrics (typically from container/host monitoring)
      // cpu: value from container/host monitoring
      // memory: value from container/host monitoring
      // networkIn: bytes per second
      // networkOut: bytes per second
      cpu: Math.random() * 50 + 10,
      memory: Math.random() * 40 + 20,
      networkIn: Math.random() * 1_000_000,
      networkOut: Math.random() * 500_000,
      uptime: Math.max(uptime, 0),

      // Game-specific metrics (if available)
      // playerCount: 0,
      // maxPlayers: 32,
      // tps: 20,
    },
  });
};
