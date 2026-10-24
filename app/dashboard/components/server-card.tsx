"use client";

import {
  PlayIcon,
  RotateCcwIcon,
  ServerIcon,
  StopCircleIcon,
  Copy,
  Check,
  MoreHorizontalIcon,
  ArrowRightIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { PowerAction, ResourceUsage } from "@/protocol";

import { sendPowerAction } from "../[id]/actions/power";

export interface ServerCardData {
  id: string;
  name: string;
  status: string | null;
  deployed: boolean;
  address: string | null;
  nodeName: string | null;
  memory: number;
  cpu: number;
  game: { name: string; image: string | null } | null;
}

interface Props {
  server: ServerCardData;
}

interface Metrics {
  cpu?: number;
  memory?: number;
}

const statusConfig = {
  failed: {
    color: "text-red-500 dark:text-red-400",
    dot: "bg-red-500",
    glow: "shadow-red-500/10",
    label: "Failed",
    pill: "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400",
  },
  lost: {
    color: "text-red-500 dark:text-red-400",
    dot: "bg-red-500",
    glow: "shadow-red-500/10",
    label: "Lost",
    pill: "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400",
  },
  running: {
    color: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    glow: "shadow-emerald-500/10",
    label: "Running",
    pill: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  },
  stopped: {
    color: "text-muted-foreground",
    dot: "bg-zinc-400",
    glow: "",
    label: "Stopped",
    pill: "bg-muted/60 border-border/60 text-muted-foreground",
  },
  unhealthy: {
    color: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    glow: "shadow-amber-500/10",
    label: "Unhealthy",
    pill: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
};

const fetchResources = async (
  serverId: string
): Promise<ResourceUsage | null> => {
  try {
    const response = await fetch(`/api/servers/${serverId}/resources`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return ((await response.json()) as { resources: ResourceUsage }).resources;
  } catch {
    return null;
  }
};

// Panel-side status first; otherwise the daemon's live power state.
const statusKey = (
  server: ServerCardData,
  state: ResourceUsage["state"] | null
): keyof typeof statusConfig => {
  if (
    !server.deployed ||
    server.status === "installing" ||
    server.status === "restoring_backup"
  ) {
    return "unhealthy";
  }
  if (server.status) {
    return "failed";
  }
  if (state === "running" || state === "starting" || state === "stopping") {
    return "running";
  }
  return "stopped";
};

const getMetricColor = (value: number) => {
  if (value > 80) {
    return "bg-red-500";
  }
  if (value > 60) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
};

const MetricBar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground/80">
        {Math.round(value)}%
      </span>
    </div>
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          getMetricColor(value)
        )}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

const statusLabel = (
  server: ServerCardData,
  state: ResourceUsage["state"] | null,
  key: keyof typeof statusConfig
): string => {
  if (!server.deployed) {
    return "Deploying";
  }
  if (server.status) {
    return server.status.replaceAll("_", " ");
  }
  return state ?? statusConfig[key].label;
};

// CPU as a share of the server's limit; memory as a share of the container limit.
const toMetrics = (usage: ResourceUsage, cpuLimit: number): Metrics => {
  if (usage.state === "offline") {
    return {};
  }
  return {
    cpu:
      cpuLimit > 0 ? (usage.cpuAbsolute / cpuLimit) * 100 : usage.cpuAbsolute,
    memory:
      usage.memoryLimitBytes > 0
        ? (usage.memoryBytes / usage.memoryLimitBytes) * 100
        : undefined,
  };
};

export const ServerCard = ({ server }: Props) => {
  const { game } = server;
  const [metrics, setMetrics] = useState<Metrics>({});
  const [powerState, setPowerState] = useState<ResourceUsage["state"] | null>(
    null
  );
  const [metricsLoading, setMetricsLoading] = useState(server.deployed);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [copiedIP, setCopiedIP] = useState(false);

  const key = statusKey(server, powerState);
  const isRunning = key === "running";
  const isStopped = key === "stopped";
  const canControl = server.deployed && !server.status;

  const status = {
    ...statusConfig[key],
    label: statusLabel(server, powerState, key),
  };

  useEffect(() => {
    if (!server.deployed) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      const usage = await fetchResources(server.id);
      if (cancelled) {
        return;
      }
      setMetricsLoading(false);
      if (!usage) {
        return;
      }
      setPowerState(usage.state);
      setMetrics(toMetrics(usage, server.cpu));
    };
    void load();
    // Poll every 10s, like Pterodactyl's server list.
    const interval = setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [server.id, server.deployed, server.cpu]);

  const handleCommand = useCallback(
    async (action: PowerAction) => {
      if (!canControl) {
        return;
      }
      setActionPending(action);
      try {
        const result = await sendPowerAction({ action, serverId: server.id });
        if (result.ok) {
          toast.success(`Sent ${action}`);
        } else {
          toast.error(result.error || "Power action failed");
        }
      } catch {
        toast.error("Power action failed");
      } finally {
        setActionPending(null);
      }
    },
    [server.id, canControl]
  );

  const handleCopyIP = () => {
    if (server.address) {
      navigator.clipboard.writeText(server.address);
      setCopiedIP(true);
      setTimeout(() => setCopiedIP(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden transition-all duration-200",
        "hover:border-primary/30 hover:shadow-lg",
        status.glow && `hover:shadow-md hover:${status.glow}`
      )}
    >
      {/* Game image banner */}
      <div className="relative h-28 w-full overflow-hidden bg-muted">
        {game?.image ? (
          <Image
            src={game.image}
            alt={game.name}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-linear-to-br from-primary/5 to-primary/20">
            <ServerIcon className="h-12 w-12 text-primary/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-card/90 via-card/20 to-transparent" />

        {/* Status pill — top right */}
        <div className="absolute top-3 right-3">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
              status.pill
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </div>
        </div>

        {/* Game name — bottom left */}
        {game && (
          <div className="absolute bottom-2 left-3">
            <span className="text-xs font-medium text-white/70">
              {game.name}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Server name + location */}
        <div>
          <h3 className="font-semibold text-sm text-foreground truncate">
            {server.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-muted-foreground">
              {server.nodeName ?? "Awaiting deployment"}
            </span>
          </div>
        </div>

        {/* IP address */}
        {server.address ? (
          <button
            type="button"
            onClick={handleCopyIP}
            className="group/ip flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/70 hover:border-border"
          >
            <code className="text-xs font-mono text-foreground/70 truncate">
              {server.address}
            </code>
            <span className="ml-2 shrink-0 text-muted-foreground transition-colors group-hover/ip:text-foreground">
              {copiedIP ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
        ) : (
          <div className="flex items-center rounded-lg border border-dashed border-border/40 bg-muted/20 px-3 py-2">
            <code className="text-xs font-mono text-muted-foreground/50">
              No address yet
            </code>
          </div>
        )}

        {/* Metrics */}
        {isRunning && (
          <div className="space-y-2">
            {metricsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="h-3 w-3" />
                <span>Loading metrics…</span>
              </div>
            ) : (
              (metrics.cpu !== undefined || metrics.memory !== undefined) && (
                <div className="grid grid-cols-2 gap-3">
                  {metrics.cpu !== undefined && (
                    <MetricBar label="CPU" value={metrics.cpu} />
                  )}
                  {metrics.memory !== undefined && (
                    <MetricBar label="RAM" value={metrics.memory} />
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-border/40 bg-muted/20 px-4 py-3">
        <Link href={`/dashboard/${server.id}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full gap-2">
            <ArrowRightIcon className="h-3.5 w-3.5" />
            Manage
          </Button>
        </Link>

        {canControl && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={actionPending !== null}
                className="px-2"
              >
                {actionPending ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <MoreHorizontalIcon className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {isStopped && (
                <DropdownMenuItem
                  onClick={() => handleCommand("start")}
                  disabled={actionPending !== null}
                  className="cursor-pointer gap-2"
                >
                  <PlayIcon className="h-3.5 w-3.5 text-emerald-500" />
                  Start
                </DropdownMenuItem>
              )}
              {isRunning && (
                <>
                  <DropdownMenuItem
                    onClick={() => handleCommand("restart")}
                    disabled={actionPending !== null}
                    className="cursor-pointer gap-2"
                  >
                    <RotateCcwIcon className="h-3.5 w-3.5 text-primary" />
                    Restart
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCommand("stop")}
                    disabled={actionPending !== null}
                    className="cursor-pointer gap-2"
                  >
                    <StopCircleIcon className="h-3.5 w-3.5 text-amber-500" />
                    Stop
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
