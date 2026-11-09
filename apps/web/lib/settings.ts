import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { BillingMode } from "@prisma/client";
import { connection } from "next/server";
import { cache } from "react";

import { prisma } from "./db";

export const SETTINGS_ID = "default";

export const DEFAULT_PANEL_NAME = "NodeByte";

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  blesta: "Blesta",
  panel: "Panel (Stripe)",
  paymenter: "Paymenter",
  whmcs: "WHMCS",
};

// Safe to send to the browser — never includes the API key hash.
export interface Branding {
  panelName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportUrl: string | null;
  // False when an external billing system creates customer accounts.
  signUpEnabled: boolean;
}

export interface PanelSettings extends Omit<Branding, "signUpEnabled"> {
  landingPage: boolean;
  billingMode: BillingMode;
  storeUrl: string | null;
  billingApiKeyHint: string | null;
}

const DEFAULTS: PanelSettings = {
  billingApiKeyHint: null,
  billingMode: "panel",
  landingPage: true,
  logoUrl: null,
  panelName: DEFAULT_PANEL_NAME,
  storeUrl: null,
  supportUrl: null,
  websiteUrl: null,
};

// Usable outside a request (webhooks, background jobs, email).
export const readPanelSettings = async (): Promise<PanelSettings> => {
  const row = await prisma.panelSettings.findUnique({
    omit: { billingApiKeyHash: true, logoImage: true },
    where: { id: SETTINGS_ID },
  });
  if (!row) {
    return DEFAULTS;
  }
  return {
    billingApiKeyHint: row.billingApiKeyHint,
    billingMode: row.billingMode,
    landingPage: row.landingPage,
    logoUrl: row.logoUrl,
    panelName: row.panelName,
    storeUrl: row.storeUrl,
    supportUrl: row.supportUrl,
    websiteUrl: row.websiteUrl,
  };
};

// One query per request. Settings are read at request time (not baked into
// prerendered pages) so admin changes show up immediately.
export const getPanelSettings = cache(async (): Promise<PanelSettings> => {
  await connection();
  return readPanelSettings();
});

export const isExternalBilling = (mode: BillingMode) => mode !== "panel";

export const getBranding = async (): Promise<Branding> => {
  const { panelName, logoUrl, websiteUrl, supportUrl, billingMode } =
    await getPanelSettings();
  return {
    logoUrl,
    panelName,
    signUpEnabled: !isExternalBilling(billingMode),
    supportUrl,
    websiteUrl,
  };
};

// ─── Application API key ─────────────────────────────────────────────────────

const hashKey = (key: string) => createHash("sha256").update(key).digest();

// Returns the plaintext key (shown to the admin once) and what to store.
export const generateBillingApiKey = () => {
  const key = `gsm_${randomBytes(32).toString("base64url")}`;
  return {
    hash: hashKey(key).toString("hex"),
    hint: key.slice(0, 10),
    key,
  };
};

export const verifyBillingApiKey = async (key: string): Promise<boolean> => {
  const row = await prisma.panelSettings.findUnique({
    select: { billingApiKeyHash: true, billingMode: true },
    where: { id: SETTINGS_ID },
  });
  if (!row?.billingApiKeyHash || !isExternalBilling(row.billingMode)) {
    return false;
  }
  const expected = Buffer.from(row.billingApiKeyHash, "hex");
  const actual = hashKey(key);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
