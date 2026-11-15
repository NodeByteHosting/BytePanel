import "server-only";
import { Stripe } from "stripe";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

let client: Stripe | undefined;

export const stripe = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
};

export const stripeCustomerFor = async (user: {
  email: string;
  id: string;
  name: string | null;
}) => {
  const previous = await prisma.subscription.findFirst({
    orderBy: { createdAt: "desc" },
    select: { providerCustomerId: true },
    where: {
      provider: "stripe",
      providerCustomerId: { not: null },
      userId: user.id,
    },
  });
  if (previous?.providerCustomerId) {
    return previous.providerCustomerId;
  }
  const customer = await stripe().customers.create({
    email: user.email,
    metadata: { bytepanelUserId: user.id },
    name: user.name ?? undefined,
  });
  return customer.id;
};

export const stripePeriodEnd = (subscription: Stripe.Subscription) => {
  const ends = subscription.items.data.map((item) => item.current_period_end);
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
};

export const invoiceSubscriptionId = (invoice: Stripe.Invoice) => {
  const ref = invoice.parent?.subscription_details?.subscription;
  if (!ref) {
    return null;
  }
  return typeof ref === "string" ? ref : ref.id;
};
