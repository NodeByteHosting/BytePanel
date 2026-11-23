"use server";

import { revalidatePath, updateTag } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { SETTINGS_ID } from "@/lib/settings";
import { UPDATE_CHECK_TAG } from "@/lib/version";

import type { ActionResult } from "./infrastructure";

export const checkForUpdates = async (): Promise<ActionResult> => {
  await requireAdmin();
  updateTag(UPDATE_CHECK_TAG);
  return { ok: true };
};

export const setUpdateBeta = async (
  enabled: boolean
): Promise<ActionResult> => {
  await requireAdmin();
  await prisma.panelSettings.upsert({
    create: { id: SETTINGS_ID, updateBeta: enabled },
    update: { updateBeta: enabled },
    where: { id: SETTINGS_ID },
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
};
