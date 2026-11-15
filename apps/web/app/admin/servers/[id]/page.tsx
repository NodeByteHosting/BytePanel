import Link from "next/link";
import { notFound } from "next/navigation";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import {
  PageBody,
  PageHeader,
} from "../../../dashboard/components/page-header";
import { BuildForm, ServerAdminActions } from "./server-admin-client";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

const AdminServerPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  await requireAdmin();
  const { id } = await params;
  const [server, nodes] = await Promise.all([
    prisma.server.findFirst({
      include: {
        allocations: { orderBy: { port: "asc" } },
        egg: { include: { nest: true } },
        node: true,
        plan: true,
        user: { select: { email: true, id: true, name: true } },
      },
      where: { deletedAt: null, id },
    }),
    prisma.node.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!server) {
    notFound();
  }

  return (
    <>
      <PageHeader
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/${server.id}`}>Open in dashboard</Link>
          </Button>
        }
        meta={
          <Badge variant="outline">
            {server.status?.replaceAll("_", " ") ??
              (server.nodeId ? "installed" : "not deployed")}
          </Badge>
        }
        title={server.name}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <Panel title="Overview">
            <PanelCard className="flex flex-col">
              <Row label="Owner">
                {server.user.name} ({server.user.email})
              </Row>
              <Row label="Egg">
                {server.egg
                  ? `${server.egg.nest.name} / ${server.egg.name}`
                  : "-"}
              </Row>
              <Row label="Node">
                {server.node ? (
                  <Link
                    className="hover:underline"
                    href={`/admin/nodes/${server.node.id}`}
                  >
                    {server.node.name}
                  </Link>
                ) : (
                  "-"
                )}
              </Row>
              <Row label="Allocations">
                <span className="font-mono text-xs">
                  {server.allocations
                    .map(
                      (a) =>
                        `${a.ipAlias ?? a.ip}:${a.port}${a.id === server.allocationId ? "*" : ""}`
                    )
                    .join(", ") || "-"}
                </span>
              </Row>
              <Row label="Plan">{server.plan?.name ?? "Custom"}</Row>
              <Row label="UUID">
                <code className="text-xs">{server.uuid}</code>
              </Row>
              <Row label="Image">
                <code className="text-xs">{server.image}</code>
              </Row>
              {server.errorReason && (
                <Row label="Last error">{server.errorReason}</Row>
              )}
            </PanelCard>
          </Panel>

          <ServerAdminActions
            deployed={server.nodeId !== null}
            nodes={nodes}
            serverId={server.id}
            suspended={server.status === "suspended"}
          />

          <Panel title="Build configuration">
            <PanelCard>
              <BuildForm
                initial={{
                  allocationLimit: server.allocationLimit,
                  backupLimit: server.backupLimit,
                  cpu: server.cpu,
                  disk: server.disk,
                  io: server.io,
                  memory: server.memory,
                  oomDisabled: server.oomDisabled,
                  swap: server.swap,
                  threads: server.threads,
                }}
                serverId={server.id}
              />
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminServerPage;
