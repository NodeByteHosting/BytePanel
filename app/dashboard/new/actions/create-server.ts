"use server";

import type { Stripe } from "stripe";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { API_URL, env } from "@/lib/env";
import {
  findDeployableNode,
  prepareServer,
  ServiceError,
} from "@/lib/servers/service";
import { requireUser } from "@/lib/session";

const createServerSchema = z.object({
  eggId: z.string().min(1),
  environment: z.record(z.string(), z.string()).default({}),
  locationId: z.string().min(1),
  name: z.string().trim().min(3).max(40),
  planId: z.string().min(1),
});

export type CreateServerInput = z.input<typeof createServerSchema>;

export type CreateServerResult =
  | { ok: false; error: string }
  | {
      ok: false;
      error: string;
      paymentRequired: true;
      checkoutUrl: string;
      serverId: string;
    };

// One recurring monthly price per plan + amount, found again via lookup_key.
const getOrCreatePlanPrice = async (
  stripe: Stripe,
  plan: { id: string; name: string; priceMonthCents: number; currency: string }
): Promise<string> => {
  const lookupKey = `nodebyte-plan-${plan.id}-${plan.priceMonthCents}-${plan.currency.toLowerCase()}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey] });
  if (existing.data[0]) {
    return existing.data[0].id;
  }
  const product = await stripe.products.create({
    metadata: { nodebytePlanId: plan.id },
    name: `NodeByte — ${plan.name}`,
  });
  const price = await stripe.prices.create({
    currency: plan.currency.toLowerCase(),
    lookup_key: lookupKey,
    product: product.id,
    recurring: { interval: "month" },
    transfer_lookup_key: true,
    unit_amount: plan.priceMonthCents,
  });
  return price.id;
};

// Creates the server record, then sends the customer to Stripe Checkout. The
// server is placed on a node once the checkout webhook confirms payment.
export const createServer = async (
  input: CreateServerInput
): Promise<CreateServerResult> => {
  const user = await requireUser();
  const parsed = createServerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      ok: false,
    };
  }
  const { eggId, environment, locationId, name, planId } = parsed.data;

  const plan = await prisma.plan.findFirst({
    where: { active: true, id: planId },
  });
  if (!plan) {
    return { error: "That plan is no longer available", ok: false };
  }
  if (plan.locationId && plan.locationId !== locationId) {
    return {
      error: "That plan isn't offered in the selected location",
      ok: false,
    };
  }
  const egg = await prisma.egg.findFirst({
    where: { enabled: true, id: eggId },
  });
  if (!egg) {
    return { error: "Unknown game", ok: false };
  }
  const portsNeeded = Math.max(
    1,
    Array.isArray(egg.containerPorts) ? egg.containerPorts.length : 0
  );
  if (portsNeeded > plan.allocationLimit) {
    return {
      error: `${egg.name} needs a plan with at least ${portsNeeded} ports`,
      ok: false,
    };
  }

  // Don't take payment for something we can't place.
  const node = await findDeployableNode({
    allocations: portsNeeded,
    disk: plan.disk,
    locationId,
    memory: plan.memory,
  });
  if (!node) {
    return {
      error:
        "That location is full right now. Please pick another location or a smaller plan.",
      ok: false,
    };
  }

  let serverId: string;
  try {
    serverId = await prepareServer({
      eggId,
      environment,
      limits: {
        allocationLimit: plan.allocationLimit,
        backupLimit: plan.backupLimit,
        cpu: plan.cpu,
        disk: plan.disk,
        io: plan.io,
        memory: plan.memory,
        swap: plan.swap,
      },
      name,
      planId: plan.id,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return { error: error.message, ok: false };
    }
    throw error;
  }

  try {
    const { stripe, getOrCreateStripeCustomer } = await import("@/lib/stripe");
    const customer = await getOrCreateStripeCustomer(
      prisma,
      user.id,
      user.email,
      user.name
    );
    const price = await getOrCreatePlanPrice(stripe, plan);
    const returnUrl = env.NODEBYTE_PUBLIC_URL || API_URL;

    // On preview deployments Vercel protection intercepts the redirect back
    // from Stripe; pass the bypass secret so it gets through.
    const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? `x-vercel-protection-bypass=${env.VERCEL_AUTOMATION_BYPASS_SECRET}`
      : "";

    const metadata = {
      nodebyteLocationId: locationId,
      nodebytePlanId: plan.id,
      nodebyteServerId: serverId,
      nodebyteUserId: user.id,
      pricePerMonthCents: String(plan.priceMonthCents),
      serverType: plan.name,
    };
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${returnUrl}/dashboard/new${bypass ? `?${bypass}` : ""}`,
      customer,
      line_items: [{ price, quantity: 1 }],
      metadata,
      mode: "subscription",
      subscription_data: { metadata },
      success_url: `${returnUrl}/dashboard/new/success?session_id={CHECKOUT_SESSION_ID}${bypass ? `&${bypass}` : ""}`,
    });
    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }
    return {
      checkoutUrl: session.url,
      error: "Payment required",
      ok: false,
      paymentRequired: true,
      serverId,
    };
  } catch (billingError) {
    console.error("[create-server] Stripe billing error:", billingError);
    await prisma.server.delete({ where: { id: serverId } });
    return { error: "Billing setup failed. Please try again.", ok: false };
  }
};
