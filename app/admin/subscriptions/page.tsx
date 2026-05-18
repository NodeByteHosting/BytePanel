import { DollarSign, ExternalLink, Receipt, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { MetricCard } from "../components";

const subStatusClass = (status: string): string => {
  if (status === "active") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "past_due" || status === "unpaid") {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return "border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
};

const invoiceStatusClass = (status: string): string => {
  if (status === "paid") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "open") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (status === "void" || status === "uncollectible") {
    return "border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400";
  }
  return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
};

const AdminSubscriptionsPage = async () => {
  await requireSuperAdmin();

  const [subscriptions, revenueByStatus, recentInvoices] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        billingCustomer: { select: { email: true } },
        createdAt: true,
        currency: true,
        currentPeriodEnd: true,
        discountAmountCents: true,
        id: true,
        planName: true,
        pricePerMonthCents: true,
        promoCode: true,
        server: { select: { id: true, name: true } },
        status: true,
        stripeSubscriptionId: true,
        suspendedAt: true,
      },
      take: 100,
    }),
    prisma.subscription.groupBy({
      _count: true,
      _sum: { pricePerMonthCents: true },
      by: ["status"],
    }),
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        amountDue: true,
        amountPaid: true,
        billingCustomer: { select: { email: true } },
        createdAt: true,
        currency: true,
        id: true,
        invoiceUrl: true,
        paidAt: true,
        status: true,
        subscription: {
          select: { planName: true, server: { select: { name: true } } },
        },
      },
      take: 50,
    }),
  ]);

  const activeRevenue =
    revenueByStatus.find((r) => r.status === "active")?._sum
      .pricePerMonthCents ?? 0;
  const activeCount =
    revenueByStatus.find((r) => r.status === "active")?._count ?? 0;
  const totalCount = revenueByStatus.reduce((sum, r) => sum + r._count, 0);
  const pastDueCount =
    revenueByStatus.find((r) => r.status === "past_due")?._count ?? 0;

  return (
    <>
      <PageHeader title="Subscriptions" />
      <PageBody>
        <div className="flex flex-col gap-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              title="Monthly Revenue"
              value={`£${(activeRevenue / 100).toFixed(2)}`}
              description="from active subscriptions"
              icon={<DollarSign className="size-4" />}
              accent="emerald"
            />

            <MetricCard
              title="Active Subscriptions"
              value={activeCount}
              description={`${totalCount} total`}
              icon={<TrendingUp className="size-4" />}
              accent="blue"
            />

            <MetricCard
              title="Past Due"
              value={pastDueCount}
              description="require attention"
              icon={<Receipt className="size-4" />}
              accent={pastDueCount > 0 ? "red" : "zinc"}
            />

            <div className="col-span-2 overflow-hidden rounded-xl border border-border/60 bg-card p-4 sm:col-span-1">
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Breakdown
              </p>
              <div className="flex flex-col gap-1.5">
                {revenueByStatus.map((r) => (
                  <div
                    key={r.status}
                    className="flex items-center justify-between"
                  >
                    <Badge
                      className={cn(
                        "text-xs capitalize",
                        subStatusClass(r.status)
                      )}
                      variant="outline"
                    >
                      {r.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {r._count} — £
                      {((r._sum.pricePerMonthCents ?? 0) / 100).toFixed(0)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subscriptions table */}
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/50 px-5 py-4">
              <h2 className="text-sm font-semibold">All subscriptions</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Showing most recent 100
              </p>
            </div>
            {subscriptions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No subscriptions yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {sub.server.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sub.billingCustomer.email}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "text-xs capitalize",
                          subStatusClass(sub.status)
                        )}
                        variant="outline"
                      >
                        {sub.status.replace("_", " ")}
                      </Badge>
                      {sub.suspendedAt && (
                        <Badge variant="destructive" className="text-xs">
                          Suspended
                        </Badge>
                      )}
                      {sub.promoCode && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {sub.promoCode}
                        </Badge>
                      )}
                      <span className="text-sm font-medium">
                        £{(sub.pricePerMonthCents / 100).toFixed(2)}/mo
                        {sub.discountAmountCents
                          ? ` (−£${(sub.discountAmountCents / 100).toFixed(2)})`
                          : ""}
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        {sub.planName}
                      </span>
                      <span className="hidden text-xs text-muted-foreground md:block">
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString(
                              "en-US",
                              { dateStyle: "medium" }
                            )
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent invoices */}
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/50 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent invoices</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last 50 invoices across all customers
              </p>
            </div>
            {recentInvoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No invoices recorded yet. Invoices are created automatically via
                the Stripe webhook.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentInvoices.map((inv) => {
                  const serverName = inv.subscription?.server?.name ?? "—";
                  const planName = inv.subscription?.planName ?? "—";
                  const amount =
                    inv.status === "paid" ? inv.amountPaid : inv.amountDue;
                  const amountLabel = new Intl.NumberFormat("en-GB", {
                    currency: inv.currency || "GBP",
                    style: "currency",
                  }).format(amount / 100);

                  return (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {serverName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inv.billingCustomer.email} · {planName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            "text-xs capitalize",
                            invoiceStatusClass(inv.status)
                          )}
                          variant="outline"
                        >
                          {inv.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          {amountLabel}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {new Date(inv.createdAt).toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                        </span>
                        {inv.invoiceUrl && (
                          <a
                            href={inv.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                          >
                            <ExternalLink className="size-3" />
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
};

export default AdminSubscriptionsPage;
