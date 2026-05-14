import { DollarSign, Receipt, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";

const statusVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "active") {
    return "default";
  }
  if (status === "past_due" || status === "unpaid") {
    return "destructive";
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return "secondary";
  }
  return "outline";
};

const invoiceStatusVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "paid") {
    return "default";
  }
  if (status === "open") {
    return "outline";
  }
  if (status === "void" || status === "uncollectible") {
    return "secondary";
  }
  return "destructive";
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
            <div className="rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Monthly revenue
                </p>
                <div className="rounded-lg border border-border/50 bg-card/50 p-1.5">
                  <DollarSign className="size-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">
                £{(activeRevenue / 100).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                from active subscriptions
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Active subs
                </p>
                <div className="rounded-lg border border-border/50 bg-card/50 p-1.5">
                  <TrendingUp className="size-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{activeCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {totalCount} total
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Past due
                </p>
                <div className="rounded-lg border border-border/50 bg-card/50 p-1.5">
                  <Receipt className="size-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight text-destructive">
                {pastDueCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                require attention
              </p>
            </div>

            <div className="col-span-2 rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm sm:col-span-1 md:p-5">
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
                      variant={statusVariant(r.status)}
                      className="text-xs capitalize"
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
          <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
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
                        variant={statusVariant(sub.status)}
                        className="text-xs capitalize"
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
          <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
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
                          variant={invoiceStatusVariant(inv.status)}
                          className="text-xs capitalize"
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
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
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
