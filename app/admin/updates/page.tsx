import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/session";
import { commitUrl, PANEL_BUILD, REPOS, shortSha } from "@/lib/version";
import type { Component, LatestRelease } from "@/lib/version";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { CheckForUpdatesButton } from "./check-button";
import { getUpdateOverview } from "./overview";
import { StatusBadge } from "./status-badge";

const Commit = ({
  component,
  sha,
}: {
  component: Component;
  sha: string | null | undefined;
}) =>
  sha ? (
    <Link
      className="font-mono hover:underline"
      href={commitUrl(component, sha)}
      rel="noreferrer"
      target="_blank"
    >
      {shortSha(sha)}
    </Link>
  ) : (
    <span className="text-muted-foreground">unknown</span>
  );

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

const LatestRows = ({
  component,
  latest,
}: {
  component: Component;
  latest: LatestRelease;
}) => (
  <>
    <Row label="Latest release">
      <Link
        className="hover:underline"
        href={latest.url}
        rel="noreferrer"
        target="_blank"
      >
        {latest.name}
      </Link>
      {latest.publishedAt && (
        <span className="text-muted-foreground">
          {" "}
          ·{" "}
          {formatDistanceToNow(new Date(latest.publishedAt), {
            addSuffix: true,
          })}
        </span>
      )}
    </Row>
    <Row label="Latest version">v{latest.version}</Row>
    <Row label="Release commit">
      <Commit component={component} sha={latest.commit.sha} />{" "}
      <span className="text-muted-foreground">{latest.commit.message}</span>
    </Row>
  </>
);

const AdminUpdatesPage = async () => {
  await requireAdmin();
  const { agent, panel } = await getUpdateOverview();
  const panelLatest = panel.latest;
  const agentLatest = agent.latest;

  return (
    <>
      <PageHeader meta={<CheckForUpdatesButton />} title="Updates" />
      <PageBody>
        <div className="flex flex-col gap-4">
          <Panel action={<StatusBadge status={panel.status} />} title="Panel">
            <PanelCard className="flex flex-col gap-2">
              <Row label="Installed version">v{PANEL_BUILD.version}</Row>
              <Row label="Installed commit">
                <Commit component="panel" sha={PANEL_BUILD.commit} />
              </Row>
              {panelLatest.ok ? (
                <LatestRows component="panel" latest={panelLatest.data} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Couldn&apos;t check {REPOS.panel}: {panelLatest.error}
                </p>
              )}
            </PanelCard>
          </Panel>

          <Panel title="Agent">
            <PanelCard className="flex flex-col gap-2">
              {agentLatest.ok ? (
                <LatestRows component="agent" latest={agentLatest.data} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Couldn&apos;t check {REPOS.agent}: {agentLatest.error}
                </p>
              )}
            </PanelCard>
            <PanelCard className="flex flex-col gap-1">
              {agent.nodes.length === 0 && (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  No nodes yet.
                </p>
              )}
              {agent.nodes.map(({ info, node, status }) => (
                <Link
                  className="hover:bg-muted/40 flex items-center justify-between gap-4 rounded-lg px-3 py-2"
                  href={`/admin/nodes/${node.id}`}
                  key={node.id}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{node.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {info
                        ? `v${info.version} · ${shortSha(info.commit) ?? "unknown commit"}`
                        : "Unreachable"}
                    </span>
                  </div>
                  {status ? (
                    <StatusBadge status={status} />
                  ) : (
                    <Badge
                      className="border-red-500/40 bg-red-500/10 text-red-600"
                      variant="outline"
                    >
                      Offline
                    </Badge>
                  )}
                </Link>
              ))}
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminUpdatesPage;
