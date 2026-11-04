"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

export interface QuickStatItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "purple" | "emerald" | "amber" | "red" | "blue";
  onClick?: () => void;
}

const getTrendIcon = (trend: { value: number; isPositive: boolean }) => {
  if (trend.value === 0) {
    return <Minus className="h-3 w-3" />;
  }
  if (trend.isPositive) {
    return <ArrowUp className="h-3 w-3" />;
  }
  return <ArrowDown className="h-3 w-3" />;
};

const colorMap = {
  amber: {
    border: "hover:border-amber-500/30",
    icon: "bg-amber-500/10 text-amber-500",
  },
  blue: {
    border: "hover:border-blue-500/30",
    icon: "bg-blue-500/10 text-blue-500",
  },
  emerald: {
    border: "hover:border-emerald-500/30",
    icon: "bg-emerald-500/10 text-emerald-500",
  },
  purple: {
    border: "hover:border-primary/30",
    icon: "bg-primary/10 text-primary",
  },
  red: {
    border: "hover:border-destructive/30",
    icon: "bg-destructive/10 text-destructive",
  },
};

interface QuickStatsProps {
  stats: QuickStatItem[];
  className?: string;
}

export const QuickStats = ({ stats, className }: QuickStatsProps) => (
  <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
    {stats.map((stat, idx) => {
      const colors = colorMap[stat.color ?? "purple"];
      return (
        <button
          key={idx}
          type="button"
          disabled={!stat.onClick}
          className={cn(
            "group border-border/60 bg-card relative rounded-xl border px-4 py-4 text-left transition-all duration-200",
            "hover:shadow-primary/5 hover:shadow-md disabled:cursor-default",
            colors.border,
            stat.onClick && "hover:border-primary/40 cursor-pointer"
          )}
          onClick={() => stat.onClick?.()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-2 truncate text-xs font-medium">
                {stat.label}
              </p>
              <p className="text-foreground text-2xl font-bold tracking-tight">
                {stat.value}
              </p>
              {stat.trend !== undefined && (
                <div
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    stat.trend.isPositive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}
                >
                  {getTrendIcon(stat.trend)}
                  <span>{Math.abs(stat.trend.value)}%</span>
                </div>
              )}
            </div>
            {stat.icon && (
              <div className={cn("shrink-0 rounded-lg p-2.5", colors.icon)}>
                {stat.icon}
              </div>
            )}
          </div>
        </button>
      );
    })}
  </div>
);
