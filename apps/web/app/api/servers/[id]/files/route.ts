import { NextResponse } from "next/server";
import { z } from "zod";

import { emitActivity } from "@/lib/events/emit";
import { requestIp } from "@/lib/servers/access";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = daemonRoute("admin", async ({ access, daemon, request }) => {
  const directory = new URL(request.url).searchParams.get("directory") ?? "/";
  return NextResponse.json(
    await daemon.listDirectory(access.server.uuid, directory)
  );
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    files: z.array(z.string().min(1)).min(1),
    root: z.string(),
  }),
  z.object({
    action: z.literal("rename"),
    files: z
      .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
      .min(1),
    root: z.string(),
  }),
  z.object({
    action: z.literal("create-directory"),
    name: z.string().min(1),
    path: z.string(),
  }),
  z.object({
    action: z.literal("compress"),
    files: z.array(z.string().min(1)).min(1),
    root: z.string(),
  }),
  z.object({
    action: z.literal("decompress"),
    file: z.string().min(1),
    root: z.string(),
  }),
  z.object({
    action: z.literal("pull"),
    directory: z.string(),
    filename: z.string().min(1).optional(),
    url: z.string().url(),
  }),
]);

export const POST = daemonRoute(
  "admin",
  async ({ access, daemon, request }) => {
    const parsed = actionSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const body = parsed.data;
    const { uuid } = access.server;
    let result: unknown = { ok: true };
    let message: string;

    switch (body.action) {
      case "delete": {
        await daemon.deleteFiles(uuid, body.root, body.files);
        message = `Deleted ${body.files.length} file(s) in ${body.root}`;
        break;
      }
      case "rename": {
        await daemon.renameFiles(uuid, body.root, body.files);
        message = `Renamed ${body.files.map((f) => `${f.from} → ${f.to}`).join(", ")}`;
        break;
      }
      case "create-directory": {
        await daemon.createDirectory(uuid, body.path, body.name);
        message = `Created folder ${body.path}/${body.name}`;
        break;
      }
      case "compress": {
        result = {
          name: await daemon.compressFiles(uuid, body.root, body.files),
        };
        message = `Compressed ${body.files.length} file(s) in ${body.root}`;
        break;
      }
      case "decompress": {
        await daemon.decompressFile(uuid, body.root, body.file);
        message = `Decompressed ${body.file}`;
        break;
      }
      case "pull": {
        result = await daemon.pullFile(uuid, body);
        message = `Downloaded ${body.url} into ${body.directory}`;
        break;
      }
      default: {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }
    }

    await emitActivity({
      actorId: access.user.id,
      ip: requestIp(request.headers),
      message,
      phase: `server:file.${body.action}`,
      serverId: access.server.id,
    });
    return NextResponse.json(result);
  }
);
