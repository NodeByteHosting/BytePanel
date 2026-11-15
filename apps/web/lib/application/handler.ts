import "server-only";
import type { Server } from "@prisma/client";
import { NextResponse } from "next/server";

import { DaemonError } from "@/lib/daemon/client";
import { prisma } from "@/lib/db";
import { API_URL } from "@/lib/env";
import { ServiceError } from "@/lib/servers/service";
import { getBillingProvider, verifyBillingApiKey } from "@/lib/settings";

export { parseJson } from "@/lib/remote/handler";

export const applicationHandler =
  <P extends Record<string, string>>(
    handler: (ctx: { request: Request; params: P }) => Promise<Response>
  ) =>
  async (request: Request, context: { params: Promise<P> }) => {
    const header = request.headers.get("authorization") ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!key || !(await verifyBillingApiKey(key))) {
      return NextResponse.json(
        {
          error: "Invalid API key",
        },
        { status: 401 }
      );
    }
    try {
      return await handler({ params: await context.params, request });
    } catch (error) {
      if (error instanceof ServiceError) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
      if (error instanceof DaemonError) {
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      throw error;
    }
  };

export const findExternalServer = (externalId: string) =>
  prisma.server.findFirst({ where: { deletedAt: null, externalId } });

export const serverNotFound = () =>
  NextResponse.json({ error: "Server not found" }, { status: 404 });

export const serializeServer = (server: Server) => ({
  deployed: server.nodeId !== null,
  externalId: server.externalId,
  id: server.id,
  name: server.name,
  planId: server.planId,
  status: server.status ?? "installed",
  suspended: server.status === "suspended",
  url: `${API_URL}/dashboard/${server.id}`,
  userId: server.userId,
  uuid: server.uuid,
});

export const billingActor = async () => `billing:${await getBillingProvider()}`;
