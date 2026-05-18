"use server";

import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";
import { humanId } from "human-id";
import type { Stripe } from "stripe";
import { ulid } from "ulid";
import { z } from "zod";

import { games, validateSettings } from "@/games";
import { prisma } from "@/lib/db";
import { API_URL, SNAPSHOT_ENVIRONMENT } from "@/lib/env";
import { getProviderForUserWithImage } from "@/lib/providers";
import { requireUser } from "@/lib/session";

const createServerSchema = z.object({
  game: z.enum(games.map((g) => g.id) as [string, ...string[]]),
  location: z.string().min(1),
  name: z.string().min(3).max(40),
  serverType: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;

export type CreateServerResult =
  | { ok: true; id: string }
  | { ok: false; error: string }
  | {
      ok: false;
      error: string;
      paymentRequired: true;
      checkoutUrl: string;
      serverId: string;
    };

/**
 * Get or create a Stripe Price for a given server type and monthly GBP pence amount.
 * Uses a stable lookup_key so repeated calls are idempotent.
 */
const getOrCreateStripePrice = async (
  stripe: Stripe,
  serverTypeName: string,
  pricePerMonthCents: number
): Promise<string> => {
  const lookupKey = `nodebyte-${serverTypeName.toLowerCase()}-monthly`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey] });
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }
  // Create a recurring product + price for this server type
  const product = await stripe.products.create({
    metadata: { serverType: serverTypeName },
    name: `NodeByte — ${serverTypeName} Game Server`,
  });
  const price = await stripe.prices.create({
    currency: "gbp",
    lookup_key: lookupKey,
    product: product.id,
    recurring: { interval: "month" },
    transfer_lookup_key: true,
    unit_amount: pricePerMonthCents,
  });
  return price.id;
};

export const createServer = async (
  input: CreateServerInput
): Promise<CreateServerResult> => {
  const user = await requireUser();

  const parsed = createServerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  const game = games.find((g) => g.id === parsed.data.game);
  if (!game) {
    return { error: "Unknown game", ok: false };
  }

  const { provider, imageId } = await getProviderForUserWithImage(
    user.id,
    SNAPSHOT_ENVIRONMENT
  );
  const catalog = await provider.getCatalog(imageId);

  const type = catalog.serverTypes.find(
    (t) => t.name === parsed.data.serverType
  );
  if (!type) {
    return { error: "Unknown server type", ok: false };
  }
  // Specs are user-chosen — no hard minimum. Game requirements are advisory only.

  const location = type.locations.find((l) => l.name === parsed.data.location);
  if (!location) {
    return { error: "Region not supported for this server type", ok: false };
  }
  if (!location.available) {
    return {
      error: "Region is temporarily unavailable. Please pick another.",
      ok: false,
    };
  }

  let settings: Record<string, unknown> = {};
  if (parsed.data.settings) {
    const validation = validateSettings(game.settings, parsed.data.settings);
    if (!validation.ok) {
      return { error: validation.error, ok: false };
    }
    settings = validation.data as Record<string, unknown>;
  }

  const id = ulid();
  const rconPassword = crypto.randomBytes(16).toString("hex");
  const joinPassword = game.usesJoinPassword
    ? humanId({ adjectiveCount: 0, capitalize: false, separator: "-" })
    : null;

  const server = await prisma.server.create({
    data: {
      desiredState: "running",
      game: parsed.data.game,
      id,
      joinPassword,
      location: parsed.data.location,
      name: parsed.data.name,
      observedState: "pending",
      phase: "queued",
      rconPassword,
      serverType: parsed.data.serverType,
      settings: settings as Prisma.InputJsonValue,
      userId: user.id,
    },
  });

  // Create a Stripe Checkout Session — provisioning starts after payment is confirmed
  try {
    const { getOrCreateStripeCustomer } = await import("@/lib/stripe");
    const stripeLib = await import("@/lib/stripe");
    const { stripe } = stripeLib;

    const stripeCustomerId = await getOrCreateStripeCustomer(
      prisma,
      user.id,
      user.email,
      user.name
    );

    const pricePerMonthCents = Math.round(type.pricePerMonth * 100);
    const priceId = await getOrCreateStripePrice(
      stripe,
      type.name,
      pricePerMonthCents
    );

    const session = await stripe.checkout.sessions.create({
      cancel_url: `${API_URL}/dashboard/new`,
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        nodebyteServerId: server.id,
        nodebyteUserId: user.id,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          nodebyteServerId: server.id,
          nodebyteUserId: user.id,
          serverType: type.name,
        },
      },
      success_url: `${API_URL}/dashboard/new/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return {
      checkoutUrl: session.url,
      error: "Payment required",
      ok: false as const,
      paymentRequired: true as const,
      serverId: server.id,
    };
  } catch (billingError) {
    console.error("[create-server] Stripe billing error:", billingError);
    await prisma.server.delete({ where: { id: server.id } });
    return {
      error: "Billing setup failed. Please try again.",
      ok: false,
    };
  }
};
