"use client";

import { CheckIcon, CircleXIcon, HardDriveIcon, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  isTerminalSnapshotStatus,
  SNAPSHOT_BUILD_PROGRESSION,
} from "@/lib/snapshot-build/types";
import type {
  SnapshotBuildStatus,
  SnapshotStatusTimeline,
} from "@/lib/snapshot-build/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminSnapshotBuild {
  id: string;
  status: SnapshotBuildStatus;
  snapshotId: string | null;
  previousSnapshotId: string | null;
  errorReason: string | null;
  agentSha: string | null;
  createdAt: string;
  finishedAt: string | null;
  statusTimeline: SnapshotStatusTimeline | null;
  triggeredBy: string | null;
}

interface SystemSnapshotInfo {
  environment: string;
  providerImageId: string;
  updatedAt: string;
  envPinned: boolean;
}

interface Props {
  latestBuild: AdminSnapshotBuild | null;
  systemSnapshot: SystemSnapshotInfo | null;
}

// ---------------------------------------------------------------------------
// Step progress UI
// ---------------------------------------------------------------------------

const STEPS: {
  key: SnapshotBuildStatus;
  label: string;
  description: string;
}[] = [
  { description: "Waiting to start", key: "pending", label: "Queued" },
  {
    description: "Cross-compiling the NodeByte agent binary",
    key: "compiling_agent",
    label: "Compiling agent",
  },
  {
    description: "Spinning up a Virtual Machine",
    key: "creating_vm",
    label: "Creating VM",
  },
  {
    description: "Running cloud-init: apt upgrade, Docker, agent setup",
    key: "installing",
    label: "Installing",
  },
  {
    description: "Creating the baked image from the VM",
    key: "snapshotting",
    label: "Snapshotting",
  },
  { description: "Golden image is live", key: "ready", label: "Ready" },
];

type StepStatus = "done" | "active" | "pending" | "error";

