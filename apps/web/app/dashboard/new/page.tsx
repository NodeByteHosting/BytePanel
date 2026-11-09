import { redirect } from "next/navigation";

import { listStoreProducts } from "@/lib/bytepay";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { ExternalStoreNotice } from "../components/external-store-notice";
import { PageBody, PageHeader } from "../components/page-header";
import { OrderForm } from "./order-form";

const NewServerPage = async () => {
  await requireUser();
  const [settings, products] = await Promise.all([
    getPanelSettings(),
    listStoreProducts(),
  ]);

  if (products?.length && env.BYTEPAY_URL) {
    const [plans, eggs, locations] = await Promise.all([
      prisma.plan.findMany({ where: { active: true } }),
      prisma.egg.findMany({
        orderBy: { name: "asc" },
        where: { enabled: true },
      }),
      prisma.location.findMany({
        orderBy: { short: "asc" },
        where: { nodes: { some: { maintenanceMode: false, public: true } } },
      }),
    ]);
    return (
      <>
        <PageHeader title="New server" />
        <PageBody>
          <OrderForm
            eggs={eggs.map((egg) => ({
              id: egg.id,
              minDisk: egg.minDisk,
              minMemory: egg.minMemory,
              name: egg.name,
              ports: Math.max(
                1,
                Array.isArray(egg.containerPorts)
                  ? egg.containerPorts.length
                  : 0
              ),
            }))}
            locations={locations.map((location) => ({
              id: location.id,
              name: location.long ?? location.short,
            }))}
            plans={plans.map((plan) => ({
              allocationLimit: plan.allocationLimit,
              disk: plan.disk,
              id: plan.id,
              locationId: plan.locationId,
              memory: plan.memory,
            }))}
            products={products}
            storeUrl={env.BYTEPAY_URL}
          />
        </PageBody>
      </>
    );
  }

  if (settings.storeUrl) {
    redirect(settings.storeUrl);
  }
  return (
    <>
      <PageHeader title="New server" />
      <PageBody>
        <ExternalStoreNotice
          description="New servers are ordered through our store. Once your order is complete, the server appears here."
          storeUrl={settings.storeUrl}
          title="Order from our store"
        />
      </PageBody>
    </>
  );
};

export default NewServerPage;
