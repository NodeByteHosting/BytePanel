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

import { runServerCommand } from "../[id]/actions/commands";

interface Server {
  id: string;
  name: string;
  game: string;
  observedState: string;
  desiredState: string;
  phase: string;
  ipv4: string | null;
  serverType: string;
  location: string;
}

interface GameInfo {
  id: string;
  name: string;
  image: string;
}

interface Props {
  server: Server;
  game: GameInfo | undefined;
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

const fetchLiveMetrics = async (serverId: string): Promise<Metrics> => {
  try {
    const response = await fetch(`/api/servers/${serverId}/metrics/live`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    const m = data.metrics;
    if (!m) {
      return {};
    }
    return {
      cpu: typeof m.cpu === "number" ? m.cpu : undefined,
      memory: typeof m.memory === "number" ? m.memory : undefined,
    };
  } catch {
    return {};
  }
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

export const ServerCard = ({ server, game }: Props) => {
  const [metrics, setMetrics] = useState<Metrics>({});
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [copiedIP, setCopiedIP] = useState(false);

  const deleting = server.desiredState === "deleted";
  const isRunning = server.observedState === "running";
  const isStopped = server.observedState === "stopped";
  const canControl = !deleting;

  const status =
    statusConfig[server.observedState as keyof typeof statusConfig] ??
    statusConfig.stopped;

  useEffect(() => {
    if (server.observedState !== "running") {
      setMetrics({});
      setMetricsLoading(false);
      return;
    }

    setMetricsLoading(true);
    let cancelled = false;

    const load = async () => {
      const m = await fetchLiveMetrics(server.id);
      if (!cancelled) {
        setMetrics(m);
        setMetricsLoading(false);
      }
    };
    void load();

    // Poll every 10s while running
    const interval = setInterval(() => {
      void (async () => {
        const m = await fetchLiveMetrics(server.id);
        if (!cancelled) {
          setMetrics(m);
        }
      })();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [server.id, server.observedState]);

  const handleCommand = useCallback(
    async (type: "START" | "STOP" | "RESTART") => {
      if (!canControl) {
        return;
      }
      setActionPending(type);
      try {
        const result = await runServerCommand({ serverId: server.id, type });
        if (result.ok) {
          toast.success(`${type.toLowerCase()} queued`);
        } else {
          toast.error(result.error || "Failed to queue command");
        }
      } catch {
        toast.error("Failed to queue command");
      } finally {
        setActionPending(null);
      }
    },
    [server.id, canControl]
  );

  const handleCopyIP = () => {
    if (server.ipv4) {
      navigator.clipboard.writeText(server.ipv4);
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
        {game ? (
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
            <span className="text-xs text-muted-foreground font-mono uppercase">
              {server.location}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">
              {server.serverType}
            </span>
          </div>
        </div>

        {/* IP address */}
        {server.ipv4 ? (
          <button
            type="button"
            onClick={handleCopyIP}
            className="group/ip flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/70 hover:border-border"
          >
            <code className="text-xs font-mono text-foreground/70 truncate">
              {server.ipv4}
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
              No IP assigned
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
                  onClick={() => handleCommand("START")}
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
                    onClick={() => handleCommand("RESTART")}
                    disabled={actionPending !== null}
                    className="cursor-pointer gap-2"
                  >
                    <RotateCcwIcon className="h-3.5 w-3.5 text-primary" />
                    Restart
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleCommand("STOP")}
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
