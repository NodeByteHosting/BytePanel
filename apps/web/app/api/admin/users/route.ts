import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const GET = async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const q = searchParams.get("q")?.trim() ?? "";
  const pageSize = 25;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        _count: { select: { servers: true } },
        banExpires: true,
        banReason: true,
        banned: true,
        createdAt: true,
        email: true,
        id: true,
        image: true,
        name: true,
        role: true,
        superAdmin: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    users,
  });
};
