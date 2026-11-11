import { redirect } from "next/navigation";

import { formatMoney } from "@/lib/billing/money";
import { listStoreProducts } from "@/lib/bytepay";
import { prisma } from "@/lib/db";
import { env, paypalEnabled, stripeEnabled } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { BillingNotice } from "../components/billing-notice";
import { ExternalStoreNotice } from "../components/external-store-notice";
import { PageBody, PageHeader } from "../components/page-header";
import { CheckoutForm } from "./checkout-form";
import { OrderForm } from "./order-form";

const eggOptions = async () => {
  const eggs = await prisma.egg.findMany({
    orderBy: { name: "asc" },
    where: { enabled: true },
  });
  return eggs.map((egg) => ({
    id: egg.id,
    minDisk: egg.minDisk,
    minMemory: egg.minMemory,
    name: egg.name,
    ports: Math.max(
      1,
      Array.isArray(egg.containerPorts) ? egg.containerPorts.length : 0
    ),
  }));
};

const locationOptions = async () => {
  const locations = await prisma.location.findMany({
    orderBy: { short: "asc" },
    where: { nodes: { some: { maintenanceMode: false, public: true } } },
  });
  return locations.map((location) => ({
    id: location.id,
    name: location.long ?? location.short,
  }));
};

const BuiltinCheckout = async ({
  canceled,
  currency,
}: {
  canceled: boolean;
  currency: string;
}) => {
  const providers = [
    ...(stripeEnabled ? (["stripe"] as const) : []),
    ...(paypalEnabled ? (["paypal"] as const) : []),
  ];
  const [plans, eggs, locations] = await Promise.all([
    prisma.plan.findMany({
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      where: { active: true, priceMonthCents: { gt: 0 } },
    }),
    eggOptions(),
    locationOptions(),
  ]);
  if (!providers.length || !plans.length) {
    return (
      <BillingNotice
        description="Servers can't be ordered yet. Please check back soon or contact support."
        title="Ordering isn't open yet"
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {canceled && (
        <p className="text-muted-foreground text-sm">
          Checkout was cancelled. You haven’t been charged.
        </p>
      )}
      <CheckoutForm
        eggs={eggs}
        locations={locations}
        plans={plans.map((plan) => ({
          allocationLimit: plan.allocationLimit,
          cpu: plan.cpu,
          description: plan.description,
          disk: plan.disk,
          id: plan.id,
          locationId: plan.locationId,
          memory: plan.memory,
          name: plan.name,
          price: formatMoney(plan.priceMonthCents ?? 0, currency),
        }))}
        providers={providers}
      />
    </div>
  );
};

const NewServerPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) => {
  await requireUser();
  const settings = await getPanelSettings();
  if (settings.billingProvider === "builtin") {
    const { canceled } = await searchParams;
    return (
      <>
        <PageHeader title="New server" />
        <PageBody>
          <BuiltinCheckout
            canceled={canceled === "1"}
            currency={settings.currency}
          />
        </PageBody>
      </>
    );
  }
  const products =
    settings.billingProvider === "bytepay" ? await listStoreProducts() : null;

  if (products?.length && env.BYTEPAY_URL) {
    const [plans, eggs, locations] = await Promise.all([
      prisma.plan.findMany({ where: { active: true } }),
      eggOptions(),
      locationOptions(),
    ]);
    return (
      <>
        <PageHeader title="New server" />
        <PageBody>
          <OrderForm
            eggs={eggs}
            locations={locations}
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
