import Link from "next/link";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/billing/money";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

const DAY_MS = 24 * 60 * 60 * 1000;

const recentRevenue = () =>
  prisma.payment.groupBy({
    _sum: { amountCents: true },
    by: ["currency"],
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * DAY_MS) },
      status: "paid",
    },
  });

const AdminBillingPage = async () => {
  await requireAdmin();
  const settings = await getPanelSettings();
  const [subscriptions, revenue] = await Promise.all([
    prisma.subscription.findMany({
      include: {
        plan: { select: { name: true } },
        server: { select: { id: true, name: true } },
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      where: { status: { not: "pending" } },
    }),
    recentRevenue(),
  ]);
  const active = subscriptions.filter((s) => s.status === "active").length;
  const pastDue = subscriptions.filter((s) => s.status === "past_due").length;

  return (
    <>
      <PageHeader title="Billing" />
      <PageBody>
        <div className="flex flex-col gap-6">
          {settings.billingProvider !== "builtin" && (
            <p className="text-muted-foreground text-sm">
              Built-in billing is off. Choose it in Settings to take payments in
              the panel.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <PanelCard className="flex flex-col gap-1 p-4">
              <span className="text-muted-foreground text-xs">Active</span>
              <span className="text-2xl font-semibold">{active}</span>
            </PanelCard>
            <PanelCard className="flex flex-col gap-1 p-4">
              <span className="text-muted-foreground text-xs">Payment due</span>
              <span className="text-2xl font-semibold">{pastDue}</span>
            </PanelCard>
            <PanelCard className="flex flex-col gap-1 p-4">
              <span className="text-muted-foreground text-xs">
                Paid in the last 30 days
              </span>
              <span className="text-2xl font-semibold">
                {revenue.length
                  ? revenue
                      .map((row) =>
                        formatMoney(row._sum.amountCents ?? 0, row.currency)
                      )
                      .join(" · ")
                  : formatMoney(0, settings.currency)}
              </span>
            </PanelCard>
          </div>

          <Panel title="Subscriptions">
            <PanelCard className="flex flex-col gap-1">
              {subscriptions.length === 0 && (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  No subscriptions yet.
                </p>
              )}
              {subscriptions.map((subscription) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2"
                  key={subscription.id}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {subscription.server ? (
                        <Link
                          className="hover:underline"
                          href={`/admin/servers/${subscription.server.id}`}
                        >
                          {subscription.server.name}
                        </Link>
                      ) : (
                        (subscription.plan?.name ?? "No server")
                      )}
                      <Badge
                        variant={
                          subscription.status === "past_due"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {subscription.status.replace("_", " ")}
                      </Badge>
                      {subscription.suspendedAt && (
                        <Badge variant="destructive">suspended</Badge>
                      )}
                      {subscription.cancelAtPeriodEnd &&
                        subscription.status === "active" && (
                          <Badge variant="secondary">ending</Badge>
                        )}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {subscription.user.email} ·{" "}
                      {formatMoney(
                        subscription.priceMonthCents,
                        subscription.currency
                      )}
                      /mo ·{" "}
                      {subscription.provider === "stripe" ? "Stripe" : "PayPal"}
                      {subscription.currentPeriodEnd &&
                        ` · period ends ${dateFormat.format(subscription.currentPeriodEnd)}`}
                    </span>
                  </div>
                  <span className="text-muted-foreground font-mono text-xs">
                    {subscription.providerSubscriptionId}
                  </span>
                </div>
              ))}
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminBillingPage;
