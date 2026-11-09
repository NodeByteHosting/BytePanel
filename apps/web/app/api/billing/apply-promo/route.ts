import { NextResponse } from "next/server";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { applyPromoCodeToSubscription } from "@/lib/stripe";

const schema = z.object({
  code: z.string().min(1).max(50),
  subscriptionId: z.string().min(1),
});

/**
 * POST /api/billing/apply-promo
 * Apply a Stripe promotion code to the caller's subscription.
 * Body: { subscriptionId: string; code: string }
 */
export const POST = async (req: Request) => {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { subscriptionId, code } = parsed.data;

  // Verify the subscription belongs to this user
  const sub = await prisma.subscription.findFirst({
    select: {
      id: true,
      serverId: true,
      status: true,
      stripeSubscriptionId: true,
    },
    where: {
      id: subscriptionId,
      server: { userId: user.id },
      status: { in: ["active", "trialing", "incomplete", "past_due"] },
    },
  });

  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found or not eligible for a promo code" },
      { status: 404 }
    );
  }

  try {
    const result = await applyPromoCodeToSubscription(
      sub.stripeSubscriptionId,
      code
    );

    // Persist promo code immediately (webhook will also fire to confirm)
    await prisma.subscription.update({
      data: {
        discountAmountCents: result.amountOffCents,
        promoCode: result.code,
      },
      where: { id: sub.id },
    });

    await logEvent({
      action: "billing.promo_applied",
      actorEmail: user.email,
      actorId: user.id,
      metadata: {
        amountOffCents: result.amountOffCents,
        percentOff: result.percentOff,
        promoCode: result.code,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      },
      targetId: sub.serverId,
      targetType: "server",
    });

    return NextResponse.json({
      amountOffCents: result.amountOffCents,
      code: result.code,
      percentOff: result.percentOff,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply promo code";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
