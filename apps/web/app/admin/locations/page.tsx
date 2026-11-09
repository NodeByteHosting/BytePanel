import { Panel, PanelCard } from "@/components/panel";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { CreateLocationForm, DeleteLocationButton } from "./locations-client";

const AdminLocationsPage = async () => {
  await requireAdmin();
  const locations = await prisma.location.findMany({
    include: { _count: { select: { nodes: true } } },
    orderBy: { short: "asc" },
  });

  return (
    <>
      <PageHeader title="Locations" />
      <PageBody>
        <div className="flex flex-col gap-4">
          <Panel title="New location">
            <PanelCard>
              <CreateLocationForm />
            </PanelCard>
          </Panel>
          <Panel title={`Locations (${locations.length})`}>
            <PanelCard className="flex flex-col gap-1">
              {locations.length === 0 && (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  No locations yet. Nodes are grouped into locations (e.g.
                  uk-lon, de-fsn).
                </p>
              )}
              {locations.map((location) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
                  key={location.id}
                >
                  <div className="flex flex-col">
                    <code className="text-sm font-medium">
                      {location.short}
                    </code>
                    <span className="text-muted-foreground text-xs">
                      {location.long ?? "No description"} ·{" "}
                      {location._count.nodes} node(s)
                    </span>
                  </div>
                  <DeleteLocationButton
                    disabled={location._count.nodes > 0}
                    id={location.id}
                  />
                </div>
              ))}
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminLocationsPage;
