import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const GET = async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? "50"))
  );
  const action = searchParams.get("action") ?? undefined;
  const actorId = searchParams.get("actorId") ?? undefined;
  const targetId = searchParams.get("targetId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const where = {
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
    ...(targetId ? { targetId } : {}),
    ...(q
      ? {
          OR: [
            { actorEmail: { contains: q, mode: "insensitive" as const } },
            { action: { contains: q, mode: "insensitive" as const } },
            { targetId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        actorEmail: true,
        actorId: true,
        createdAt: true,
        id: true,
        ipAddress: true,
        metadata: true,
        targetId: true,
        targetType: true,
        userAgent: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
};
