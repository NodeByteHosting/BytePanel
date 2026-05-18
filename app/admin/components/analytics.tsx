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
  <div className={cn("flex gap-2 flex-wrap", className)}>
    {periods.map((period) => (
      <button
        key={period.value}
        onClick={() => onSelect(period.value)}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
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
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {format(current)}
            {unit && (
              <span className="text-sm text-muted-foreground ml-1">{unit}</span>
            )}
          </div>

          {change && (
            <div
              className={cn(
                "text-xs font-medium flex items-center gap-1",
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
            <div className="text-xs text-muted-foreground">
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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-2xl font-bold">
          {value} / {max}
        </div>

        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full transition-all", colorMap[color])}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {percentage.toFixed(1)}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
