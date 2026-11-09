import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applicationHandler,
  billingActor,
  findExternalServer,
  parseJson,
  serializeServer,
  serverNotFound,
} from "@/lib/application/handler";
import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { destroyServer, updateBuild } from "@/lib/servers/service";

export const runtime = "nodejs";

export const GET = applicationHandler<{ externalId: string }>(
  async ({ params }) => {
    const server = await findExternalServer(params.externalId);
    if (!server) {
      return serverNotFound();
    }
    return NextResponse.json({ server: serializeServer(server) });
  }
);

const changePlanSchema = z.object({ planId: z.string().min(1) });

export const PATCH = applicationHandler<{ externalId: string }>(
  async ({ params, request }) => {
    const body = await parseJson(request, changePlanSchema);
    if ("response" in body) {
      return body.response;
    }
    const server = await findExternalServer(params.externalId);
    if (!server) {
      return serverNotFound();
    }
    const plan = await prisma.plan.findUnique({
      where: { id: body.data.planId },
    });
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 422 });
    }
    await prisma.server.update({
      data: { planId: plan.id },
      where: { id: server.id },
    });
    await updateBuild(server.id, {
      allocationLimit: plan.allocationLimit,
      backupLimit: plan.backupLimit,
      cpu: plan.cpu,
      disk: plan.disk,
      io: plan.io,
      memory: plan.memory,
      swap: plan.swap,
    });
    await logEvent({
      action: "application.server.change_plan",
      actorEmail: await billingActor(),
      metadata: { from: server.planId, to: plan.id },
      targetId: server.id,
      targetType: "server",
    });
    const updated = await prisma.server.findUniqueOrThrow({
      where: { id: server.id },
    });
    return NextResponse.json({ server: serializeServer(updated) });
  }
);

export const DELETE = applicationHandler<{ externalId: string }>(
  async ({ params }) => {
    const server = await findExternalServer(params.externalId);
    if (!server) {
      return new NextResponse(null, { status: 204 });
    }
    await destroyServer(server.id, { force: true });
    await logEvent({
      action: "application.server.terminate",
      actorEmail: await billingActor(),
      metadata: { externalId: params.externalId },
      targetId: server.id,
      targetType: "server",
    });
    return new NextResponse(null, { status: 204 });
  }
);
