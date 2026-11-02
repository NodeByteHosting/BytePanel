import type { Node } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { DaemonClient } from "@/lib/daemon/client";
import { buildNodeDaemonConfig } from "@/lib/daemon/configuration";
import { prisma } from "@/lib/db";
import { API_URL } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { getLatestRelease, shortSha, updateStatus } from "@/lib/version";
import type { SystemInfo } from "@/protocol";

import {
  PageBody,
  PageHeader,
} from "../../../dashboard/components/page-header";
import { StatusBadge } from "../../updates/status-badge";
import { NodeForm } from "../node-form";
import { AllocationManager, CopyBlock, NodeDangerZone } from "./node-client";

const fetchSystem = async (node: Node) => {
  try {
    return { info: await new DaemonClient(node).system(), ok: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unreachable",
      ok: false as const,
    };
  }
};

const fetchAgentStatus = async (info: SystemInfo) => {
  const latest = await getLatestRelease("agent");
  if (!latest.ok) {
    return "unknown";
  }
  return updateStatus(info, latest.data);
};

const AdminNodePage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  await requireAdmin();
  const { id } = await params;
  const [node, locations] = await Promise.all([
    prisma.node.findUnique({
      include: {
        allocations: {
          include: { server: { select: { id: true, name: true } } },
          orderBy: [{ ip: "asc" }, { port: "asc" }],
        },
        servers: { select: { id: true }, where: { deletedAt: null } },
      },
      where: { id },
    }),
    prisma.location.findMany({ orderBy: { short: "asc" } }),
  ]);
  if (!node) {
    notFound();
  }

  const system = await fetchSystem(node);
  const config = buildNodeDaemonConfig(node);
  const configureCommand = `nodebyte-daemon configure --panel ${API_URL} --token ${node.daemonTokenId}.${config.token}`;
  const info: SystemInfo | null = system.ok ? system.info : null;
  const agentStatus = info ? await fetchAgentStatus(info) : null;

  return (
    <>
      <PageHeader
        meta={
          system.ok ? (
            <div className="flex items-center gap-2">
              <Badge
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                variant="outline"
              >
                Online · v{info?.version}
                {info?.commit && ` (${shortSha(info.commit)})`}
              </Badge>
              {agentStatus && agentStatus !== "unknown" && (
                <Link href="/admin/updates">
                  <StatusBadge status={agentStatus} />
                </Link>
              )}
            </div>
          ) : (
            <Badge
              className="border-red-500/40 bg-red-500/10 text-red-600"
              variant="outline"
            >
              Offline
            </Badge>
          )
        }
        title={node.name}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <Panel title="Daemon">
            <PanelCard className="flex flex-col gap-2 text-sm">
              {info ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <span>
                    <span className="text-muted-foreground">OS:</span> {info.os}{" "}
                    {info.kernelVersion} ({info.architecture})
                  </span>
                  <span>
                    <span className="text-muted-foreground">CPU threads:</span>{" "}
                    {info.cpuCount}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Docker:</span>{" "}
                    {info.dockerVersion ?? "unavailable"}
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  The panel can&apos;t reach this node (
                  {system.ok ? "" : system.error}). Install and configure the
                  daemon below.
                </p>
              )}
            </PanelCard>
          </Panel>

          <Panel title="Install">
            <PanelCard className="flex flex-col gap-3 text-sm">
              <ol className="ml-4 list-decimal space-y-1.5">
                <li>
                  Install Docker on the node and open the daemon port (
                  {node.daemonListen}), the SFTP port ({node.daemonSftp}) and
                  your allocation ports.
                </li>
                <li>
                  Build the daemon with <code>bun run agent:build</code> and
                  copy <code>dist/nodebyte-daemon</code> to{" "}
                  <code>/usr/local/bin/</code>, with{" "}
                  <code>agent/install/nodebyte-daemon.service</code> in{" "}
                  <code>/etc/systemd/system/</code>.
                </li>
                <li>
                  {node.scheme === "https" && !node.behindProxy
                    ? `Issue a certificate: certbot certonly --standalone -d ${node.fqdn}`
                    : "No certificate needed for this node's scheme."}
                </li>
                <li>Configure and start it:</li>
              </ol>
              <CopyBlock
                secret
                value={`${configureCommand}\nsystemctl enable --now nodebyte-daemon`}
              />
              <details>
                <summary className="text-muted-foreground cursor-pointer">
                  Or write /etc/nodebyte/daemon.json by hand
                </summary>
                <CopyBlock secret value={JSON.stringify(config, null, 2)} />
              </details>
            </PanelCard>
          </Panel>

          <Panel title={`Allocations (${node.allocations.length})`}>
            <PanelCard>
              <AllocationManager
                allocations={node.allocations.map((a) => ({
                  alias: a.ipAlias,
                  id: a.id,
                  ip: a.ip,
                  port: a.port,
                  server: a.server,
                }))}
                nodeId={node.id}
              />
            </PanelCard>
          </Panel>

          <Panel title="Settings">
            <PanelCard>
              <NodeForm
                initial={{
                  behindProxy: node.behindProxy,
                  daemonBase: node.daemonBase,
                  daemonListen: node.daemonListen,
                  daemonSftp: node.daemonSftp,
                  description: node.description ?? "",
                  disk: node.disk,
                  diskOverallocate: node.diskOverallocate,
                  fqdn: node.fqdn,
                  locationId: node.locationId,
                  maintenanceMode: node.maintenanceMode,
                  memory: node.memory,
                  memoryOverallocate: node.memoryOverallocate,
                  name: node.name,
                  public: node.public,
                  scheme: node.scheme === "http" ? "http" : "https",
                  uploadSize: node.uploadSize,
                }}
                locations={locations}
                nodeId={node.id}
              />
            </PanelCard>
          </Panel>

          <NodeDangerZone
            hasServers={node.servers.length > 0}
            nodeId={node.id}
          />
        </div>
      </PageBody>
    </>
  );
};

export default AdminNodePage;
