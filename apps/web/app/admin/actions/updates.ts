"use server";

import { updateTag } from "next/cache";

import { requireAdmin } from "@/lib/session";
import { UPDATE_CHECK_TAG } from "@/lib/version";

import type { ActionResult } from "./infrastructure";

export const checkForUpdates = async (): Promise<ActionResult> => {
  await requireAdmin();
  updateTag(UPDATE_CHECK_TAG);
  return { ok: true };
};
