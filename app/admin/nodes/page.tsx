import Link from "next/link";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatMib } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { EMPTY_NODE, NodeForm } from "./node-form";

const pct = (used: number, total: number) =>
  total > 0 ? Math.round((used / total) * 100) : 0;

const AdminNodesPage = async () => {
  await requireAdmin();
  const [nodes, locations] = await Promise.all([
    prisma.node.findMany({
      include: {
        _count: { select: { allocations: true } },
        location: true,
        servers: {
          select: { disk: true, memory: true },
          where: { deletedAt: null },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({ orderBy: { short: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Nodes" />
      <PageBody>
        <div className="flex flex-col gap-4">
          <Panel title={`Nodes (${nodes.length})`}>
            <PanelCard className="flex flex-col gap-1">
              {nodes.length === 0 && (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  No nodes yet. A node is a machine running the NodeByte daemon;
                  many servers share one node.
                </p>
              )}
              {nodes.map((node) => {
                const memory = node.servers.reduce(
                  (sum, s) => sum + s.memory,
                  0
                );
                const disk = node.servers.reduce((sum, s) => sum + s.disk, 0);
                return (
                  <Link
                    className="hover:bg-muted/40 flex items-center justify-between gap-4 rounded-lg px-3 py-2"
                    href={`/admin/nodes/${node.id}`}
                    key={node.id}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {node.name}
                        {node.maintenanceMode && (
                          <Badge variant="outline">Maintenance</Badge>
                        )}
                        {!node.public && (
                          <Badge variant="outline">Private</Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {node.scheme}://{node.fqdn}:{node.daemonListen} ·{" "}
                        {node.location.short}
                      </span>
                    </div>
                    <div className="text-muted-foreground hidden gap-6 text-right text-xs sm:flex">
                      <span>
                        Memory {formatMib(memory)} / {formatMib(node.memory)} (
                        {pct(memory, node.memory)}%)
                      </span>
                      <span>
                        Disk {formatMib(disk)} / {formatMib(node.disk)} (
                        {pct(disk, node.disk)}%)
                      </span>
                      <span>
                        {node.servers.length} servers ·{" "}
                        {node._count.allocations} ports
                      </span>
                    </div>
                  </Link>
                );
              })}
            </PanelCard>
          </Panel>
          <Panel title="Add node">
            <PanelCard>
              <NodeForm initial={EMPTY_NODE} locations={locations} />
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminNodesPage;
