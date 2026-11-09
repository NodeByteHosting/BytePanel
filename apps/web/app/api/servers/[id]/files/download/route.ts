import { NextResponse } from "next/server";

import { signTransferToken } from "@/lib/daemon/jwt";
import { daemonBaseUrl } from "@/lib/daemon/urls";
import { daemonRoute } from "@/lib/servers/route";

export const runtime = "nodejs";

// Signed, short-lived URL the browser downloads from the node directly.
export const GET = daemonRoute("admin", async ({ access, request }) => {
  const file = new URL(request.url).searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const { server, user } = access;
  const token = await signTransferToken(server.node, {
    kind: "download",
    path: file,
    serverUuid: server.uuid,
    userUuid: user.id,
  });
  return NextResponse.json({
    url: `${daemonBaseUrl(server.node)}/download/file?token=${token}`,
  });
});
