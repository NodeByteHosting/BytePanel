import Link from "next/link";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import {
  CreateNestForm,
  DeleteNestButton,
  ImportEggDialog,
  SyncBuiltinsButton,
} from "./nests-client";

const AdminNestsPage = async () => {
  await requireAdmin();
  const nests = await prisma.nest.findMany({
    include: {
      eggs: {
        include: {
          _count: { select: { servers: { where: { deletedAt: null } } } },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        actions={
          <div className="flex gap-2">
            <SyncBuiltinsButton />
            <ImportEggDialog
              nests={nests.map((n) => ({ id: n.id, name: n.name }))}
            />
          </div>
        }
        title="Nests & Eggs"
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          {nests.length === 0 && (
            <Panel>
              <PanelCard className="text-sm text-muted-foreground">
                No eggs yet. Sync the built-in NodeByte games, or import
                Pterodactyl eggs (PTDL JSON) into a nest.
              </PanelCard>
            </Panel>
          )}
          {nests.map((nest) => (
            <Panel
              action={
                nest.eggs.length === 0 ? (
                  <DeleteNestButton id={nest.id} />
                ) : undefined
              }
              key={nest.id}
              title={nest.name}
            >
              <PanelCard className="flex flex-col gap-1">
                {nest.eggs.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No eggs in this nest.
                  </p>
                )}
                {nest.eggs.map((egg) => (
                  <Link
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-muted/40"
                    href={`/admin/eggs/${egg.id}`}
                    key={egg.id}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {egg.name}
                        {egg.slug ? (
                          <Badge variant="outline">built-in</Badge>
                        ) : (
                          <Badge variant="outline">imported</Badge>
                        )}
                        {!egg.enabled && (
                          <Badge variant="outline">hidden</Badge>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {egg.description}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {egg._count.servers} servers
                    </span>
                  </Link>
                ))}
              </PanelCard>
            </Panel>
          ))}
          <Panel title="New nest">
            <PanelCard>
              <CreateNestForm />
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminNestsPage;
