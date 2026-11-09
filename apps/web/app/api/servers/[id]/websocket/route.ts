import { NextResponse } from "next/server";

import { signWebsocketToken } from "@/lib/daemon/jwt";
import { daemonWebsocketUrl } from "@/lib/daemon/urls";
import { getServerAccess } from "@/lib/servers/access";
import { daemonPermissionsFor } from "@/lib/servers/permissions";

export const runtime = "nodejs";

export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id } = await context.params;
  const access = await getServerAccess(id, "viewer");
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { server, role, isSystemAdmin, user } = access;
  if (!server.node) {
    return NextResponse.json(
      { error: "Server is not deployed to a node" },
      { status: 409 }
    );
  }
  if (server.status === "suspended" && !isSystemAdmin) {
    return NextResponse.json({ error: "Server is suspended" }, { status: 403 });
  }
  const token = await signWebsocketToken(server.node, {
    permissions: daemonPermissionsFor(role, isSystemAdmin),
    serverUuid: server.uuid,
    userUuid: user.id,
  });
  return NextResponse.json(
    { socket: daemonWebsocketUrl(server.node, server.uuid), token },
    { headers: { "cache-control": "no-store" } }
  );
};
