import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { prisma } from "@/lib/db";
import { env, SNAPSHOT_ENVIRONMENT } from "@/lib/env";
import { requireSuperAdmin } from "@/lib/session";
import type {
  SnapshotBuildStatus,
  SnapshotStatusTimeline,
} from "@/lib/snapshot-build/types";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { SnapshotPanel } from "./snapshot-panel";

const coerceTimeline = (value: unknown): SnapshotStatusTimeline | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const timeline: SnapshotStatusTimeline = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      continue;
    }
    timeline[key as keyof SnapshotStatusTimeline] = entry;
  }
  return timeline;
};

const AdminSnapshotPage = async () => {
  await requireSuperAdmin();

  const [latestBuild, dbSnapshot] = await Promise.all([
    prisma.snapshotBuild.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        agentSha: true,
        createdAt: true,
        errorReason: true,
        finishedAt: true,
        id: true,
        previousSnapshotId: true,
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

  // The env var takes precedence at provision time (see lib/providers/index.ts).
  // Synthesise a snapshot record from it so the admin page accurately reflects
  // what image is actually being used, even before a DB-managed bake exists.
  const envPinnedImageId = env.HETZNER_SNAPSHOT_IMAGE_ID ?? null;
  let systemSnapshot: {
    envPinned: boolean;
    environment: string;
    providerImageId: string;
    updatedAt: string;
  } | null;
  if (envPinnedImageId) {
    systemSnapshot = {
      envPinned: true,
      environment: SNAPSHOT_ENVIRONMENT,
      providerImageId: envPinnedImageId,
      updatedAt: dbSnapshot
        ? new Date(dbSnapshot.updatedAt).toISOString()
        : new Date(0).toISOString(),
    };
  } else if (dbSnapshot) {
    systemSnapshot = {
      envPinned: false,
      environment: dbSnapshot.environment,
      providerImageId: dbSnapshot.providerImageId,
      updatedAt: new Date(dbSnapshot.updatedAt).toISOString(),
    };
  } else {
    systemSnapshot = null;
  }

  return (
    <>
      <PageHeader title="Snapshot Baking" />
      <PageBody>
        <SnapshotPanel
          latestBuild={
            latestBuild
              ? {
                  agentSha: latestBuild.agentSha,
                  createdAt: latestBuild.createdAt.toISOString(),
                  errorReason: latestBuild.errorReason,
                  finishedAt: latestBuild.finishedAt?.toISOString() ?? null,
                  id: latestBuild.id,
                  previousSnapshotId: latestBuild.previousSnapshotId,
                  snapshotId: latestBuild.snapshotId,
                  status: latestBuild.status as SnapshotBuildStatus,
                  statusTimeline: coerceTimeline(latestBuild.statusTimeline),
                  triggeredBy: latestBuild.user?.email ?? null,
                }
              : null
          }
          systemSnapshot={systemSnapshot}
        />

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            About snapshot baking
          </h2>
          <Accordion type="multiple" className="w-full space-y-2">
            <AccordionItem
              value="what"
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="text-sm font-medium py-3">
                What is snapshot baking?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 space-y-2">
                <p>
                  Snapshot baking is the process of building a{" "}
                  <strong className="text-foreground">
                    golden server image
                  </strong>{" "}
                  that contains the base OS, runtime dependencies, Docker, and
                  the NodeByte agent pre-installed and configured.
                </p>
                <p>
                  When a customer orders a new game server, the panel clones
                  this image instead of running a full install from scratch.
                  This is why new servers are ready in under 90 seconds rather
                  than 10+ minutes.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="when"
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="text-sm font-medium py-3">
                When should I bake a new snapshot?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 space-y-2">
                <p>Trigger a new bake after any of the following:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>The NodeByte agent binary has been updated</li>
                  <li>
                    Base OS packages need a security or compatibility update
                  </li>
                  <li>
                    Docker or a core runtime dependency has a new required
                    version
                  </li>
                  <li>Cloud-init configuration has changed</li>
                </ul>
                <p className="mt-2">
                  Bakes in production should be infrequent. Test in a preview
                  environment first.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="how-long"
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="text-sm font-medium py-3">
                How long does a bake take?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 space-y-2">
                <p>
                  A typical bake takes{" "}
                  <strong className="text-foreground">25–45 minutes</strong>.
                  The majority of that time is spent running the cloud-init
                  script on the builder VM (OS packages, Docker, agent
                  installation). Snapshotting the resulting disk image usually
                  adds another 5–10 minutes.
                </p>
                <p>
                  The bake will time out automatically if the builder VM does
                  not shut itself down within 45 minutes, or if the image does
                  not become available within 15 minutes of snapshotting.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="failure"
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="text-sm font-medium py-3">
                What happens if a bake fails?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4 space-y-2">
                <p>
                  On failure, the{" "}
                  <strong className="text-foreground">
                    previous snapshot is kept intact
                  </strong>{" "}
                  — no new image is written to the system record. Existing
                  customers continue to receive servers built from the last
                  successful bake.
                </p>
                <p>
                  When a failure occurs during the VM build phase, the builder
                  VM is intentionally left running so you can inspect cloud-init
                  logs via the infrastructure console. The build details page
                  shows the VM&apos;s ID so you know which one to look at.
                  Remember to delete it manually once you&apos;re done.
                </p>
                <p>
                  All superadmins are notified by email immediately when a bake
                  fails.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="concurrent"
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="text-sm font-medium py-3">
                Can two bakes run at the same time?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4">
                <p>
                  No. The panel enforces a single active bake at a time.
                  Submitting a second bake while one is already in progress
                  returns a{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    409 Conflict
                  </code>{" "}
                  and no new build is started. Wait for the current bake to
                  finish (or reach a failed state) before triggering another.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </PageBody>
    </>
  );
};

export default AdminSnapshotPage;
