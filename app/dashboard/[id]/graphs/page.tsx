"use client";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Panel, PanelCard } from "@/components/panel";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { formatBytes, formatClock } from "@/lib/format";

import { useDaemonSocket } from "../components/daemon-socket";
import { useServer } from "../components/server-context";

const cpuConfig = {
  cpu: { color: "var(--chart-1)", label: "CPU %" },
} satisfies ChartConfig;
const memoryConfig = {
  memory: { color: "var(--chart-2)", label: "Memory" },
} satisfies ChartConfig;
const networkConfig = {
  rx: { color: "var(--chart-3)", label: "Inbound" },
  tx: { color: "var(--chart-4)", label: "Outbound" },
} satisfies ChartConfig;

type Point = ReturnType<typeof useDaemonSocket>["history"][number];

const LiveChart = ({
  title,
  config,
  data,
  keys,
  yFormat,
  yMax,
}: {
  title: string;
  config: ChartConfig;
  data: Point[];
  keys: (keyof Point)[];
  yFormat: (v: number) => string;
  yMax?: number;
}) => (
  <Panel title={title}>
    <PanelCard>
      <ChartContainer className="aspect-[8/3]" config={config}>
        <AreaChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="t"
            minTickGap={48}
            tickFormatter={formatClock}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, yMax ?? "auto"]}
            tickFormatter={yFormat}
            tickLine={false}
            width={72}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => yFormat(Number(value))}
                labelFormatter={(_, payload) =>
                  formatClock(Number(payload?.[0]?.payload?.t ?? 0))
                }
              />
            }
          />
          {keys.map((key) => (
            <Area
              dataKey={key}
              fill={`var(--color-${String(key)})`}
              fillOpacity={0.2}
              isAnimationActive={false}
              key={String(key)}
              stroke={`var(--color-${String(key)})`}
              type="monotone"
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </PanelCard>
  </Panel>
);

// Live resource graphs fed by the daemon websocket (last ~2 minutes),
// like Pterodactyl's console graphs.
const GraphsTab = () => {
  const { server } = useServer();
  const { history, state } = useDaemonSocket();
  const memoryLimit =
    server.limits.memory > 0 ? server.limits.memory * 1024 * 1024 : undefined;
  const cpuLimit = server.limits.cpu > 0 ? server.limits.cpu : undefined;

  if (state !== "running" && state !== "starting" && history.length === 0) {
    return (
      <Panel>
        <PanelCard className="text-sm text-muted-foreground">
          Graphs show live usage while the server is running.
        </PanelCard>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <LiveChart
        config={cpuConfig}
        data={history}
        keys={["cpu"]}
        title="CPU"
        yFormat={(v) => `${v.toFixed(0)}%`}
        yMax={cpuLimit}
      />
      <LiveChart
        config={memoryConfig}
        data={history}
        keys={["memory"]}
        title="Memory"
        yFormat={(v) => formatBytes(v, 0)}
        yMax={memoryLimit}
      />
      <LiveChart
        config={networkConfig}
        data={history}
        keys={["rx", "tx"]}
        title="Network"
        yFormat={(v) => `${formatBytes(v, 0)}/s`}
      />
    </div>
  );
};

export default GraphsTab;
