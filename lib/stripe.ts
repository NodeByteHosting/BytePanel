import "server-only";
import type { PrismaClient } from "@prisma/client";
import { Stripe } from "stripe";

import { env } from "./env";

if (!env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set. Stripe billing is required.");
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

// Idempotently get or create a Stripe customer for a NodeByte user.
export const getOrCreateStripeCustomer = async (
  prisma: PrismaClient,
  userId: string,
  email: string,
  name: string | null
): Promise<string> => {
  const existing = await prisma.billingCustomer.findUnique({
    select: { stripeCustomerId: true },
    where: { userId },
  });
  if (existing) {
    return existing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { nodebyteUserId: userId },
    name: name ?? undefined,
  });

  await prisma.billingCustomer.create({
    data: {
      email,
      id: customer.id,
      stripeCustomerId: customer.id,
      userId,
    },
  });

  return customer.id;
};

/**
 * Apply a promotion code (by code string, e.g. "SUMMER20") to an existing
 * Stripe subscription.  Returns the promotion code ID and discount details
 * on success, or throws with a user-friendly message.
 */
export const applyPromoCodeToSubscription = async (
  stripeSubscriptionId: string,
  promotionCode: string
): Promise<{
  promotionCodeId: string;
  amountOffCents: number | null;
  percentOff: number | null;
  code: string;
}> => {
  // Look up the promotion code to validate it exists and is active
  const promoCodes = await stripe.promotionCodes.list({
    active: true,
    code: promotionCode,
    limit: 1,
  });

  if (!promoCodes.data.length) {
    throw new Error("This promo code is invalid or has expired.");
  }

  const [promo] = promoCodes.data;

  // Apply to subscription by updating it with a discount
  await stripe.subscriptions.update(stripeSubscriptionId, {
    discounts: [{ promotion_code: promo.id }],
  });

  // coupon is nested under `promotion` in Stripe's current PromotionCode shape
  const coupon =
    typeof promo.promotion.coupon === "string" ? null : promo.promotion.coupon;
  return {
    amountOffCents: coupon?.amount_off ?? null,
    code: promo.code,
    percentOff: coupon?.percent_off ?? null,
    promotionCodeId: promo.id,
  };
};

/**
 * Cancel a Stripe subscription at period end (graceful cancellation).
 * The server keeps running until `currentPeriodEnd`.
 */
export const cancelSubscriptionAtPeriodEnd = (
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> =>
  stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

/**
 * Cancel a Stripe subscription immediately.
 * Use this for admin-initiated forced cancellations.
 */
export const cancelSubscriptionImmediately = (
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> =>
  stripe.subscriptions.cancel(stripeSubscriptionId);
