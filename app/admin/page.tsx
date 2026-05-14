import { DollarSign, Server, TrendingUp, Users } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../dashboard/components/page-header";

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) => (
  <div className="rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm md:p-5">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="rounded-lg border border-border/50 bg-card/50 p-1.5">
        <Icon className="size-4 text-muted-foreground" />
      </div>
    </div>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
    {description && (
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    )}
  </div>
);

const AdminOverviewPage = async () => {
  await requireAdmin();

  const [
    totalUsers,
    totalServers,
    activeServers,
    activeSubscriptions,
    monthlyRevenueCents,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.server.count({ where: { deletedAt: null } }),
    prisma.server.count({
      where: { deletedAt: null, observedState: "running" },
    }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.aggregate({
      _sum: { pricePerMonthCents: true },
      where: { status: "active" },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        email: true,
        id: true,
        name: true,
        role: true,
      },
      take: 10,
    }),
  ]);

  const revenue = (
    (monthlyRevenueCents._sum.pricePerMonthCents ?? 0) / 100
  ).toFixed(2);

  return (
    <>
      <PageHeader title="Overview" />
      <PageBody>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              title="Total users"
              value={totalUsers.toLocaleString()}
              icon={Users}
            />
            <StatCard
              title="Active servers"
              value={`${activeServers} / ${totalServers}`}
              icon={Server}
              description="running / total"
            />
            <StatCard
              title="Active subscriptions"
              value={activeSubscriptions.toLocaleString()}
              icon={TrendingUp}
            />
            <StatCard
              title="Monthly revenue"
              value={`$${revenue}`}
              icon={DollarSign}
              description="from active subscriptions"
            />
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
            <div className="border-b border-border/50 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent signups</h2>
            </div>
            <div className="divide-y divide-border/50">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {u.name ?? u.email}
                    </span>
                    {u.name && (
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs capitalize text-muted-foreground">
                      {u.role}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {u.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
};

export default AdminOverviewPage;
