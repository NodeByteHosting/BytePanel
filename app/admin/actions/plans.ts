"use server";

import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import type { ActionResult } from "./infrastructure";

const planSchema = z.object({
  active: z.boolean(),
  allocationLimit: z.coerce.number().int().min(1).max(20),
  backupLimit: z.coerce.number().int().min(0).max(100),
  cpu: z.coerce.number().int().min(0),
  currency: z.string().length(3).default("GBP"),
  description: z.string().trim().max(500).optional(),
  disk: z.coerce.number().int().min(256),
  io: z.coerce.number().int().min(10).max(1000).default(500),
  locationId: z.string().nullable(),
  memory: z.coerce.number().int().min(128),
  name: z.string().trim().min(1).max(60),
  priceMonthCents: z.coerce.number().int().min(0),
  sort: z.coerce.number().int().default(0),
  swap: z.coerce.number().int().min(-1).default(0),
});

export type PlanInput = z.input<typeof planSchema>;

export const savePlan = async (
  input: PlanInput,
  id?: string
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      ok: false,
    };
  }
  const data = { ...parsed.data, description: parsed.data.description || null };
  const clash = await prisma.plan.findUnique({ where: { name: data.name } });
  if (clash && clash.id !== id) {
    return { error: "A plan with that name already exists", ok: false };
  }
  const planId = id ?? ulid();
  await (id
    ? prisma.plan.update({ data, where: { id } })
    : prisma.plan.create({ data: { ...data, id: planId } }));
  await logEvent({
    action: id ? "admin.plan.update" : "admin.plan.create",
    actorEmail: user.email,
    actorId: user.id,
    metadata: data,
    targetId: planId,
    targetType: "plan",
  });
  revalidatePath("/admin/plans");
  return { ok: true };
};

export const deletePlan = async (id: string): Promise<ActionResult> => {
  const user = await requireAdmin();
  if (await prisma.server.count({ where: { deletedAt: null, planId: id } })) {
    return {
      error: "Servers are on this plan. Deactivate it instead.",
      ok: false,
    };
  }
  await prisma.plan.delete({ where: { id } });
  await logEvent({
    action: "admin.plan.delete",
    actorEmail: user.email,
    actorId: user.id,
    targetId: id,
    targetType: "plan",
  });
  revalidatePath("/admin/plans");
  return { ok: true };
};