const toMs = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const getStepDurationMs = (
  build: AdminSnapshotBuild,
  step: SnapshotBuildStatus,
  now: number
): number | null => {
  const timeline = build.statusTimeline;
  if (!timeline) {
    return null;
  }

  const startMs = toMs(timeline[step]);
  if (startMs === null) {
    return null;
  }

  const stepIndex = SNAPSHOT_BUILD_PROGRESSION.indexOf(step);
  const nextStep =
    stepIndex === -1 ? undefined : SNAPSHOT_BUILD_PROGRESSION[stepIndex + 1];
  const nextStepMs = nextStep ? toMs(timeline[nextStep]) : null;
  const failedMs = toMs(timeline.failed);
  const finishedMs = toMs(build.finishedAt);

  const endMs =
    nextStepMs ??
    (build.status === "failed" ? failedMs : null) ??
    finishedMs ??
    (build.status === step ? now : null);

  if (endMs === null || endMs < startMs) {
    return null;
  }

  return endMs - startMs;
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const StepIcon = ({ status }: { status: StepStatus }) => {
  if (status === "done") {
    return <CheckIcon className="size-4 shrink-0 text-emerald-500" />;
  }
  if (status === "active") {
    return <Spinner className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (status === "error") {
    return <CircleXIcon className="size-4 shrink-0 text-destructive" />;
  }
  return (
    <div className="size-4 shrink-0 rounded-full border border-border/60" />
  );
};

const BuildProgress = ({
  build,
  now,
}: {
  build: AdminSnapshotBuild;
  now: number;
}) => {
  const errored = build.status === "failed";
  const currentIndex = SNAPSHOT_BUILD_PROGRESSION.indexOf(build.status);
  const errorIndex = errored && currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="grid gap-3">
      {STEPS.map((step, index) => {
        const isErrorStep = errored && errorIndex === index;
        let status: StepStatus;
        if (isErrorStep) {
          status = "error";
        } else if (currentIndex > index) {
          status = "done";
        } else if (currentIndex === index) {
          status = "active";
        } else {
          status = "pending";
        }

        return (
          <div className="flex flex-col gap-0.5" key={step.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <StepIcon status={status} />
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-sm font-medium leading-none",
                      status === "pending" &&
                        "text-muted-foreground font-normal",
                      status === "error" && "text-destructive"
                    )}
                  >
                    {step.label}
                  </span>
                  {(status === "active" || status === "done") && (
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </span>
                  )}
                </div>
              </div>
              {(() => {
                const durationMs = getStepDurationMs(build, step.key, now);
                if (durationMs === null || status === "pending") {
                  return null;
                }
                return (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(durationMs)}
                  </span>
                );
              })()}
            </div>
            {isErrorStep && build.errorReason && (
              <p className="pl-7 text-xs text-destructive">
                {build.errorReason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root panel
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000;

const getStatusProgressPercent = (status: SnapshotBuildStatus): number => {
  switch (status) {
    case "pending": {
      return 8;
    }
    case "compiling_agent": {
      return 22;
    }
    case "creating_vm": {
      return 40;
    }
    case "installing": {
      return 68;
    }
    case "snapshotting": {
      return 88;
    }
    case "ready": {
      return 100;
    }
    case "failed": {
      return 100;
    }
    default: {
      return 0;
    }
  }
};

export const SnapshotPanel = ({ latestBuild, systemSnapshot }: Props) => {
  const router = useRouter();
  const [build, setBuild] = useState<AdminSnapshotBuild | null>(latestBuild);
  const [triggering, setTriggering] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildActive = build ? !isTerminalSnapshotStatus(build.status) : false;

  // Sync prop → state when the server re-renders (e.g. after router.refresh())
  useEffect(() => {
    setBuild(latestBuild);
  }, [latestBuild]);

  // Polling while a build is active
  useEffect(() => {
    if (!buildActive) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) {
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/snapshot", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const json = (await res.json()) as { build: AdminSnapshotBuild | null };
        setBuild(json.build);
        if (json.build && isTerminalSnapshotStatus(json.build.status)) {
          if (json.build.status === "ready") {
            toast.success("Snapshot is ready — golden image updated.");
            router.refresh();
          } else {
            toast.error(json.build.errorReason ?? "Snapshot build failed.");
          }
        }
      } catch {
        // network blip — next tick will retry
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [buildActive, router]);

  // Live elapsed timer while active, so users can see forward movement.
  useEffect(() => {
    if (!buildActive) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [buildActive]);

  const handleBake = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/admin/snapshot", { method: "POST" });
      const json = (await res.json()) as { buildId?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to start build");
      }
      toast.success("Snapshot bake started.");
      // Immediately poll once to get the pending record
      const statusRes = await fetch("/api/admin/snapshot", {
        cache: "no-store",
      });
      if (statusRes.ok) {
        const data = (await statusRes.json()) as {
          build: AdminSnapshotBuild | null;
        };
        setBuild(data.build);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start snapshot bake."
      );
    } finally {
      setTriggering(false);
    }
  };

  let bakeLabel: string;
  if (triggering) {
    bakeLabel = "Starting\u2026";
  } else if (systemSnapshot) {
    bakeLabel = "Rebuild snapshot";
  } else {
    bakeLabel = "Bake snapshot";
  }

  const elapsedMs = build ? now - new Date(build.createdAt).getTime() : 0;
  const progressValue = build ? getStatusProgressPercent(build.status) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Current system snapshot */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HardDriveIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">System snapshot</CardTitle>
          </div>
          <CardDescription>
            The golden image used when provisioning new game servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemSnapshot ? (
            <div className="grid gap-2 text-sm">
              {systemSnapshot.envPinned && (
                <div className="mb-1 flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <span className="font-medium">Pinned via env var</span>
                  <span className="text-amber-500/70">
                    —{" "}
                    <code className="font-mono">HETZNER_SNAPSHOT_IMAGE_ID</code>{" "}
                    overrides any baked image. To manage snapshots through the
                    panel, remove this env var.
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Image ID</span>
                <span className="font-mono text-foreground">
                  {systemSnapshot.providerImageId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Environment</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {systemSnapshot.environment}
                </Badge>
              </div>
              {!systemSnapshot.envPinned && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="text-foreground">
                    {new Date(systemSnapshot.updatedAt).toLocaleString(
                      "en-US",
                      { dateStyle: "medium", timeStyle: "short" }
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No system snapshot found. Bake one below to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bake controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Bake new snapshot</CardTitle>
              <CardDescription className="mt-1">
                Compiles the latest agent binary, provisions a builder VM, and
                creates a new golden image. Takes ~20–30 minutes.
              </CardDescription>
            </div>
            <Button disabled={triggering || buildActive} onClick={handleBake}>
              {buildActive ? (
                <>
                  <Spinner className="size-4" />
                  Building…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  {bakeLabel}
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {build && (
          <CardContent className="border-t pt-5">
            <div className="flex flex-col gap-5">
              {buildActive && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {build.status === "installing"
                        ? "Installing on builder VM"
                        : "Snapshot build in progress"}
                    </span>
                    <span>Elapsed: {formatDuration(elapsedMs)}</span>
                  </div>
                  <Progress value={progressValue} />
                  {build.status === "installing" && (
                    <p className="text-xs text-muted-foreground">
                      Cloud-init is running package installs and Docker setup.
                    </p>
                  )}
                </div>
              )}

              {/* Build metadata */}
              <div className="grid gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Build ID</span>
                  <span className="font-mono">{build.id}</span>
                </div>
                {build.triggeredBy && (
                  <div className="flex items-center justify-between">
                    <span>Triggered by</span>
                    <span>{build.triggeredBy}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Started</span>
                  <span>
                    {new Date(build.createdAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {build.finishedAt && (
                  <div className="flex items-center justify-between">
                    <span>Finished</span>
                    <span>
                      {new Date(build.finishedAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
                {build.agentSha && (
                  <div className="flex items-center justify-between">
                    <span>Agent SHA</span>
                    <span className="font-mono">
                      {build.agentSha.slice(0, 16)}…
                    </span>
                  </div>
                )}
                {build.snapshotId && (
                  <div className="flex items-center justify-between">
                    <span>New image ID</span>
                    <span className="font-mono">{build.snapshotId}</span>
                  </div>
                )}
                {build.previousSnapshotId && (
                  <div className="flex items-center justify-between">
                    <span>Replaced image</span>
                    <span className="font-mono text-muted-foreground/60">
                      {build.previousSnapshotId}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress steps */}
              <BuildProgress build={build} now={now} />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
