import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const STATUS_FILTERS: Record<string, Prisma.ServerWhereInput> = {
  install_failed: { status: { in: ["install_failed", "reinstall_failed"] } },
  installed: { nodeId: { not: null }, status: null },
  installing: { status: "installing" },
  suspended: { status: "suspended" },
  undeployed: { nodeId: null },
};

export const GET = async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status") ?? "";
  const nodeId = searchParams.get("node") ?? "";
  const pageSize = 25;

  const where: Prisma.ServerWhereInput = {
    deletedAt: null,
    ...STATUS_FILTERS[status],
    ...(nodeId ? { nodeId } : {}),
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { uuid: { startsWith: q } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [servers, total] = await Promise.all([
    prisma.server.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        allocation: { select: { ip: true, ipAlias: true, port: true } },
        createdAt: true,
        egg: { select: { image: true, name: true } },
        id: true,
        name: true,
        node: { select: { name: true } },
        nodeId: true,
        status: true,
        user: { select: { email: true, id: true, name: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
    }),
    prisma.server.count({ where }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    servers,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
};
