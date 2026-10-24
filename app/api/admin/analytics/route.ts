import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    // Verify admin access
    await requireAdmin();

    const { searchParams } = request.nextUrl;
    const range = Number.parseInt(searchParams.get("range") || "30", 10);

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);
    startDate.setHours(0, 0, 0, 0);

    // 1. Monthly Recurring Revenue (MRR) in GBP
    const mrrResult = await prisma.subscription.aggregate({
      _sum: { pricePerMonthCents: true },
      where: { status: "active" },
    });
    const mrr = (mrrResult._sum.pricePerMonthCents ?? 0) / 100;

    // 2. Active Servers (installed on a node and not suspended/failed)
    const activeServersCount = await prisma.server.count({
      where: {
        deletedAt: null,
        nodeId: { not: null },
        status: null,
      },
    });

    // 3. Total Servers (not deleted)
    const totalServersCount = await prisma.server.count({
      where: { deletedAt: null },
    });

    // 4. Server Uptime %
    const serverUptime =
      totalServersCount > 0
        ? (activeServersCount / totalServersCount) * 100
        : 0;

    // 5. New Users This Month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const firstDayNextMonth = new Date(firstDayOfMonth);
    firstDayNextMonth.setMonth(firstDayNextMonth.getMonth() + 1);

    const newUsersThisMonth = await prisma.user.count({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
          lt: firstDayNextMonth,
        },
      },
    });

    // 6. Revenue Trend - daily breakdown
    const revenueTrendRaw = await prisma.subscription.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        pricePerMonthCents: true,
      },
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: "active",
      },
    });

    // Group by date and sum revenues
    const revenueTrendMap = new Map<string, number>();

    // Initialize all dates in range with 0
    for (let i = 0; i <= range; i += 1) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const [dateKey = ""] = d.toISOString().split("T");
      if (!revenueTrendMap.has(dateKey)) {
        revenueTrendMap.set(dateKey, 0);
      }
    }

    // Add actual revenues
    for (const { createdAt, pricePerMonthCents } of revenueTrendRaw) {
      const [dateKey = ""] = createdAt.toISOString().split("T");
      revenueTrendMap.set(
        dateKey,
        (revenueTrendMap.get(dateKey) ?? 0) + (pricePerMonthCents ?? 0) / 100
      );
    }

    const revenueTrend = [...revenueTrendMap]
      .toSorted((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({
        date,
        revenue: Number.parseFloat(revenue.toFixed(2)),
      }));

    // 7. Server Count by Game
    // Top 10 games
    const [serversByGameRaw, eggList] = await Promise.all([
      prisma.server.groupBy({
        _count: true,
        by: ["eggId"],
        orderBy: { _count: { id: "desc" } },
        take: 10,
        where: { deletedAt: null, eggId: { not: null } },
      }),
      prisma.egg.findMany({ select: { id: true, name: true } }),
    ]);
    const eggNames = new Map(eggList.map((e) => [e.id, e.name]));

    const serversByGame = serversByGameRaw.map((item) => ({
      count: item._count,
      game: eggNames.get(item.eggId ?? "") ?? "Unknown",
    }));

    // 8. Server Status Breakdown
    const [serverStatusRaw, undeployed] = await Promise.all([
      prisma.server.groupBy({
        _count: true,
        by: ["status"],
        where: { deletedAt: null, nodeId: { not: null } },
      }),
      prisma.server.count({ where: { deletedAt: null, nodeId: null } }),
    ]);

    const serverStatus = [
      ...serverStatusRaw.map((item) => ({
        count: item._count,
        status: item.status
          ? item.status.charAt(0).toUpperCase() +
            item.status.slice(1).replaceAll("_", " ")
          : "Installed",
      })),
      ...(undeployed > 0
        ? [{ count: undeployed, status: "Not deployed" }]
        : []),
    ];

    // 9. New Signups Trend
    const signupsTrendRaw = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const signupsTrendMap = new Map<string, number>();

    // Initialize all dates in range with 0
    for (let i = 0; i <= range; i += 1) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const [dateKey = ""] = d.toISOString().split("T");
      if (!signupsTrendMap.has(dateKey)) {
        signupsTrendMap.set(dateKey, 0);
      }
    }

    // Add actual signups
    for (const { createdAt } of signupsTrendRaw) {
      const [dateKey = ""] = createdAt.toISOString().split("T");
      signupsTrendMap.set(dateKey, (signupsTrendMap.get(dateKey) ?? 0) + 1);
    }

    const signupsTrend = [...signupsTrendMap]
      .toSorted((a, b) => a[0].localeCompare(b[0]))
      .map(([date, signups]) => ({
        date,
        signups,
      }));

    // 10. Subscription Status Distribution
    const subscriptionStatusRaw = await prisma.subscription.groupBy({
      _count: true,
      by: ["status"],
      orderBy: { _count: { id: "desc" } },
    });

    const subscriptionStatus = subscriptionStatusRaw.map((item) => ({
      count: item._count,
      status:
        item.status.charAt(0).toUpperCase() +
        item.status.slice(1).replaceAll("_", " ").toLowerCase(),
    }));

    return NextResponse.json({
      activeServers: activeServersCount,
      mrr,
      newUsersThisMonth,
      revenueTrend,
      serverStatus,
      serverUptime,
      serversByGame,
      signupsTrend,
      subscriptionStatus,
      totalServers: totalServersCount,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
};
