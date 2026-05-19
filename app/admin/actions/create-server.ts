"use server";

import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";
import { humanId } from "human-id";
import { revalidatePath } from "next/cache";
import { ulid } from "ulid";
import { z } from "zod";

import { games, validateSettings } from "@/games";
import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { SNAPSHOT_ENVIRONMENT } from "@/lib/env";
import { sendServerProvisionInitiatedEmail } from "@/lib/mail";
import { getProviderForUserWithImage } from "@/lib/providers";
import type { Catalog } from "@/lib/providers/types";
import { requireSuperAdmin } from "@/lib/session";

const adminCreateServerSchema = z.object({
  game: z.enum(games.map((g) => g.id) as [string, ...string[]]),
  location: z.string().min(1),
  name: z.string().min(3).max(40),
  serverType: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
  /** Whether to skip Stripe billing (admin-assigned free servers) */
  skipBilling: z.boolean().default(false),
  targetUserId: z.string().min(1),
});

export type AdminCreateServerInput = z.infer<typeof adminCreateServerSchema>;

export type AdminCreateServerResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export const adminCreateServer = async (
  input: AdminCreateServerInput
): Promise<AdminCreateServerResult> => {
  const actor = await requireSuperAdmin();

  const parsed = adminCreateServerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", ok: false };
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    select: { email: true, id: true, name: true },
    where: { id: parsed.data.targetUserId },
  });
  if (!targetUser) {
    return { error: "Target user not found", ok: false };
  }

  const game = games.find((g) => g.id === parsed.data.game);
  if (!game) {
    return { error: "Unknown game", ok: false };
  }

  let catalog: Catalog;
  try {
    const { provider, imageId } = await getProviderForUserWithImage(
      parsed.data.targetUserId,
      SNAPSHOT_ENVIRONMENT
    );
    catalog = await provider.getCatalog(imageId);
  } catch {
    return { error: "Failed to fetch server catalog", ok: false };
  }

  const type = catalog.serverTypes.find(
    (t) => t.name === parsed.data.serverType
  );
  if (!type) {
    return { error: "Unknown server type", ok: false };
  }

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
      phase: "pending",
      rconPassword,
      serverType: parsed.data.serverType,
      settings: settings as Prisma.InputJsonValue,
      userId: parsed.data.targetUserId,
    },
  });

  // Optionally set up Stripe billing on behalf of the target user
  if (!parsed.data.skipBilling) {
    try {
      const { getOrCreateStripeCustomer, stripe } =
        await import("@/lib/stripe");

      const stripeCustomerId = await getOrCreateStripeCustomer(
        prisma,
        targetUser.id,
        targetUser.email,
        targetUser.name
      );

      // Reuse the same price lookup logic as the user create-server action
      const pricePerMonthCents = Math.round(
        (location.pricePerMonth ?? type.pricePerMonth) * 100
      );
      const lookupKey = `nodebyte-${type.name.toLowerCase()}-monthly`;
      let priceId: string;
      const existing = await stripe.prices.list({ lookup_keys: [lookupKey] });
      if (existing.data.length > 0) {
        priceId = existing.data[0].id;
      } else {
        const product = await stripe.products.create({
          metadata: { serverType: type.name },
          name: `NodeByte — ${type.name} Game Server`,
        });
        const price = await stripe.prices.create({
          currency: "gbp",
          lookup_key: lookupKey,
          product: product.id,
          recurring: { interval: "month" },
          transfer_lookup_key: true,
          unit_amount: pricePerMonthCents,
        });
        priceId = price.id;
      }

      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        metadata: {
          adminCreatedByUserId: actor.id,
          nodebyteServerId: server.id,
          nodebyteUserId: targetUser.id,
          serverType: type.name,
        },
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
      });

      await prisma.subscription.create({
        data: {
          billingCustomerId: stripeCustomerId,
          currency: "GBP",
          id: subscription.id,
          planName: type.name,
          pricePerMonthCents,
          serverId: server.id,
          status: "incomplete",
          stripePriceId: priceId,
          stripeProductId:
            typeof subscription.items.data[0].price.product === "string"
              ? subscription.items.data[0].price.product
              : subscription.items.data[0].price.product.id,
          stripeSubscriptionId: subscription.id,
        },
      });
    } catch (billingError) {
      console.error(
        "[admin-create-server] Stripe billing error:",
        billingError
      );
      // Continue — server is provisioned, billing can be reconciled
    }
  }

  // Email user to approve and trigger provisioning
  void sendServerProvisionInitiatedEmail({
    approveUrl: `${process.env.BETTER_AUTH_URL}/dashboard/${server.id}/approve-provision`,
    game: game.name,
    location: parsed.data.location,
    serverName: parsed.data.name,
    serverType: parsed.data.serverType,
    toEmail: targetUser.email,
    userName: targetUser.name ?? targetUser.email,
  });

  await logEvent({
    action: "admin.server.create",
    actorEmail: actor.email,
    actorId: actor.id,
    metadata: {
      game: parsed.data.game,
      location: parsed.data.location,
      serverName: parsed.data.name,
      serverType: parsed.data.serverType,
      skipBilling: parsed.data.skipBilling,
      targetUserEmail: targetUser.email,
      targetUserId: targetUser.id,
    },
    targetId: server.id,
    targetType: "server",
  });

  revalidatePath("/admin/servers", "layout");

  return { id: server.id, ok: true };
};
