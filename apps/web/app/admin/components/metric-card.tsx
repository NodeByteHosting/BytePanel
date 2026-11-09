"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  change?: {
    value: number;
    isPositive: boolean;
    period?: string;
  };
  icon?: React.ReactNode;
  accent?: "blue" | "emerald" | "violet" | "amber" | "red" | "zinc";
  href?: string;
  onClick?: () => void;
}

const ACCENT: Record<
  NonNullable<MetricCardProps["accent"]>,
  { icon: string; ring: string }
> = {
  amber: {
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "hover:border-amber-500/30",
  },
  blue: {
    icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    ring: "hover:border-blue-500/30",
  },
  emerald: {
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-500/30",
  },
  red: {
    icon: "bg-red-500/15 text-red-600 dark:text-red-400",
    ring: "hover:border-red-500/30",
  },
  violet: {
    icon: "bg-primary/15 text-link",
    ring: "hover:border-primary/30",
  },
  zinc: {
    icon: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",
    ring: "hover:border-zinc-500/20",
  },
};

export const MetricCard = ({
  title,
  value,
  description,
  change,
  icon,
  accent = "zinc",
  href,
  onClick,
}: MetricCardProps) => {
  const style = ACCENT[accent];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        {icon && (
          <div className={cn("shrink-0 rounded-lg p-2", style.icon)}>
            {icon}
          </div>
        )}
      </div>

      <div>
        <p className="text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </p>
        {description && (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        )}
      </div>

      {change && (
        <div className="flex items-center gap-1.5">
          {change.isPositive ? (
            <ArrowUpRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowDownRight className="size-3.5 text-red-600 dark:text-red-400" />
          )}
          <span
            className={cn(
              "text-xs font-semibold",
              change.isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {change.isPositive ? "+" : ""}
            {change.value}%
          </span>
          {change.period && (
            <span className="text-muted-foreground text-xs">
              {change.period}
            </span>
          )}
        </div>
      )}
    </>
  );

  const baseClassName = cn(
    "group border-border/60 bg-card flex flex-col gap-4 rounded-xl border p-5 transition-all duration-200",
    (href || onClick) &&
      "hover:shadow-primary/5 cursor-pointer hover:shadow-md",
    style.ring
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  if (!onClick) {
    return <div className={baseClassName}>{content}</div>;
  }

  return (
    <button
      className={cn(baseClassName, "text-left")}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  );
};

interface MetricsGridProps {
  metrics: MetricCardProps[];
  columns?: number;
}

export const MetricsGrid = ({ metrics, columns = 4 }: MetricsGridProps) => (
  <div
    className={cn(
      "grid gap-3",
      columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
      columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      columns === 2 && "sm:grid-cols-2"
    )}
  >
    {metrics.map((metric, idx) => (
      <MetricCard key={idx} {...metric} />
    ))}
  </div>
);
