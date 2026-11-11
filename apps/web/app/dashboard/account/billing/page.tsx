import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/billing/money";
import { prisma } from "@/lib/db";
import { stripeEnabled } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { BillingNotice } from "../../components/billing-notice";
import { ExternalStoreNotice } from "../../components/external-store-notice";
import { PageBody } from "../../components/page-header";
import { openCardPortal } from "./actions";
import { SubscriptionActions } from "./subscription-actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

const STATUS: Record<
  string,
  { label: string; variant: "default" | "destructive" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  canceled: { label: "Cancelled", variant: "outline" },
  past_due: { label: "Payment due", variant: "destructive" },
};

const BuiltinBilling = async ({ userId }: { userId: string }) => {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 24 },
      plan: { select: { name: true } },
      server: { select: { deletedAt: true, id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { status: { not: "pending" }, userId },
  });
  if (!subscriptions.length) {
    return (
      <BillingNotice
        action={
          <Button asChild size="lg">
            <Link href="/dashboard/new">Order a server</Link>
          </Button>
        }
        description="When you order a server, its subscription and receipts appear here."
        title="No subscriptions yet"
      />
    );
  }
  const payments = subscriptions
    .flatMap((subscription) =>
      subscription.payments.map((payment) => ({
        ...payment,
        server:
          subscription.server?.name ?? subscription.plan?.name ?? "Server",
      }))
    )
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const hasCards = subscriptions.some(
    (subscription) =>
      subscription.provider === "stripe" && subscription.providerCustomerId
  );

  return (
    <div className="flex flex-col gap-6">
      <Panel
        action={
          stripeEnabled && hasCards ? (
            <form action={openCardPortal}>
              <Button size="sm" type="submit" variant="outline">
                Payment methods
                <ExternalLinkIcon />
              </Button>
            </form>
          ) : undefined
        }
        title="Subscriptions"
      >
        <PanelCard className="flex flex-col gap-1">
          {subscriptions.map((subscription) => {
            const status = STATUS[subscription.status] ?? STATUS.canceled;
            const endsOn = subscription.currentPeriodEnd
              ? dateFormat.format(subscription.currentPeriodEnd)
              : null;
            const ending =
              subscription.cancelAtPeriodEnd ||
              subscription.status === "canceled";
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2"
                key={subscription.id}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {subscription.server && !subscription.server.deletedAt ? (
                      <Link
                        className="hover:underline"
                        href={`/dashboard/${subscription.server.id}`}
                      >
                        {subscription.server.name}
                      </Link>
                    ) : (
                      (subscription.plan?.name ?? "Server")
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {subscription.suspendedAt && (
                      <Badge variant="destructive">Suspended</Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatMoney(
                      subscription.priceMonthCents,
                      subscription.currency
                    )}
                    /mo ·{" "}
                    {subscription.provider === "stripe" ? "Card" : "PayPal"}
                    {endsOn &&
                      (ending ? ` · Ends ${endsOn}` : ` · Renews ${endsOn}`)}
                  </span>
                </div>
                <SubscriptionActions
                  canResume={
                    subscription.provider === "stripe" &&
                    subscription.cancelAtPeriodEnd &&
                    subscription.status !== "canceled"
                  }
                  endsOn={endsOn}
                  id={subscription.id}
                  showCancel={!ending}
                />
              </div>
            );
          })}
        </PanelCard>
      </Panel>

      {payments.length > 0 && (
        <Panel title="Payments">
          <PanelCard className="flex flex-col gap-1">
            {payments.map((payment) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                key={payment.id}
              >
                <div className="flex min-w-0 flex-col">
                  <span>{payment.server}</span>
                  <span className="text-muted-foreground text-xs">
                    {dateFormat.format(payment.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {payment.status !== "paid" && (
                    <Badge variant="destructive">{payment.status}</Badge>
                  )}
                  <span className="font-medium">
                    {formatMoney(payment.amountCents, payment.currency)}
                  </span>
                  {payment.receiptUrl && (
                    <a
                      className="text-link text-xs hover:underline"
                      href={payment.receiptUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              </div>
            ))}
          </PanelCard>
        </Panel>
      )}
    </div>
  );
};

const BillingPage = async () => {
  const user = await requireUser();
  const settings = await getPanelSettings();
  if (settings.billingProvider === "builtin") {
    return (
      <PageBody constrained>
        <BuiltinBilling userId={user.id} />
      </PageBody>
    );
  }
  return (
    <PageBody constrained>
      <ExternalStoreNotice
        description="Invoices, payment methods and cancellations are managed in our store."
        storeUrl={settings.storeUrl}
        title="Billing is managed in our store"
      />
    </PageBody>
  );
};

export default BillingPage;
