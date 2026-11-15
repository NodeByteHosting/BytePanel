import { NextResponse } from "next/server";
import { z } from "zod";

import { emitActivity } from "@/lib/events/emit";
import { requestIp } from "@/lib/servers/access";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CONTENT_CHARS = 4_000_000;

export const GET = daemonRoute("admin", async ({ access, daemon, request }) => {
  const file = new URL(request.url).searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const content = await daemon.getFileContents(access.server.uuid, file);
  return NextResponse.json({ content, file });
});

const writeSchema = z.object({
  content: z.string().max(MAX_CONTENT_CHARS),
  file: z.string().min(1),
});

export const PUT = daemonRoute("admin", async ({ access, daemon, request }) => {
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await daemon.writeFile(
    access.server.uuid,
    parsed.data.file,
    parsed.data.content
  );
  await emitActivity({
    actorId: access.user.id,
    ip: requestIp(request.headers),
    message: `Edited ${parsed.data.file}`,
    phase: "server:file.write",
    serverId: access.server.id,
  });
  return NextResponse.json({ ok: true });
});
