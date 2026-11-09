import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applicationHandler,
  billingActor,
  findExternalServer,
  parseJson,
  serializeServer,
} from "@/lib/application/handler";
import { logEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deployServer, prepareServer } from "@/lib/servers/service";

export const runtime = "nodejs";

const createSchema = z.object({
  eggId: z.string().min(1),
  environment: z.record(z.string(), z.string()).default({}),
  // The billing system's service ID. Repeating a request with the same ID
  // returns the existing server (and retries placement if it failed).
  externalId: z.string().trim().min(1).max(191),
  locationId: z.string().min(1).nullable().default(null),
  name: z.string().trim().min(3).max(40).optional(),
  planId: z.string().min(1),
  startOnCompletion: z.boolean().default(true),
  user: z.object({
    email: z.email(),
    name: z.string().trim().min(1).max(100),
    // Optional: without one the customer sets a password via "forgot password".
    password: z.string().min(8).max(128).optional(),
  }),
});

// Finds the customer's panel account by email, creating it if needed.
const findOrCreateUser = async (
  input: z.infer<typeof createSchema>["user"]
) => {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }
  const { user } = await auth.api.createUser({
    body: { email, name: input.name, password: input.password },
  });
  await logEvent({
    action: "application.user.create",
    actorEmail: await billingActor(),
    targetId: user.id,
    targetType: "user",
  });
  return user;
};

// Provisions a server for a paid order: the billing system calls this from
// its "create account" hook.
export const POST = applicationHandler(async ({ request }) => {
  const body = await parseJson(request, createSchema);
  if ("response" in body) {
    return body.response;
  }
  const input = body.data;

  let server = await findExternalServer(input.externalId);
  if (!server) {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 422 });
    }
    if (
      plan.locationId &&
      input.locationId &&
      plan.locationId !== input.locationId
    ) {
      return NextResponse.json(
        { error: "That plan isn't offered in the selected location" },
        { status: 422 }
      );
    }
    const egg = await prisma.egg.findUnique({
      select: { containerPorts: true, name: true },
      where: { id: input.eggId },
    });
    if (!egg) {
      return NextResponse.json({ error: "Unknown egg" }, { status: 422 });
    }
    const portsNeeded = Math.max(
      1,
      Array.isArray(egg.containerPorts) ? egg.containerPorts.length : 0
    );
    if (portsNeeded > plan.allocationLimit) {
      return NextResponse.json(
        {
          error: `${egg.name} needs a plan with at least ${portsNeeded} ports`,
        },
        { status: 422 }
      );
    }
    const user = await findOrCreateUser(input.user);
    try {
      const id = await prepareServer({
        // Billing modules may enable eggs that are hidden from the panel.
        asAdmin: true,
        eggId: input.eggId,
        environment: input.environment,
        externalId: input.externalId,
        limits: {
          allocationLimit: plan.allocationLimit,
          backupLimit: plan.backupLimit,
          cpu: plan.cpu,
          disk: plan.disk,
          io: plan.io,
          memory: plan.memory,
          swap: plan.swap,
        },
        name: input.name ?? plan.name,
        planId: plan.id,
        userId: user.id,
      });
      server = await prisma.server.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      // A concurrent request with the same externalId won the race.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        server = await findExternalServer(input.externalId);
      } else {
        throw error;
      }
    }
    if (!server) {
      throw new Error("Server disappeared during provisioning");
    }
    await logEvent({
      action: "application.server.create",
      actorEmail: await billingActor(),
      metadata: { externalId: input.externalId, planId: plan.id },
      targetId: server.id,
      targetType: "server",
    });
  }

  if (!server.nodeId) {
    const plan = server.planId
      ? await prisma.plan.findUnique({
          select: { locationId: true },
          where: { id: server.planId },
        })
      : null;
    await deployServer(server.id, {
      locationId: input.locationId ?? plan?.locationId,
      startOnCompletion: input.startOnCompletion,
    });
    server = await prisma.server.findUniqueOrThrow({
      where: { id: server.id },
    });
  }

  return NextResponse.json(
    { server: serializeServer(server) },
    { status: 201 }
  );
});
