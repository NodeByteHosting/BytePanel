import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// GET /api/admin/servers?page=1&q=search&status=running&game=minecraft
export const GET = async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status") ?? "";
  const game = searchParams.get("game") ?? "";
  const pageSize = 25;

  const where: Prisma.ServerWhereInput = {
    deletedAt: null,
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (status) {
    where.observedState = status as never;
  }
  if (game) {
    where.game = game;
  }

  const [servers, total] = await Promise.all([
    prisma.server.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        desiredState: true,
        game: true,
        id: true,
        ipv4: true,
        location: true,
        name: true,
        observedState: true,
        serverType: true,
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
