import { NextResponse } from "next/server";

import { signTransferToken } from "@/lib/daemon/jwt";
import { daemonBaseUrl } from "@/lib/daemon/urls";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

// Signed URL the browser POSTs multipart uploads to (straight to the node).
export const GET = daemonRoute("admin", async ({ access, request }) => {
  const directory = new URL(request.url).searchParams.get("directory") ?? "/";
  const { server, user } = access;
  const token = await signTransferToken(server.node, {
    kind: "upload",
    path: directory,
    serverUuid: server.uuid,
    userUuid: user.id,
  });
  return NextResponse.json({
    maxBytes: server.node.uploadSize * 1024 * 1024,
    url: `${daemonBaseUrl(server.node)}/upload/file?token=${token}`,
  });
});
