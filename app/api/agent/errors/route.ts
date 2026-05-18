/**
 * Agent error reporting endpoint
 * Agents call this during provisioning/baking to report errors
 */

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAgentRequest } from "@/lib/agent/signing";
import { prisma } from "@/lib/db";

const errorReportSchema = z.object({
  details: z.record(z.string(), z.unknown()).optional(),
  errorCode: z.string().min(1),
  errorMessage: z.string().min(1),
  phase: z.enum([
    "provisioning",
    "baking",
    "agent_bootstrap",
    "install",
    "unknown",
  ]),
  timestamp: z.number().optional(),
});

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  try {
    // Verify agent identity and integrity
    const { verified, body } = await verifyAgentRequest(request);

    // Parse the error report
    const data = JSON.parse(body);
    const parsed = errorReportSchema.safeParse(data);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid error report format" },
        { status: 400 }
      );
    }

    const { errorCode, errorMessage, phase, details, timestamp } = parsed.data;
    const now = new Date();

    // Find the server for this agent
    const agent = await prisma.agent.findUnique({
      include: { server: true },
      where: { id: verified.agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Create error record
    await prisma.agentError.create({
      data: {
        agentId: verified.agentId,
        details: (details ?? {}) as unknown as Prisma.InputJsonValue,
        errorCode,
        errorMessage,
        id: randomUUID(),
        phase,
        recordedAt: now,
        reportedAt: timestamp ? new Date(timestamp) : now,
        serverId: agent.serverId,
      },
    });

    // Update server phase to "errored" if not already marked as failed
    if (agent.server.observedState !== "failed") {
      await prisma.server.update({
        data: {
          observedState: "failed",
          phase: "errored",
        },
        where: { id: agent.serverId },
      });
    }

    // Log for debugging
    console.log(
      `[agent-error] Server ${agent.serverId} reported error in ${phase}:`,
      {
        details,
        errorCode,
        errorMessage,
      }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.constructor.name === "AgentAuthError") {
      const status = (error as { status?: number }).status ?? 401;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("[agent-error] Error processing report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
