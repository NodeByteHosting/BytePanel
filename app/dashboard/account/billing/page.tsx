import { AlertCircle, CheckCircle2, CreditCard, XCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatNodeBytePrice } from "@/lib/pricing";
import { requireUser } from "@/lib/session";

import { PageBody, PageHeader } from "../../components/page-header";
import { CustomerPortalButton } from "../components/customer-portal-button";

const statusConfig = {
  active: { color: "text-green-500", icon: CheckCircle2, label: "Active" },
  canceled: {
    color: "text-muted-foreground",
    icon: XCircle,
    label: "Canceled",
  },
  incomplete: {
    color: "text-amber-500",
    icon: AlertCircle,
    label: "Incomplete",
  },
  incomplete_expired: {
    color: "text-destructive",
    icon: XCircle,
    label: "Expired",
  },
  past_due: { color: "text-destructive", icon: AlertCircle, label: "Past due" },
  paused: {
    color: "text-muted-foreground",
    icon: AlertCircle,
    label: "Paused",
  },
  trialing: { color: "text-blue-500", icon: CheckCircle2, label: "Trial" },
  unpaid: { color: "text-destructive", icon: AlertCircle, label: "Unpaid" },
} as const;

const BillingPage = async () => {
  const user = await requireUser();

  const billingCustomer = await prisma.billingCustomer.findUnique({
    include: {
      subscriptions: {
        include: { server: { select: { game: true, id: true, name: true } } },
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

  return (
    <>
      <PageHeader title="Billing">
        <p className="text-muted-foreground text-sm">
          Manage your NodeByte subscriptions and payment details.
        </p>
      </PageHeader>
      <PageBody>
        <div className="grid gap-6">
          {/* Summary banner */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-3">
              <CreditCard className="size-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  Payment & subscriptions
                </CardTitle>
                <CardDescription>
                  {activeSubscriptions.length > 0
                    ? `${activeSubscriptions.length} active plan${activeSubscriptions.length > 1 ? "s" : ""}`
                    : "No active subscriptions"}
                </CardDescription>
              </div>
              {billingCustomer && (
                <div className="ml-auto">
                  <CustomerPortalButton
                    stripeCustomerId={billingCustomer.stripeCustomerId}
                  />
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Active subscriptions */}
          {activeSubscriptions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Active plans</h3>
              <div className="grid gap-3">
                {activeSubscriptions.map((sub) => {
                  const cfg =
                    statusConfig[sub.status as keyof typeof statusConfig] ??
                    statusConfig.incomplete;
                  const StatusIcon = cfg.icon;
                  return (
                    <Card key={sub.id}>
                      <CardContent className="flex items-center justify-between gap-4 py-4">
                        <div className="flex items-center gap-3">
                          <StatusIcon className={`size-4 ${cfg.color}`} />
                          <div>
                            <p className="font-medium text-sm">
                              {sub.server?.name ?? "Unknown server"}
                            </p>
                            <p className="text-muted-foreground text-xs capitalize">
                              {sub.planName} · {sub.server?.game ?? ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {sub.currentPeriodEnd && (
                            <p className="text-muted-foreground text-xs">
                              Renews{" "}
                              {sub.currentPeriodEnd.toLocaleDateString(
                                "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          )}
                          <Badge variant="outline" className="font-mono">
                            {formatNodeBytePrice(sub.pricePerMonthCents)}/mo
                          </Badge>
                          {sub.server && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/${sub.server.id}`}>
                                Manage
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past subscriptions */}
          {inactiveSubscriptions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-muted-foreground text-sm">
                Past subscriptions
              </h3>
              <div className="grid gap-2">
                {inactiveSubscriptions.map((sub) => {
                  const cfg =
                    statusConfig[sub.status as keyof typeof statusConfig] ??
                    statusConfig.canceled;
                  const StatusIcon = cfg.icon;
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/20 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`size-4 ${cfg.color}`} />
                        <div>
                          <p className="font-medium text-sm">
                            {sub.server?.name ?? "Unknown server"}
                          </p>
                          <p className="text-muted-foreground text-xs capitalize">
                            {sub.planName} · {cfg.label}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="font-mono text-muted-foreground"
                      >
                        {formatNodeBytePrice(sub.pricePerMonthCents)}/mo
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!billingCustomer || billingCustomer.subscriptions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
              <CreditCard className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-medium text-sm">No subscriptions yet</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Create your first game server to get started.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/dashboard/new">Deploy a server</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </PageBody>
    </>
  );
};

export default BillingPage;
