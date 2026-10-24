import { prisma } from "@/lib/db";
import { loadEggCatalog } from "@/lib/eggs/catalog";
import { requireUser } from "@/lib/session";

import { NewServerForm } from "./components/form";

const NewServerPage = async () => {
  await requireUser();
  const [eggs, plans, locations] = await Promise.all([
    loadEggCatalog({ includeDisabled: false }),
    prisma.plan.findMany({
      orderBy: [{ sort: "asc" }, { priceMonthCents: "asc" }],
      where: { active: true },
    }),
    // Only locations with at least one node that accepts new servers.
    prisma.location.findMany({
      orderBy: { short: "asc" },
      where: { nodes: { some: { maintenanceMode: false, public: true } } },
    }),
  ]);

  return (
    <NewServerForm
      eggs={eggs}
      locations={locations.map((l) => ({
        id: l.id,
        long: l.long,
        short: l.short,
      }))}
      plans={plans.map((p) => ({
        allocationLimit: p.allocationLimit,
        backupLimit: p.backupLimit,
        cpu: p.cpu,
        currency: p.currency,
        description: p.description,
        disk: p.disk,
        id: p.id,
        locationId: p.locationId,
        memory: p.memory,
        name: p.name,
        priceMonthCents: p.priceMonthCents,
      }))}
    />
  );
};

export default NewServerPage;
