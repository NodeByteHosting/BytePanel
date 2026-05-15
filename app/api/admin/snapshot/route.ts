import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { start } from "workflow/api";

import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { SEO_URL } from "@/lib/env";
import { sendSnapshotBakeStartedEmail } from "@/lib/mail";
import { requireSuperAdmin } from "@/lib/session";
import { buildSnapshot } from "@/lib/workflows/build-snapshot";

const coerceTimeline = (value: unknown): Record<string, string> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const timeline: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      timeline[key] = entry;
    }
  }
  return timeline;
};

export const runtime = "nodejs";

// GET /api/admin/snapshot — latest snapshot build + current system snapshot ID
export const GET = async () => {
  await requireSuperAdmin();

  const [build, systemSnapshot] = await Promise.all([
    prisma.snapshotBuild.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        agentSha: true,
        createdAt: true,
        errorReason: true,
        finishedAt: true,
        id: true,
        previousSnapshotId: true,
        provider: true,
        providerBuilderId: true,
        snapshotId: true,
        status: true,
        statusTimeline: true,
        user: { select: { email: true, name: true } },
        userId: true,
      },
    }),
    prisma.systemSnapshot.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { environment: true, providerImageId: true, updatedAt: true },
    }),
  ]);

  const normalizedBuild = build
    ? {
        agentSha: build.agentSha,
        createdAt: build.createdAt.toISOString(),
        errorReason: build.errorReason,
        finishedAt: build.finishedAt?.toISOString() ?? null,
        id: build.id,
        previousSnapshotId: build.previousSnapshotId,
        snapshotId: build.snapshotId,
        status: build.status,
        statusTimeline: coerceTimeline(build.statusTimeline),
        triggeredBy: build.user?.email ?? null,
      }
    : null;

  return NextResponse.json({ build: normalizedBuild, systemSnapshot });
};

// POST /api/admin/snapshot — trigger a new bake
export const POST = async (req: Request) => {
  const actor = await requireSuperAdmin();
  const actorId = (actor as { id?: string }).id ?? null;
  const actorEmail = (actor as { email?: string }).email ?? null;

  if (!actorId) {
    return NextResponse.json(
      { error: "Could not identify actor" },
      { status: 401 }
    );
  }

  const buildId = ulid();
  let alreadyRunning = false;

  await prisma.$transaction(async (tx) => {
    // Serialize concurrent POSTs on the user row
    await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${actorId} FOR UPDATE`;
    const active = await tx.snapshotBuild.findFirst({
      select: { id: true },
      where: { status: { notIn: ["ready", "failed"] } },
    });
    if (active) {
      alreadyRunning = true;
      return;
    }
    await tx.snapshotBuild.create({
      data: {
        id: buildId,
        status: "pending",
        statusTimeline: { pending: new Date().toISOString() },
        userId: actorId,
      },
    });
  });

  if (alreadyRunning) {
    return NextResponse.json(
      { error: "A snapshot build is already in progress." },
      { status: 409 }
    );
  }

  await logEvent({
    action: "admin.snapshot.bake_started",
    actorEmail,
    actorId,
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    metadata: { buildId },
    targetId: buildId,
    targetType: "snapshot_build",
    userAgent: req.headers.get("user-agent"),
  });

  // Notify the triggering user (fire-and-forget — never block the response)
  void (async () => {
    if (actorEmail) {
      await sendSnapshotBakeStartedEmail({
        adminUrl: `${SEO_URL}/admin/snapshot`,
        buildId,
        environment: process.env.VERCEL_ENV ?? "development",
        toEmails: [actorEmail],
        triggeredByEmail: actorEmail,
      });
    }
  })();

  await start(buildSnapshot, [{ buildId, userId: actorId }]);

  return NextResponse.json({ buildId });
};
