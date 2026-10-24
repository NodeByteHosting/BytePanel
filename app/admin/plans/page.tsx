import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatMib } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { PlanDialog } from "./plan-dialog";

const AdminPlansPage = async () => {
  await requireAdmin();
  const [plans, locations] = await Promise.all([
    prisma.plan.findMany({
      include: {
        _count: { select: { servers: { where: { deletedAt: null } } } },
        location: true,
      },
      orderBy: [{ sort: "asc" }, { priceMonthCents: "asc" }],
    }),
    prisma.location.findMany({ orderBy: { short: "asc" } }),
  ]);
  const locationOptions = locations.map((l) => ({
    id: l.id,
    label: l.long ?? l.short,
  }));

  return (
    <>
      <PageHeader
        actions={<PlanDialog locations={locationOptions} />}
        title="Plans"
      />
      <PageBody>
        <Panel>
          <PanelCard className="flex flex-col gap-1">
            {plans.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No plans yet. Plans are the resource bundles customers buy
                (memory, CPU, disk, backups, ports).
              </p>
            )}
            {plans.map((plan) => (
              <div
                className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
                key={plan.id}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {plan.name}
                    {!plan.active && <Badge variant="outline">inactive</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMib(plan.memory)} RAM ·{" "}
                    {plan.cpu > 0 ? `${plan.cpu}% CPU` : "unlimited CPU"} ·{" "}
                    {formatMib(plan.disk)} disk · {plan.backupLimit} backups ·{" "}
                    {plan.allocationLimit} ports ·{" "}
                    {plan.location
                      ? (plan.location.long ?? plan.location.short)
                      : "any location"}{" "}
                    · {plan._count.servers} servers
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {(plan.priceMonthCents / 100).toFixed(2)} {plan.currency}/mo
                  </span>
                  <PlanDialog
                    initial={{
                      active: plan.active,
                      allocationLimit: plan.allocationLimit,
                      backupLimit: plan.backupLimit,
                      cpu: plan.cpu,
                      currency: plan.currency,
                      description: plan.description ?? "",
                      disk: plan.disk,
                      io: plan.io,
                      locationId: plan.locationId,
                      memory: plan.memory,
                      name: plan.name,
                      priceMonthCents: plan.priceMonthCents,
                      sort: plan.sort,
                      swap: plan.swap,
                    }}
                    locations={locationOptions}
                    planId={plan.id}
                    removable={plan._count.servers === 0}
                  />
                </div>
              </div>
            ))}
          </PanelCard>
        </Panel>
      </PageBody>
    </>
  );
};

export default AdminPlansPage;
