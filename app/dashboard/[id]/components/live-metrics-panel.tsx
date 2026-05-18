"use client";

import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  CpuIcon,
  MemoryStickIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { useLiveMetrics } from "./use-live-metrics";

interface MetricsPanelProps {
  serverId: string;
  observedState: string;
  maxPlayers?: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1e6) {
    return `${(bytes / 1e6).toFixed(1)} MB/s`;
  }
  if (bytes >= 1e3) {
    return `${(bytes / 1e3).toFixed(1)} KB/s`;
  }
  return `${Math.round(bytes)} B/s`;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

const progressColor = (pct: number): string => {
  if (pct < 60) {
    return "bg-emerald-500";
  }
  if (pct < 85) {
    return "bg-amber-500";
  }
  return "bg-red-500";
};

const MetricItem = ({
  icon,
  label,
  value,
  pct,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct?: number;
  mono?: boolean;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <span
      className={cn("text-sm font-semibold leading-none", mono && "font-mono")}
    >
      {value}
    </span>
    {pct !== undefined && (
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className={cn(
            "h-full transition-all duration-500",
            progressColor(pct)
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    )}
  </div>
);

export const LiveMetricsPanel = ({
  serverId,
  observedState,
  maxPlayers,
}: MetricsPanelProps) => {
  const { metrics, loading, error } = useLiveMetrics(serverId, observedState);

  if (observedState !== "running") {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
        <AlertCircleIcon className="size-3.5 shrink-0 text-red-500" />
        <span className="text-xs text-red-500">Unable to load metrics</span>
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <ActivityIcon className="size-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading metrics…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-x-5 gap-y-2 px-1">
      <MetricItem
        icon={<CpuIcon className="size-3" />}
        label="CPU"
        pct={metrics.cpu}
        value={`${metrics.cpu.toFixed(1)}%`}
      />
      <MetricItem
        icon={<MemoryStickIcon className="size-3" />}
        label="Memory"
        pct={metrics.memory}
        value={`${metrics.memory.toFixed(1)}%`}
      />
      <MetricItem
        icon={<ArrowDownIcon className="size-3" />}
        label="In"
        mono
        value={formatBytes(metrics.networkIn)}
      />
      <MetricItem
        icon={<ArrowUpIcon className="size-3" />}
        label="Out"
        mono
        value={formatBytes(metrics.networkOut)}
      />
      {metrics.playerCount !== undefined && (
        <MetricItem
          icon={<UsersIcon className="size-3" />}
          label="Players"
          value={
            maxPlayers
              ? `${metrics.playerCount}/${maxPlayers}`
              : String(metrics.playerCount)
          }
        />
      )}
      {metrics.tps !== undefined && (
        <MetricItem
          icon={<ActivityIcon className="size-3" />}
          label="TPS"
          value={metrics.tps.toFixed(1)}
        />
      )}
      <MetricItem
        icon={<ClockIcon className="size-3" />}
        label="Uptime"
        value={formatUptime(metrics.uptime)}
      />
    </div>
  );
};
