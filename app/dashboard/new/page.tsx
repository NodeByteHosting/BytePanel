import { prisma } from "@/lib/db";
import { loadEggCatalog } from "@/lib/eggs/catalog";
import { requireUser } from "@/lib/session";
import { getPanelSettings, isExternalBilling } from "@/lib/settings";

import { ExternalStoreNotice } from "../components/external-store-notice";
import { PageBody, PageHeader } from "../components/page-header";
import { NewServerForm } from "./components/form";

const NewServerPage = async () => {
  await requireUser();
  const settings = await getPanelSettings();
  if (isExternalBilling(settings.billingMode)) {
    return (
      <>
        <PageHeader title="New server" />
        <PageBody>
          <ExternalStoreNotice
            description="New servers are ordered through our store. Once your order is paid it appears here automatically."
            storeUrl={settings.storeUrl}
            title="Order from our store"
          />
        </PageBody>
      </>
    );
  }
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
