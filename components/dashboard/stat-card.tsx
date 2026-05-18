"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    percentage: number;
    label?: string;
  };
  subtext?: string;
  onClick?: () => void;
  loading?: boolean;
}

const getTrendColor = (direction?: string) => {
  if (direction === "up") {
    return "text-emerald-500";
  }
  if (direction === "down") {
    return "text-destructive";
  }
  return "text-muted-foreground";
};

export const StatCard = ({
  title,
  value,
  icon,
  trend,
  subtext,
  onClick,
  loading = false,
}: StatCardProps) => {
  const trendColor = getTrendColor(trend?.direction);

  const TrendIcon = trend?.direction === "up" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <button
      type="button"
      className="rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm transition-all hover:border-border/80 hover:bg-card/50 cursor-pointer md:p-5 text-left"
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="rounded-lg border border-border/50 bg-card/50 p-1.5">
            {icon}
          </div>
        )}
      </div>

      <div className="mb-2">
        {loading ? (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold tracking-tight md:text-3xl">
            {value}
          </p>
        )}
      </div>

      {trend && (
        <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
          {!loading && <TrendIcon className="size-3.5" />}
          <span className="font-medium">
            {trend?.percentage}% {trend?.label || "change"}
          </span>
        </div>
      )}

      {subtext && (
        <p className="mt-2 text-xs text-muted-foreground">{subtext}</p>
      )}
    </button>
  );
};
