import { ServerIcon, UsersIcon, ZapIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

import { PageBody, PageHeader } from "../dashboard/components/page-header";
import { SimpleBarChart } from "./components/charts";
import { MetricsGrid } from "./components/metric-card";

const getHealthClass = (pct: number) => {
  if (pct >= 80) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (pct >= 50) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-red-600 dark:text-red-400";
};

const monthBounds = () => {
  const now = new Date();
  return {
    lastMonthStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    thisMonthStart: new Date(new Date(now).setDate(1)),
  };
};

const AdminOverviewPage = async () => {
  await requireAdmin();
  const { lastMonthStart, thisMonthStart } = monthBounds();

  const [
    totalUsers,
    newUsersThisMonth,
    newUsersLastMonth,
    totalServers,
    activeServers,
    failedServers,
    recentUsers,
    recentServers,
    serversByGame,
    eggList,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        createdAt: {
          gte: thisMonthStart,
        },
      },
    }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lt: thisMonthStart,
        },
      },
    }),
    prisma.server.count({ where: { deletedAt: null } }),
    prisma.server.count({
      where: { deletedAt: null, nodeId: { not: null }, status: null },
    }),
    prisma.server.count({
      where: {
        deletedAt: null,
        status: { in: ["install_failed", "reinstall_failed", "suspended"] },
      },
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
      take: 5,
    }),
    prisma.server.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        egg: { select: { image: true, name: true } },
        id: true,
        name: true,
        nodeId: true,
        status: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        userId: true,
      },
      take: 5,
    }),
    prisma.server.groupBy({
      _count: true,
      by: ["eggId"],
      orderBy: { _count: { eggId: "desc" } },
      where: { deletedAt: null, eggId: { not: null } },
    }),
    prisma.egg.findMany({ select: { id: true, name: true } }),
  ]);

  const userChange =
    newUsersLastMonth > 0
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
      : 0;

  const stoppedServers = totalServers - activeServers - failedServers;
  const healthPct =
    totalServers > 0 ? Math.round((activeServers / totalServers) * 100) : 0;

  const eggNames = new Map(eggList.map((e) => [e.id, e.name]));
  const gameData = serversByGame.slice(0, 6).map((g) => ({
    label: eggNames.get(g.eggId ?? "") ?? "Unknown",
    value: g._count,
  }));

  const SERVER_STATE_CONFIG: Record<
    string,
    { dot: string; text: string; label: string }
  > = {
    failed: {
      dot: "bg-red-500",
      label: "Failed",
      text: "text-red-600 dark:text-red-400",
    },
    installed: {
      dot: "bg-emerald-500",
      label: "Installed",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    installing: {
      dot: "bg-amber-500",
      label: "Installing",
      text: "text-amber-600 dark:text-amber-400",
    },
    not_deployed: {
      dot: "bg-zinc-400",
      label: "Not deployed",
      text: "text-zinc-500 dark:text-zinc-400",
    },
  };

  return (
    <>
      <PageHeader title="Overview" />
      <PageBody>
        <div className="flex flex-col gap-8">
          <MetricsGrid
            columns={4}
            metrics={[
              {
                accent: "blue",
                change:
                  newUsersLastMonth > 0
                    ? {
                        isPositive: userChange >= 0,
                        period: "vs last month",
                        value: Math.round(Math.abs(userChange)),
                      }
                    : undefined,
                description: `${newUsersThisMonth} joined this month`,
                icon: <UsersIcon className="size-4" />,
                title: "Total users",
                value: totalUsers.toLocaleString(),
              },
              {
                accent: "emerald",
                description: `${totalServers} total · ${failedServers} failed`,
                icon: <ZapIcon className="size-4" />,
                title: "Active servers",
                value: activeServers,
              },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border-border/60 bg-card flex flex-col gap-4 rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Platform health</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Server state breakdown
                  </p>
                </div>
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    getHealthClass(healthPct)
                  )}
                >
                  {healthPct}%
                </span>
              </div>

              {totalServers > 0 && (
                <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{
                      width: `${(activeServers / totalServers) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{
                      width: `${(failedServers / totalServers) * 100}%`,
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    dot: "bg-emerald-500",
                    label: "Running",
                    text: "text-emerald-600 dark:text-emerald-400",
                    value: activeServers,
                  },
                  {
                    dot: "bg-zinc-400",
                    label: "Stopped",
                    text: "text-zinc-500",
                    value: stoppedServers,
                  },
                  {
                    dot: "bg-amber-500",
                    label: "Failed",
                    text: "text-amber-600 dark:text-amber-400",
                    value: failedServers,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="border-border/40 bg-background/50 flex flex-col gap-1 rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={cn("size-2 rounded-full", s.dot)} />
                      <span className="text-muted-foreground text-xs">
                        {s.label}
                      </span>
                    </div>
                    <span
                      className={cn("text-xl font-bold tabular-nums", s.text)}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href="/admin/servers">View all servers</Link>
                </Button>
              </div>
            </div>

            {gameData.length > 0 && (
              <SimpleBarChart
                title="Servers by game"
                description="Active server distribution"
                data={gameData}
                height={160}
              />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
              <div className="border-border/50 flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold">Recent signups</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Latest user registrations
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/admin/users">View all</Link>
                </Button>
              </div>
              {recentUsers.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  No recent signups
                </p>
              ) : (
                <div className="divide-border/50 divide-y">
                  {recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <Avatar className="size-8 shrink-0 rounded-lg">
                        <AvatarFallback className="rounded-lg text-xs font-medium">
                          {(user.name ?? user.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {user.name ?? user.email}
                        </p>
                        {user.name && (
                          <p className="text-muted-foreground truncate text-xs">
                            {user.email}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {user.role !== "user" && (
                          <Badge
                            className="text-xs capitalize"
                            variant="outline"
                          >
                            {user.role}
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
              <div className="border-border/50 flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold">Recent servers</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Latest server creations
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/admin/servers">View all</Link>
                </Button>
              </div>
              {recentServers.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  No recent servers
                </p>
              ) : (
                <div className="divide-border/50 divide-y">
                  {recentServers.map((server) => {
                    const game = server.egg;
                    let stateKey = "not_deployed";
                    if (server.status === null && server.nodeId) {
                      stateKey = "installed";
                    } else if (server.status === "installing") {
                      stateKey = "installing";
                    } else if (server.status) {
                      stateKey = "failed";
                    }
                    const stateConf =
                      SERVER_STATE_CONFIG[stateKey] ??
                      SERVER_STATE_CONFIG.not_deployed;
                    return (
                      <div
                        key={server.id}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        {game?.image ? (
                          <Image
                            src={game.image}
                            alt={game.name}
                            width={32}
                            height={32}
                            className="size-8 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="border-border/50 bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg border">
                            <ServerIcon className="text-muted-foreground size-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {server.name}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {server.user?.name ?? server.user?.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <div
                            className={cn(
                              "size-1.5 rounded-full",
                              stateConf.dot
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              stateConf.text
                            )}
                          >
                            {stateConf.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
};

export default AdminOverviewPage;
