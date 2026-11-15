import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    await requireAdmin();

    const { searchParams } = request.nextUrl;
    const range = Math.trunc(Number(searchParams.get("range") || "30"));

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);
    startDate.setHours(0, 0, 0, 0);

    const activeServersCount = await prisma.server.count({
      where: {
        deletedAt: null,
        nodeId: { not: null },
        status: null,
      },
    });

    const totalServersCount = await prisma.server.count({
      where: { deletedAt: null },
    });

    const serverUptime =
      totalServersCount > 0
        ? (activeServersCount / totalServersCount) * 100
        : 0;

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

    const signupsTrendRaw = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const signupsTrendMap = new Map<string, number>();

    for (let i = 0; i <= range; i += 1) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const [dateKey = ""] = d.toISOString().split("T");
      if (!signupsTrendMap.has(dateKey)) {
        signupsTrendMap.set(dateKey, 0);
      }
    }

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

    return NextResponse.json({
      activeServers: activeServersCount,
      newUsersThisMonth,
      serverStatus,
      serverUptime,
      serversByGame,
      signupsTrend,
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
