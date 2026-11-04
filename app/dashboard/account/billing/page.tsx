import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  XCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatNodeBytePrice } from "@/lib/pricing";
import { requireUser } from "@/lib/session";
import { getPanelSettings, isExternalBilling } from "@/lib/settings";
import { cn } from "@/lib/utils";

import { ExternalStoreNotice } from "../../components/external-store-notice";
import { PageBody } from "../../components/page-header";
import { CustomerPortalButton } from "../components/customer-portal-button";

const statusConfig = {
  active: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    color: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
    label: "Active",
  },
  canceled: {
    bg: "bg-zinc-500/10 border-zinc-500/30",
    color: "text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
    icon: XCircle,
    label: "Canceled",
  },
  incomplete: {
    bg: "bg-amber-500/10 border-amber-500/30",
    color: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    icon: AlertCircle,
    label: "Incomplete",
  },
  incomplete_expired: {
    bg: "bg-red-500/10 border-red-500/30",
    color: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    icon: XCircle,
    label: "Expired",
  },
  past_due: {
    bg: "bg-red-500/10 border-red-500/30",
    color: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    icon: AlertCircle,
    label: "Past due",
  },
  paused: {
    bg: "bg-zinc-500/10 border-zinc-500/30",
    color: "text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
    icon: AlertCircle,
    label: "Paused",
  },
  trialing: {
    bg: "bg-blue-500/10 border-blue-500/30",
    color: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    icon: CheckCircle2,
    label: "Trial",
  },
  unpaid: {
    bg: "bg-red-500/10 border-red-500/30",
    color: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    icon: AlertCircle,
    label: "Unpaid",
  },
} as const;

const BillingPage = async () => {
  const user = await requireUser();
  const settings = await getPanelSettings();
  if (isExternalBilling(settings.billingMode)) {
    return (
      <PageBody constrained>
        <ExternalStoreNotice
          description="Invoices, payment methods and cancellations are managed in our billing area."
          storeUrl={settings.storeUrl}
          title="Billing is managed in our store"
        />
      </PageBody>
    );
  }

  const billingCustomer = await prisma.billingCustomer.findUnique({
    include: {
      subscriptions: {
        include: {
          server: {
            select: { egg: { select: { name: true } }, id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    where: { userId: user.id },
  });

  const activeSubscriptions =
    billingCustomer?.subscriptions.filter(
      (s) => s.status === "active" || s.status === "trialing"
    ) ?? [];
  const inactiveSubscriptions =
    billingCustomer?.subscriptions.filter(
      (s) => s.status !== "active" && s.status !== "trialing"
    ) ?? [];

  const totalMonthlyCents = activeSubscriptions.reduce(
    (sum, s) => sum + s.pricePerMonthCents,
    0
  );

  return (
    <PageBody constrained>
      <div className="space-y-6">
        {/* Summary card */}
        <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2.5">
                <CreditCard className="text-primary size-5" />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">
                  {activeSubscriptions.length > 0
                    ? `${activeSubscriptions.length} active plan${activeSubscriptions.length > 1 ? "s" : ""}`
                    : "No active subscriptions"}
                </p>
                {activeSubscriptions.length > 0 && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    <span className="text-foreground font-medium">
                      {formatNodeBytePrice(totalMonthlyCents)}
                    </span>{" "}
                    / month total
                  </p>
                )}
              </div>
            </div>
            {billingCustomer && (
              <CustomerPortalButton
                stripeCustomerId={billingCustomer.stripeCustomerId}
              />
            )}
          </div>
        </div>

        {/* Active subscriptions */}
        {activeSubscriptions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-foreground text-sm font-semibold">
              Active plans
            </h2>
            <div className="grid gap-3">
              {activeSubscriptions.map((sub) => {
                const cfg =
                  statusConfig[sub.status as keyof typeof statusConfig] ??
                  statusConfig.incomplete;
                return (
                  <div
                    key={sub.id}
                    className="border-border/60 bg-card flex items-center justify-between gap-4 rounded-xl border px-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn("shrink-0 rounded-lg border p-2", cfg.bg)}
                      >
                        <TrendingUp className={cn("size-4", cfg.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {sub.server?.name ?? "Unknown server"}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                          {sub.planName}
                          {sub.server?.egg && ` · ${sub.server.egg.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <p className="font-mono text-sm font-semibold">
                          {formatNodeBytePrice(sub.pricePerMonthCents)}/mo
                        </p>
                        {sub.currentPeriodEnd && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Renews{" "}
                            {sub.currentPeriodEnd.toLocaleDateString("en-US", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 text-xs font-medium",
                          cfg.bg,
                          cfg.color
                        )}
                      >
                        <span
                          className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)}
                        />
                        {cfg.label}
                      </Badge>
                      {sub.server && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="px-2"
                        >
                          <Link href={`/dashboard/${sub.server.id}`}>
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past subscriptions */}
        {inactiveSubscriptions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-semibold">
              Past plans
            </h2>
            <div className="grid gap-2">
              {inactiveSubscriptions.map((sub) => {
                const cfg =
                  statusConfig[sub.status as keyof typeof statusConfig] ??
                  statusConfig.canceled;
                return (
                  <div
                    key={sub.id}
                    className="border-border/40 bg-muted/20 flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {sub.server?.name ?? "Unknown server"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                        {sub.planName} · {cfg.label}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 font-mono text-sm">
                      {formatNodeBytePrice(sub.pricePerMonthCents)}/mo
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!billingCustomer || billingCustomer.subscriptions.length === 0 ? (
          <div className="border-border bg-muted/20 flex flex-col items-center gap-4 rounded-xl border border-dashed py-14 text-center">
            <div className="bg-muted rounded-xl p-4">
              <CreditCard className="text-muted-foreground size-8" />
            </div>
            <div>
              <p className="text-sm font-semibold">No subscriptions yet</p>
              <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                Create your first game server to get started.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/new">Deploy a server</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </PageBody>
  );
};

export default BillingPage;
