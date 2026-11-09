import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { connection } from "next/server";
import { cache } from "react";

import { prisma } from "./db";
import { bytepayEnabled } from "./env";

export const SETTINGS_ID = "default";

export const DEFAULT_PANEL_NAME = "BytePanel";

export interface Branding {
  panelName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportUrl: string | null;
  signUpEnabled: boolean;
  bytepayLogin: boolean;
}

export interface PanelSettings extends Omit<
  Branding,
  "bytepayLogin" | "signUpEnabled"
> {
  storeUrl: string | null;
  billingApiKeyHint: string | null;
}

const DEFAULTS: PanelSettings = {
  billingApiKeyHint: null,
  logoUrl: null,
  panelName: DEFAULT_PANEL_NAME,
  storeUrl: null,
  supportUrl: null,
  websiteUrl: null,
};

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
    logoUrl: row.logoUrl,
    panelName: row.panelName,
    storeUrl: row.storeUrl,
    supportUrl: row.supportUrl,
    websiteUrl: row.websiteUrl,
  };
};

export const getPanelSettings = cache(async (): Promise<PanelSettings> => {
  await connection();
  return readPanelSettings();
});

export const getBranding = async (): Promise<Branding> => {
  const { panelName, logoUrl, websiteUrl, supportUrl } =
    await getPanelSettings();
  return {
    bytepayLogin: bytepayEnabled,
    logoUrl,
    panelName,
    signUpEnabled: (await prisma.user.count()) === 0,
    supportUrl,
    websiteUrl,
  };
};

const hashKey = (key: string) => createHash("sha256").update(key).digest();

export const generateBillingApiKey = () => {
  const key = `bpnl_${randomBytes(32).toString("base64url")}`;
  return {
    hash: hashKey(key).toString("hex"),
    hint: key.slice(0, 10),
    key,
  };
};

export const verifyBillingApiKey = async (key: string): Promise<boolean> => {
  const row = await prisma.panelSettings.findUnique({
    select: { billingApiKeyHash: true },
    where: { id: SETTINGS_ID },
  });
  if (!row?.billingApiKeyHash) {
    return false;
  }
  const expected = Buffer.from(row.billingApiKeyHash, "hex");
  const actual = hashKey(key);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
