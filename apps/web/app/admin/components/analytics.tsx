"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AnalyticsPeriod {
  label: string;
  value: "day" | "week" | "month" | "year";
}

interface PeriodSelectorProps {
  periods: AnalyticsPeriod[];
  selected: string;
  onSelect: (value: string) => void;
  className?: string;
}

export const PeriodSelector = ({
  periods,
  selected,
  onSelect,
  className,
}: PeriodSelectorProps) => (
  <div className={cn("flex flex-wrap gap-2", className)}>
    {periods.map((period) => (
      <button
        type="button"
        key={period.value}
        onClick={() => onSelect(period.value)}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          selected === period.value
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        {period.label}
      </button>
    ))}
  </div>
);

interface AnalyticsHeaderProps {
  title: string;
  description?: string;
  periods?: AnalyticsPeriod[];
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

export const AnalyticsHeader = ({
  title,
  description,
  periods,
  selectedPeriod = "month",
  onPeriodChange,
}: AnalyticsHeaderProps) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description && (
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      )}
    </div>

    {periods && onPeriodChange && (
      <PeriodSelector
        periods={periods}
        selected={selectedPeriod}
        onSelect={onPeriodChange}
      />
    )}
  </div>
);

interface ComparisonMetricProps {
  current: number | string;
  previous?: number | string;
  format?: (value: number | string) => string;
  label: string;
  unit?: string;
  trend?: "up" | "down" | "neutral";
}

export const ComparisonMetric = ({
  current,
  previous,
  format = String,
  label,
  unit,
  trend: _trend,
}: ComparisonMetricProps) => {
  const calculateChange = (): {
    percentage: number;
    direction: "up" | "down";
  } | null => {
    if (
      !previous ||
      typeof previous !== "number" ||
      typeof current !== "number"
    ) {
      return null;
    }
    const pct = ((current - previous) / previous) * 100;
    return {
      direction: pct > 0 ? "up" : "down",
      percentage: Math.abs(pct),
    };
  };

  const change = calculateChange();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {format(current)}
            {unit && (
              <span className="text-muted-foreground ml-1 text-sm">{unit}</span>
            )}
          </div>

          {change && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                change.direction === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {change.direction === "up" ? "↑" : "↓"}{" "}
              {change.percentage.toFixed(1)}% from last period
            </div>
          )}

          {previous && (
            <div className="text-muted-foreground text-xs">
              Previous: {format(previous)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  color?: "emerald" | "amber" | "red" | "blue";
  className?: string;
}

export const Gauge = ({
  value,
  max,
  label,
  color = "blue",
  className,
}: GaugeProps) => {
  const percentage = (value / max) * 100;
  const colorMap = {
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-2xl font-bold">
          {value} / {max}
        </div>

        <div className="space-y-1">
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn("h-full transition-all", colorMap[color])}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="text-muted-foreground text-right text-xs">
            {percentage.toFixed(1)}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
