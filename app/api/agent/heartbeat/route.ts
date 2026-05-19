import { NextResponse } from "next/server";

import { AgentAuthError, verifyAgentRequest } from "@/lib/agent/signing";
import { prisma } from "@/lib/db";
import { heartbeatSchema } from "@/protocol";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  let body: string;
  let verified: Awaited<ReturnType<typeof verifyAgentRequest>>["verified"];
  try {
    ({ verified, body } = await verifyAgentRequest(request));
  } catch (error) {
    if (error instanceof AgentAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }

  const parsed = heartbeatSchema.safeParse(JSON.parse(body));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await prisma.agent.update({
    data: {
      cpuPercent: parsed.data.cpuPercent ?? undefined,
      diskTotalBytes: parsed.data.diskTotalBytes ?? undefined,
      diskUsedBytes: parsed.data.diskUsedBytes ?? undefined,
      lastCommandId: parsed.data.lastCommandId ?? undefined,
      lastHeartbeatAt: new Date(),
      maxPlayers: parsed.data.maxPlayers ?? undefined,
      memTotalBytes: parsed.data.memTotalBytes ?? undefined,
      memUsedBytes: parsed.data.memUsedBytes ?? undefined,
      networkInBps: parsed.data.networkInBps ?? undefined,
      networkOutBps: parsed.data.networkOutBps ?? undefined,
      playerCount: parsed.data.playerCount ?? undefined,
      tps: parsed.data.tps ?? undefined,
      uptimeSeconds: parsed.data.uptimeSeconds,
    },
    where: { id: verified.agentId },
  });

  return NextResponse.json({ ok: true });
};
