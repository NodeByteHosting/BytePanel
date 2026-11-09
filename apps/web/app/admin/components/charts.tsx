"use client";

import React from "react";

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface SimpleBarChartProps {
  data: ChartDataPoint[];
  title: string;
  description?: string;
  height?: number;
  format?: (value: number) => string;
}

const defaultFormat = (value: number) => value.toString();

export const SimpleBarChart = ({
  data,
  title,
  description,
  height = 200,
  format = defaultFormat,
}: SimpleBarChartProps) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="border-border/60 bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((point, idx) => (
          <div
            key={idx}
            className="group flex flex-1 flex-col items-center gap-1.5"
            style={{ height: "100%" }}
          >
            <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
              <div
                className="bg-primary/70 group-hover:bg-primary w-full rounded-t-md transition-all"
                style={{ height: `${(point.value / maxValue) * 100}%` }}
                title={`${point.label}: ${format(point.value)}`}
              />
            </div>
            <span className="text-muted-foreground w-full truncate text-center text-[10px]">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SimpleLineChartProps {
  data: ChartDataPoint[];
  title: string;
  description?: string;
  height?: number;
  format?: (value: number) => string;
}

export const SimpleLineChart = ({
  data,
  title,
  description,
  height = 200,
  format = defaultFormat,
}: SimpleLineChartProps) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;

  const pathPoints = data
    .map((point, idx) => {
      const x = (idx / Math.max(data.length - 1, 1)) * 100;
      const y = ((maxValue - point.value) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="border-border/60 bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      <div style={{ height }} className="relative">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              strokeOpacity="0.5"
            />
          ))}
          <polyline
            points={`0,100 ${pathPoints} 100,100`}
            fill="url(#lineGradient)"
          />
          <polyline
            points={pathPoints}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {data.map((point, idx) => {
            const x = (idx / Math.max(data.length - 1, 1)) * 100;
            const y = ((maxValue - point.value) / range) * 100;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="2"
                fill="hsl(var(--primary))"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>
      <div className="border-border/50 grid grid-cols-3 gap-4 border-t pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Highest</p>
          <p className="font-semibold">{format(maxValue)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Average</p>
          <p className="font-semibold">
            {format(
              Math.round(data.reduce((a, b) => a + b.value, 0) / data.length)
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Lowest</p>
          <p className="font-semibold">{format(minValue)}</p>
        </div>
      </div>
    </div>
  );
};
