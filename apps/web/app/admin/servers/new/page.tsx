import { prisma } from "@/lib/db";
import { loadEggCatalog } from "@/lib/eggs/catalog";
import { requireAdmin } from "@/lib/session";

import {
  PageBody,
  PageHeader,
} from "../../../dashboard/components/page-header";
import { CreateServerForm } from "./create-server-form";

const AdminNewServerPage = async () => {
  await requireAdmin();
  const [eggs, nodes, locations, plans] = await Promise.all([
    loadEggCatalog({ includeDisabled: true }),
    prisma.node.findMany({
      orderBy: { name: "asc" },
      select: { id: true, locationId: true, name: true },
    }),
    prisma.location.findMany({ orderBy: { short: "asc" } }),
    prisma.plan.findMany({
      orderBy: [{ sort: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <>
      <PageHeader title="Create server" />
      <PageBody>
        <CreateServerForm
          eggs={eggs}
          locations={locations.map((l) => ({
            id: l.id,
            label: l.long ?? l.short,
          }))}
          nodes={nodes}
          plans={plans.map((p) => ({
            allocationLimit: p.allocationLimit,
            backupLimit: p.backupLimit,
            cpu: p.cpu,
            disk: p.disk,
            id: p.id,
            io: p.io,
            memory: p.memory,
            name: p.name,
            swap: p.swap,
          }))}
        />
      </PageBody>
    </>
  );
};

export default AdminNewServerPage;
