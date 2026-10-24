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
      className="border-border/50 bg-card/30 hover:border-border/80 hover:bg-card/50 cursor-pointer rounded-2xl border p-4 text-left backdrop-blur-sm transition-all md:p-5"
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        {icon && (
          <div className="border-border/50 bg-card/50 rounded-lg border p-1.5">
            {icon}
          </div>
        )}
      </div>

      <div className="mb-2">
        {loading ? (
          <div className="bg-muted h-8 w-32 animate-pulse rounded" />
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
        <p className="text-muted-foreground mt-2 text-xs">{subtext}</p>
      )}
    </button>
  );
};
