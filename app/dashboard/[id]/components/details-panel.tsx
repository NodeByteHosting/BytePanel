import { Panel, PanelCard } from "@/components/panel";
import { formatMib } from "@/lib/format";

import type { ServerView } from "./server-context";

const Row = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={
        mono ? "text-right font-mono text-xs break-all" : "font-medium"
      }
    >
      {value}
    </span>
  </div>
);

export const DetailsPanel = ({ server }: { server: ServerView }) => (
  <Panel>
    <PanelCard className="flex flex-col gap-1">
      {server.planName && <Row label="Plan" value={server.planName} />}
      <Row label="Game" value={server.game?.name ?? "Unknown"} />
      <Row label="Memory" value={formatMib(server.limits.memory)} />
      <Row
        label="CPU"
        value={
          server.limits.cpu > 0
            ? `${server.limits.cpu}% (${(server.limits.cpu / 100).toFixed(1)} cores)`
            : "Unlimited"
        }
      />
      <Row label="Disk" value={formatMib(server.limits.disk)} />
      <Row label="Backups" value={String(server.limits.backupLimit)} />
      <Row label="Ports" value={String(server.limits.allocationLimit)} />
      {server.node && <Row label="Node" value={server.node.name} />}
      {server.node?.location && (
        <Row label="Location" value={server.node.location} />
      )}
      <Row label="Docker image" mono value={server.image} />
      <Row label="Server ID" mono value={server.uuid} />
    </PanelCard>
  </Panel>
);
