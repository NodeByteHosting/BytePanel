import { daemonActivityBatchSchema } from "@bytepanel/protocol";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { parseJson, remoteHandler } from "@/lib/remote/handler";

export const runtime = "nodejs";

const SFTP_ACTIONS: Record<string, string> = {
  "server:sftp.create-directory": "Created directories",
  "server:sftp.delete": "Deleted",
  "server:sftp.rename": "Renamed",
  "server:sftp.write": "Wrote",
};

const describe = (
  event: string,
  metadata?: Record<string, unknown>
): string => {
  if (event === "server:console.command") {
    return `Ran console command: ${String(metadata?.command ?? "").slice(0, 200)}`;
  }
  const power = /^server:power\.(?<action>\w+)$/u.exec(event);
  if (power) {
    return `Sent power action: ${power.groups?.action}`;
  }
  const sftp = SFTP_ACTIONS[event];
  if (sftp) {
    const files = Array.isArray(metadata?.files) ? metadata.files : [];
    const count = Number(metadata?.count ?? files.length);
    const shown = files.slice(0, 5).join(", ");
    return `${sftp} over SFTP: ${shown}${count > 5 ? ` and ${count - 5} more` : ""}`;
  }
  return event;
};

export const POST = remoteHandler(async ({ node, request }) => {
  const body = await parseJson(request, daemonActivityBatchSchema);
  if ("response" in body) {
    return body.response;
  }
  const uuids = [...new Set(body.data.data.map((e) => e.serverUuid))];
  const servers = await prisma.server.findMany({
    select: { id: true, uuid: true },
    where: { nodeId: node.id, uuid: { in: uuids } },
  });
  const byUuid = new Map(servers.map((s) => [s.uuid, s.id]));

  for (const entry of body.data.data) {
    const serverId = byUuid.get(entry.serverUuid);
    if (!serverId) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop
    await emitActivity({
      actorId: entry.userUuid ?? null,
      ip: entry.ip ?? null,
      message: describe(entry.event, entry.metadata),
      metadata: entry.metadata,
      occurredAt: new Date(entry.timestamp),
      phase: entry.event,
      serverId,
      source: "daemon",
    });
  }
  return new NextResponse(null, { status: 204 });
});
