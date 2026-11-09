import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";

// GET /api/admin/sessions?page=1
export const GET = async (req: Request) => {
  await requireSuperAdmin();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = 50;

  const now = new Date();

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        ipAddress: true,
        token: true,
        updatedAt: true,
        user: { select: { email: true, name: true } },
        userAgent: true,
        userId: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where: { expiresAt: { gt: now } },
    }),
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
  ]);

  // Never expose session tokens to the client
  return NextResponse.json({
    page,
    pageSize,
    sessions: sessions.map(({ token: _t, ...s }) => s),
    total,
    totalPages: Math.ceil(total / pageSize),
  });
};
