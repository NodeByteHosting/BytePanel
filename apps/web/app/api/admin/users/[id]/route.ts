import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp, logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSuperAdmin } from "@/lib/session";

const patchSchema = z.union([
  z.object({
    action: z.literal("set-role"),
    role: z.enum(["user", "admin"]),
  }),
  z.object({
    action: z.literal("set-super-admin"),
    superAdmin: z.boolean(),
  }),
  z.object({
    action: z.literal("ban"),
    banExpiresAt: z.string().datetime().optional(),
    banReason: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("unban"),
  }),
]);

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data } = parsed;

  const actor = await (data.action === "set-super-admin"
    ? requireSuperAdmin()
    : requireAdmin());
  const actorId = (actor as { id?: string }).id ?? null;
  const actorEmail = (actor as { email?: string }).email ?? null;
  const ip = getRequestIp(req);
  const ua = req.headers.get("user-agent");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let updated;

  switch (data.action) {
    case "set-role": {
      updated = await prisma.user.update({
        data: { role: data.role },
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
          superAdmin: true,
        },
        where: { id },
      });
      await logEvent({
        action: "admin.user.set_role",
        actorEmail,
        actorId,
        ipAddress: ip,
        metadata: { from: target.role, to: data.role },
        targetId: id,
        targetType: "user",
        userAgent: ua,
      });
      break;
    }

    case "set-super-admin": {
      updated = await prisma.user.update({
        data: { superAdmin: data.superAdmin },
        select: {
          email: true,
          id: true,
          name: true,
          role: true,
          superAdmin: true,
        },
        where: { id },
      });
      await logEvent({
        action: "admin.user.set_super_admin",
        actorEmail,
        actorId,
        ipAddress: ip,
        metadata: { superAdmin: data.superAdmin },
        targetId: id,
        targetType: "user",
        userAgent: ua,
      });
      break;
    }

    case "ban": {
      updated = await prisma.user.update({
        data: {
          banExpires: data.banExpiresAt ? new Date(data.banExpiresAt) : null,
          banReason: data.banReason ?? null,
          banned: true,
        },
        select: {
          banExpires: true,
          banReason: true,
          banned: true,
          email: true,
          id: true,
          name: true,
        },
        where: { id },
      });
      await logEvent({
        action: "admin.user.ban",
        actorEmail,
        actorId,
        ipAddress: ip,
        metadata: {
          banExpires: data.banExpiresAt ?? null,
          banReason: data.banReason ?? null,
        },
        targetId: id,
        targetType: "user",
        userAgent: ua,
      });
      break;
    }

    case "unban": {
      updated = await prisma.user.update({
        data: { banExpires: null, banReason: null, banned: false },
        select: { banned: true, email: true, id: true, name: true },
        where: { id },
      });
      await logEvent({
        action: "admin.user.unban",
        actorEmail,
        actorId,
        ipAddress: ip,
        targetId: id,
        targetType: "user",
        userAgent: ua,
      });
      break;
    }

    default: {
      break;
    }
  }

  return NextResponse.json({ user: updated });
};
