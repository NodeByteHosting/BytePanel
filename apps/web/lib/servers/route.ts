import "server-only";
import type { Node } from "@prisma/client";
import { NextResponse } from "next/server";

import type { DaemonClient } from "@/lib/daemon/client";
import { DaemonError, daemonFor } from "@/lib/daemon/client";
import type { ServerRole } from "@/lib/server-roles";

import type { ServerAccess } from "./access";
import { getServerAccess } from "./access";
import { ServiceError } from "./service";

type Handler<P> = (ctx: {
  request: Request;
  params: P;
  access: ServerAccess & { server: ServerAccess["server"] & { node: Node } };
  daemon: DaemonClient;
}) => Promise<Response>;

export const daemonRoute =
  <P extends { id: string } = { id: string }>(
    minRole: ServerRole,
    handler: Handler<P>
  ) =>
  async (request: Request, context: { params: Promise<P> }) => {
    const params = await context.params;
    const { id } = params;
    const access = await getServerAccess(id, minRole);
    if (!access) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { server } = access;
    if (!server.node) {
      return NextResponse.json(
        { error: "Server is not deployed yet" },
        { status: 409 }
      );
    }
    if (server.status === "suspended" && !access.isSystemAdmin) {
      return NextResponse.json(
        { error: "Server is suspended" },
        { status: 403 }
      );
    }
    try {
      return await handler({
        access: access as Parameters<Handler<P>>[0]["access"],
        daemon: daemonFor(server.node),
        params,
        request,
      });
    } catch (error) {
      if (error instanceof DaemonError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status >= 500 ? 502 : error.status }
        );
      }
      if (error instanceof ServiceError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  };
