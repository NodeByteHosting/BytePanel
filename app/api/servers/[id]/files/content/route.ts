import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueCommand, waitForCommand } from "@/lib/agent/commands";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { filesReadResultSchema } from "@/protocol";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CONTENT_CHARS = 2_000_000;

const writeBodySchema = z.object({
  content: z.string().max(MAX_CONTENT_CHARS),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8"),
  path: z.string().min(1),
});

const requireOwnedServer = async (id: string) => {
  const user = await requireUser();
  const server = await prisma.server.findFirst({
    where: { deletedAt: null, id, userId: user.id },
  });

  if (!server) {
    return {
      error: NextResponse.json({ error: "Not Found" }, { status: 404 }),
    } as const;
  }

  return { server } as const;
};

export const GET = async (
  request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id } = await context.params;
  const owned = await requireOwnedServer(id);

  if ("error" in owned) {
    return owned.error;
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Path Required" }, { status: 400 });
  }

  const command = await enqueueCommand({
    payload: { path },
    serverId: id,
    type: "FILES_READ",
  });

  const outcome = await waitForCommand(command.id, 110_000);

  if (outcome.status === "timeout") {
    return NextResponse.json(
      { error: "Agent did not respond. Is the server online?" },
      { status: 504 }
    );
  }

  if (outcome.status === "failed") {
    return NextResponse.json(
      { error: outcome.error ?? "Read Failed" },
      { status: 500 }
    );
  }

  const parsed = filesReadResultSchema.safeParse(outcome.result);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid result" }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
};

export const PUT = async (
  request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id } = await context.params;
  const owned = await requireOwnedServer(id);

  if ("error" in owned) {
    return owned.error;
  }

  const json = await request.json().catch(() => null);
  const parsedBody = writeBodySchema.safeParse(json);

  if (!parsedBody.success) {
    return NextResponse.json(
      { details: parsedBody.error.flatten(), error: "Invalid body" },
      { status: 400 }
    );
  }

  const command = await enqueueCommand({
    payload: parsedBody.data,
    serverId: id,
    type: "FILES_WRITE",
  });

  const outcome = await waitForCommand(command.id, 110_000);

  if (outcome.status === "timeout") {
    return NextResponse.json(
      { error: "Agent did not respond. Is the server online?" },
      { status: 504 }
    );
  }

  if (outcome.status === "failed") {
    return NextResponse.json(
      { error: outcome.error ?? "Write Failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};
