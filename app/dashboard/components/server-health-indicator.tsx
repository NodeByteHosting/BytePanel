"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
} from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ServerHealthStatus {
  state: "running" | "stopped" | "failed" | "unhealthy" | "pending" | "deleted";
  lastHeartbeat?: Date;
  cpu?: number;
  memory?: number;
  uptime?: number;
}

interface ServerHealthIndicatorProps {
  status: ServerHealthStatus;
  compact?: boolean;
}

const statusConfig = {
  deleted: {
    bgColor: "bg-muted/50",
    color: "text-muted-foreground",
    icon: AlertCircle,
    label: "Deleted",
  },
  failed: {
    bgColor: "bg-destructive/10",
    color: "text-destructive",
    icon: AlertCircle,
    label: "Failed",
  },
  pending: {
    bgColor: "bg-blue-500/10",
    color: "text-blue-600 dark:text-blue-400",
    icon: Clock,
    label: "Pending",
  },
  running: {
    bgColor: "bg-emerald-500/10",
    color: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
    label: "Running",
  },
  stopped: {
    bgColor: "bg-muted",
    color: "text-muted-foreground",
    icon: Clock,
    label: "Stopped",
  },
  unhealthy: {
    bgColor: "bg-amber-500/10",
    color: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    label: "Unhealthy",
  },
};

const formatUptime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  if (seconds < 86_400) {
    return `${Math.round(seconds / 3600)}h`;
  }
  return `${Math.round(seconds / 86_400)}d`;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86_400)}d ago`;
};

const getCpuBarColor = (cpu: number): string => {
  if (cpu > 80) {
    return "bg-destructive";
  }
  if (cpu > 50) {
    return "bg-amber-500";
  }
  return "bg-emerald-500";
};

const getMemoryBarColor = (memory: number): string => {
  if (memory > 80) {
    return "bg-destructive";
  }
  if (memory > 50) {
    return "bg-blue-500";
  }
  return "bg-emerald-500";
};

export const ServerHealthIndicator = ({
  status,
  compact = false,
}: ServerHealthIndicatorProps) => {
  const config = statusConfig[status.state];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className="text-xs font-medium">{config.label}</span>
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Status
        </span>
        <Badge variant="outline" className={cn("gap-1.5", config.bgColor)}>
          <Icon className={cn("h-3 w-3", config.color)} />
          <span className={config.color}>{config.label}</span>
        </Badge>
      </div>

      {status.cpu !== undefined && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">CPU Usage</span>
            <span className="font-medium">{status.cpu.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                getCpuBarColor(status.cpu)
              )}
              style={{ width: `${Math.min(status.cpu, 100)}%` }}
            />
          </div>
        </div>
      )}

      {status.memory !== undefined && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Memory</span>
            <span className="font-medium">{status.memory.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                getMemoryBarColor(status.memory)
              )}
              style={{ width: `${Math.min(status.memory, 100)}%` }}
            />
          </div>
        </div>
      )}

      {status.uptime !== undefined && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Uptime</span>
          <div className="flex items-center gap-1.5 font-medium">
            <Zap className="h-3 w-3 text-amber-500" />
            {formatUptime(status.uptime)}
          </div>
        </div>
      )}

      {status.lastHeartbeat && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Last Heartbeat</span>
          <span>{formatTimeAgo(status.lastHeartbeat)}</span>
        </div>
      )}
    </Card>
  );
};
