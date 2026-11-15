"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parsePtdlEgg } from "@/lib/eggs/ptdl";
import { saveImportedEgg, syncBuiltinEggs } from "@/lib/eggs/sync";
import { requireAdmin } from "@/lib/session";

import type { ActionResult } from "./infrastructure";

const fail = (error: string) => ({ error, ok: false }) as const;

const audit = (
  user: { id: string; email: string },
  action: AuditAction,
  targetId: string,
  metadata?: Record<string, unknown>
) =>
  logEvent({
    action,
    actorEmail: user.email,
    actorId: user.id,
    metadata,
    targetId,
    targetType: "egg",
  });

export const syncBuiltins = async (): Promise<
  ActionResult<{ synced: number }>
> => {
  const user = await requireAdmin();
  const result = await syncBuiltinEggs();
  await audit(user, "admin.egg.sync", "builtin", result);
  revalidatePath("/admin/nests");
  return { data: result, ok: true };
};

const nestSchema = z.object({
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(100),
});

export const createNest = async (
  input: z.infer<typeof nestSchema>
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = nestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Name is required");
  }
  if (await prisma.nest.findUnique({ where: { name: parsed.data.name } })) {
    return fail("A nest with that name already exists");
  }
  const id = ulid();
  await prisma.nest.create({
    data: {
      description: parsed.data.description || null,
      id,
      name: parsed.data.name,
    },
  });
  await audit(user, "admin.nest.create", id, parsed.data);
  revalidatePath("/admin/nests");
  return { ok: true };
};

export const deleteNest = async (id: string): Promise<ActionResult> => {
  const user = await requireAdmin();
  if (await prisma.egg.count({ where: { nestId: id } })) {
    return fail("Delete this nest's eggs first");
  }
  await prisma.nest.delete({ where: { id } });
  await audit(user, "admin.nest.delete", id);
  revalidatePath("/admin/nests");
  return { ok: true };
};

export const importEgg = async (input: {
  nestId: string;
  json: string;
  eggId?: string;
}): Promise<ActionResult<{ id: string; warnings: string[] }>> => {
  const user = await requireAdmin();
  let parsed;
  try {
    parsed = parsePtdlEgg(JSON.parse(input.json));
  } catch (error) {
    return fail(
      error instanceof SyntaxError
        ? "That isn't valid JSON"
        : `Not a valid Pterodactyl egg: ${(error as Error).message.slice(0, 300)}`
    );
  }
  if (!(await prisma.nest.findUnique({ where: { id: input.nestId } }))) {
    return fail("Unknown nest");
  }
  const id = await saveImportedEgg(parsed, input.nestId, input.eggId);
  await audit(user, "admin.egg.import", id, {
    name: parsed.name,
    warnings: parsed.warnings,
  });
  revalidatePath("/admin/nests");
  return { data: { id, warnings: parsed.warnings }, ok: true };
};

const eggSchema = z.object({
  configStop: z.string().trim().min(1),
  containerPorts: z.array(z.number().int().min(0).max(65_535)).max(10),
  containerUser: z.enum(["daemon", "image"]),
  description: z.string().max(2000).nullable(),
  dockerImages: z
    .record(z.string().min(1), z.string().min(1))
    .refine((v) => Object.keys(v).length > 0, {
      message: "At least one docker image is required",
    }),
  done: z.array(z.string()),
  enabled: z.boolean(),
  image: z.string().max(500).nullable(),
  invocationMode: z.enum(["env", "args", "shell"]),
  minDisk: z.number().int().min(0),
  minMemory: z.number().int().min(0),
  mountPath: z.string().startsWith("/"),
  name: z.string().trim().min(1).max(100),
  scriptContainer: z.string().min(1),
  scriptEntry: z.string().min(1),
  scriptInstall: z.string(),
  startup: z.string(),
  volumeOwner: z
    .string()
    .regex(/^\d+:\d+$/u)
    .nullable(),
});

export type EggInput = z.infer<typeof eggSchema>;

export const updateEgg = async (
  id: string,
  input: EggInput
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = eggSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { done, ...rest } = parsed.data;
  await prisma.egg.update({
    data: { ...rest, configStartupDone: done as Prisma.InputJsonValue },
    where: { id },
  });
  await audit(user, "admin.egg.update", id);
  revalidatePath(`/admin/eggs/${id}`);
  return { ok: true };
};

const variableSchema = z.object({
  defaultValue: z.string().max(1000),
  description: z.string().max(1000),
  envVariable: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u, "Use letters, numbers and underscores"),
  name: z.string().trim().min(1).max(100),
  rules: z.string().min(1).max(500),
  userEditable: z.boolean(),
  userViewable: z.boolean(),
});

export type EggVariableInput = z.infer<typeof variableSchema>;

export const saveEggVariables = async (
  eggId: string,
  variables: EggVariableInput[]
): Promise<ActionResult> => {
  const user = await requireAdmin();
  const parsed = z.array(variableSchema).safeParse(variables);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid variable");
  }
  const envs = parsed.data.map((v) => v.envVariable);
  if (new Set(envs).size !== envs.length) {
    return fail("Environment variable names must be unique");
  }
  await prisma.$transaction(async (tx) => {
    await tx.eggVariable.deleteMany({
      where: { eggId, envVariable: { notIn: envs } },
    });
    for (const [index, v] of parsed.data.entries()) {
      // oxlint-disable-next-line no-await-in-loop
      await tx.eggVariable.upsert({
        create: { eggId, id: ulid(), sort: index, ...v },
        update: { sort: index, ...v },
        where: { eggId_envVariable: { eggId, envVariable: v.envVariable } },
      });
    }
  });
  await audit(user, "admin.egg.update", eggId, { variables: envs });
  revalidatePath(`/admin/eggs/${eggId}`);
  return { ok: true };
};

export const deleteEgg = async (id: string): Promise<ActionResult> => {
  const user = await requireAdmin();
  if (await prisma.server.count({ where: { eggId: id } })) {
    return fail("Servers still use this egg");
  }
  await prisma.egg.delete({ where: { id } });
  await audit(user, "admin.egg.delete", id);
  revalidatePath("/admin/nests");
  return { ok: true };
};
