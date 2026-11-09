"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { generateBillingApiKey, SETTINGS_ID } from "@/lib/settings";

import type { ActionResult } from "./infrastructure";

const LOGO_ROUTE = "/api/branding/logo";
const MAX_LOGO_BYTES = 512 * 1024;
const LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const fail = (error: string) => ({ error, ok: false }) as const;

const audit = (
  user: { id: string; email: string },
  action: AuditAction,
  metadata?: Record<string, unknown>
) =>
  logEvent({
    action,
    actorEmail: user.email,
    actorId: user.id,
    metadata,
    targetId: SETTINGS_ID,
    targetType: "settings",
  });

// Branding shows on every page (root layout), so refresh everything.
const refresh = () => revalidatePath("/", "layout");

const upsert = (
  data: Parameters<typeof prisma.panelSettings.create>[0]["data"]
) =>
  prisma.panelSettings.upsert({
    create: { ...data, id: SETTINGS_ID },
    update: data,
    where: { id: SETTINGS_ID },
  });

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .pipe(z.url({ protocol: /^https?$/u }).nullable());

// ─── Branding ────────────────────────────────────────────────────────────────

const brandingSchema = z.object({
  landingPage: z.boolean(),
  // An external image URL, or the uploaded logo's route (kept as-is).
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .pipe(
      z
        .union([
          z.url({ protocol: /^https?$/u }),
          z.string().startsWith(`${LOGO_ROUTE}?`),
        ])
        .nullable()
    ),
  panelName: z.string().trim().min(1, "Panel name is required").max(40),
  supportUrl: optionalUrl,
  websiteUrl: optionalUrl,
});

export type BrandingInput = z.input<typeof brandingSchema>;

export const saveBranding = async (
  input: BrandingInput
): Promise<ActionResult> => {
  const user = await requireSuperAdmin();
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { data } = parsed;
  // Switching to an external URL drops the stored upload.
  const dropUpload = !data.logoUrl?.startsWith(LOGO_ROUTE);
  await upsert({
    ...data,
    ...(dropUpload && { logoImage: null, logoMime: null }),
  });
  await audit(user, "admin.settings.branding_changed", data);
  refresh();
  return { ok: true };
};

export const uploadLogo = async (form: FormData): Promise<ActionResult> => {
  const user = await requireSuperAdmin();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("Missing file");
  }
  if (!LOGO_TYPES.has(file.type)) {
    return fail("Logo must be a PNG, JPEG, WebP or SVG image");
  }
  if (file.size > MAX_LOGO_BYTES) {
    return fail("Logo must be 512 KB or smaller");
  }
  const logoImage = new Uint8Array(await file.arrayBuffer());
  await upsert({
    logoImage,
    logoMime: file.type,
    // New query string per upload so browsers and email clients refetch it.
    logoUrl: `${LOGO_ROUTE}?v=${Date.now()}`,
  });
  await audit(user, "admin.settings.branding_changed", {
    logo: "uploaded",
    size: file.size,
    type: file.type,
  });
  refresh();
  return { ok: true };
};

export const removeLogo = async (): Promise<ActionResult> => {
  const user = await requireSuperAdmin();
  await upsert({ logoImage: null, logoMime: null, logoUrl: null });
  await audit(user, "admin.settings.branding_changed", { logo: "removed" });
  refresh();
  return { ok: true };
};

// ─── Billing ─────────────────────────────────────────────────────────────────

const billingSchema = z.object({
  billingMode: z.enum(["panel", "whmcs", "blesta", "paymenter"]),
  storeUrl: optionalUrl,
});

export type BillingInput = z.input<typeof billingSchema>;

export const saveBilling = async (
  input: BillingInput
): Promise<ActionResult> => {
  const user = await requireSuperAdmin();
  const parsed = billingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await upsert(parsed.data);
  await audit(user, "admin.settings.billing_changed", parsed.data);
  refresh();
  return { ok: true };
};

// Returns the plaintext key once; only its hash is stored. Replaces any
// existing key, so the billing module must be updated with the new one.
export const generateApiKey = async (): Promise<
  ActionResult<{ key: string }>
> => {
  const user = await requireSuperAdmin();
  const { hash, hint, key } = generateBillingApiKey();
  await upsert({ billingApiKeyHash: hash, billingApiKeyHint: hint });
  await audit(user, "admin.settings.api_key_generated", { hint });
  revalidatePath("/admin/settings");
  return { data: { key }, ok: true };
};

export const revokeApiKey = async (): Promise<ActionResult> => {
  const user = await requireSuperAdmin();
  await upsert({ billingApiKeyHash: null, billingApiKeyHint: null });
  await audit(user, "admin.settings.api_key_revoked");
  revalidatePath("/admin/settings");
  return { ok: true };
};
