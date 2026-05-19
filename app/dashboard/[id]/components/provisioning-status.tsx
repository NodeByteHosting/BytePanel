"use client";
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleXIcon,
  Loader2Icon,
  RocketIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  {
    description: "Reserving a virtual machine in your chosen region",
    key: "create",
    label: "Create server",
    phases: ["queued", "provisioning"],
  },
  {
    description: "Operating system booting and network interfaces coming up",
    key: "boot",
    label: "Boot VM",
    phases: ["booting"],
  },
  {
    description: "NodeByte agent connecting and enrolling with the panel",
    key: "agent",
    label: "Connect agent",
    phases: ["agent_connected"],
  },
  {
    description: "Downloading and configuring game server files",
    key: "install",
    label: "Install game",
    phases: ["installing"],
  },
  {
    description: "Game server process initialising",
    key: "start",
    label: "Start server",
    phases: ["starting"],
  },
  {
    description: "Verifying server health and network connectivity",
    key: "health",
    label: "Run health checks",
    phases: ["healthy"],
  },
] as const;

const PHASE_ORDER: string[] = STEPS.flatMap((s) => [...s.phases]);

type StepStatus = "done" | "active" | "pending" | "error";

const resolveStepStatus = (
  currentIndex: number,
  stepStart: number,
  stepEnd: number,
  isErrorStep: boolean
): StepStatus => {
  if (isErrorStep) {
    return "error";
  }
  if (currentIndex > stepEnd) {
    return "done";
  }
  if (currentIndex >= stepStart) {
    return "active";
  }
  return "pending";
};

const StepCircle = ({ status }: { status: StepStatus }) => {
  if (status === "done") {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30">
        <CheckIcon className="size-4 text-emerald-500" strokeWidth={2.5} />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/40">
        <Loader2Icon className="size-4 animate-spin text-primary" />
        {/* Outer pulse ring */}
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/30">
        <CircleXIcon className="size-4 text-destructive" />
      </div>
    );
  }
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border/60">
      <div className="size-2 rounded-full bg-muted-foreground/30" />
    </div>
  );
};

const ConnectorLine = ({ status }: { status: StepStatus }) => (
  <div
    className={cn(
      "mx-auto mt-1 w-0.5 flex-1",
      status === "done" && "bg-emerald-500/30",
      status === "active" && "bg-primary/20",
      (status === "pending" || status === "error") && "bg-border/50"
    )}
  />
);

const PHASE_LABEL: Record<string, string> = {
  agent_connected: "Connecting agent",
  booting: "Booting VM",
  errored: "Provisioning failed",
  healthy: "Checking health",
  installing: "Installing game",
  provisioning: "Creating VM",
  queued: "Queued",
  starting: "Starting server",
};

export const ProvisioningStatus = ({
  phase,
  errored,
  errorReason,
}: {
  phase: string;
  errored: boolean;
  errorReason: string | null;
}) => {
  const currentIndex = PHASE_ORDER.indexOf(phase);
  const errorIndex = errored && currentIndex === -1 ? 0 : currentIndex;

  const phaseLabel = PHASE_LABEL[phase] ?? "In progress";

  return (
    <div className="flex flex-col gap-5">
      {/* Status banner */}
      {errored ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-destructive">
              Provisioning failed
            </p>
            <p className="text-xs text-muted-foreground">
              {errorReason ??
                "An error occurred during provisioning. Our team has been notified."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3.5">
          <RocketIcon className="size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{phaseLabel}…</p>
            <p className="text-xs text-muted-foreground">
              Your server will be ready in approximately 60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Step timeline */}
      <div className="rounded-xl border border-border/60 bg-card">
        {STEPS.map((step, i) => {
          const stepStart = PHASE_ORDER.indexOf(step.phases[0]);
          const stepEnd = stepStart + step.phases.length - 1;
          const isErrorStep =
            errored && errorIndex >= stepStart && errorIndex <= stepEnd;
          const status = resolveStepStatus(
            currentIndex,
            stepStart,
            stepEnd,
            isErrorStep
          );
          const isLast = i === STEPS.length - 1;

          return (
            <div
              key={step.key}
              className={cn(
                "flex gap-4 px-4",
                !isLast && "border-b border-border/40",
                status === "active" && "bg-primary/3",
                status === "error" && "bg-destructive/3",
                status === "done" && "bg-emerald-500/2"
              )}
            >
              {/* Left: circle + connector */}
              <div className="flex w-9 shrink-0 flex-col items-center py-4">
                <StepCircle status={status} />
                {!isLast && <ConnectorLine status={status} />}
              </div>

              {/* Right: content */}
              <div className="flex flex-1 flex-col justify-center gap-0.5 py-4">
                <p
                  className={cn(
                    "text-sm font-medium leading-tight",
                    status === "pending" && "text-muted-foreground",
                    status === "done" && "text-foreground",
                    status === "active" && "text-foreground",
                    status === "error" && "text-destructive"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {step.description}
                </p>
                {isErrorStep && errorReason && (
                  <p className="mt-1.5 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                    {errorReason}
                  </p>
                )}
              </div>

              {/* Right badge */}
              <div className="flex shrink-0 items-center py-4">
                {status === "done" && (
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Done
                  </span>
                )}
                {status === "active" && (
                  <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    In progress
                  </span>
                )}
                {status === "error" && (
                  <span className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    Failed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
