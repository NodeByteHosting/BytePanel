import "server-only";
import type {
  PaymentProvider,
  PaymentStatus,
  Subscription,
} from "@prisma/client";
import { ulid } from "ulid";
import { z } from "zod";

import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { API_URL } from "@/lib/env";
import {
  deployServer,
  prepareServer,
  setSuspended,
} from "@/lib/servers/service";

import { paypal, paypalPlanFor } from "./paypal";
import type { PaypalSubscription } from "./paypal";
import { stripe, stripeCustomerFor, stripePeriodEnd } from "./stripe";

export const orderSchema = z.object({
  eggId: z.string().min(1),
  locationId: z.string().min(1).nullable(),
  name: z.string().trim().min(3).max(40),
});

export type Order = z.infer<typeof orderSchema>;

const actor = (provider: PaymentProvider) => `billing:${provider}`;

interface Details {
  currentPeriodEnd?: Date | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string;
}

const defined = (details: Details) =>
  Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  ) as Details;

export const startCheckout = async (input: {
  currency: string;
  order: Order;
  panelName: string;
  plan: {
    id: string;
    name: string;
    paypalPlanId: string | null;
    priceMonthCents: number;
  };
  provider: PaymentProvider;
  user: { email: string; id: string; name: string | null };
}) => {
  const id = ulid();
  const success = `${API_URL}/dashboard/new/success?order=${id}`;
  const cancel = `${API_URL}/dashboard/new?canceled=1`;
  await prisma.subscription.create({
    data: {
      currency: input.currency,
      id,
      order: input.order,
      planId: input.plan.id,
      priceMonthCents: input.plan.priceMonthCents,
      provider: input.provider,
      userId: input.user.id,
    },
  });

  if (input.provider === "stripe") {
    const customer = await stripeCustomerFor(input.user);
    await prisma.subscription.update({
      data: { providerCustomerId: customer },
      where: { id },
    });
    const session = await stripe().checkout.sessions.create({
      cancel_url: cancel,
      client_reference_id: id,
      customer,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: input.plan.name },
            recurring: { interval: "month" },
            unit_amount: input.plan.priceMonthCents,
          },
          quantity: 1,
        },
      ],
      metadata: { subscriptionId: id },
      mode: "subscription",
      subscription_data: { metadata: { subscriptionId: id } },
      success_url: `${success}&session_id={CHECKOUT_SESSION_ID}`,
    });
    if (!session.url) {
      throw new Error("Stripe did not return a checkout page");
    }
    return session.url;
  }

  const planId = await paypalPlanFor(
    input.plan,
    input.plan.priceMonthCents,
    input.currency
  );
  const created = await paypal<PaypalSubscription>(
    "POST",
    "/v1/billing/subscriptions",
    {
      application_context: {
        brand_name: input.panelName.slice(0, 127),
        cancel_url: cancel,
        return_url: success,
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
      },
      custom_id: id,
      plan_id: planId,
      subscriber: { email_address: input.user.email },
    }
  );
  await prisma.subscription.update({
    data: { providerSubscriptionId: created.id },
    where: { id },
  });
  const approve = created.links?.find((link) => link.rel === "approve");
  if (!approve) {
    throw new Error("PayPal did not return an approval page");
  }
  return approve.href;
};

const provision = async (id: string) => {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    include: { plan: true },
    where: { id },
  });
  if (subscription.serverId) {
    return;
  }
  const { plan } = subscription;
  const order = orderSchema.safeParse(subscription.order);
  if (!plan || !order.success) {
    await logEvent({
      action: "billing.provision_failed",
      actorEmail: actor(subscription.provider),
      metadata: { reason: plan ? "invalid order" : "plan deleted" },
      targetId: id,
      targetType: "subscription",
    });
    return;
  }
  const serverId = await prepareServer({
    asAdmin: true,
    eggId: order.data.eggId,
    limits: {
      allocationLimit: plan.allocationLimit,
      backupLimit: plan.backupLimit,
      cpu: plan.cpu,
      disk: plan.disk,
      io: plan.io,
      memory: plan.memory,
      swap: plan.swap,
    },
    name: order.data.name,
    planId: plan.id,
    userId: subscription.userId,
  });
  await prisma.subscription.update({ data: { serverId }, where: { id } });
  await logEvent({
    action: "billing.server.create",
    actorEmail: actor(subscription.provider),
    metadata: { planId: plan.id, subscriptionId: id },
    targetId: serverId,
    targetType: "server",
  });
  try {
    await deployServer(serverId, {
      locationId: order.data.locationId ?? plan.locationId,
    });
  } catch (error) {
    await logEvent({
      action: "billing.server.deploy_failed",
      actorEmail: actor(subscription.provider),
      metadata: {
        reason: error instanceof Error ? error.message : "Deployment failed",
      },
      targetId: serverId,
      targetType: "server",
    });
  }
};

export const activateSubscription = async (id: string, details: Details) => {
  const data = defined(details);
  const { count } = await prisma.subscription.updateMany({
    data: { ...data, status: "active" },
    where: { id, status: "pending" },
  });
  if (count === 0) {
    if (Object.keys(data).length) {
      await prisma.subscription.updateMany({ data, where: { id } });
    }
    return;
  }
  await provision(id);
};

export const findByProvider = (
  provider: PaymentProvider,
  providerSubscriptionId: string
) =>
  prisma.subscription.findUnique({
    where: { provider, providerSubscriptionId },
  });

export const recordPayment = (input: {
  amountCents: number;
  currency: string;
  providerPaymentId: string;
  receiptUrl?: string | null;
  status: PaymentStatus;
  subscriptionId: string;
}) =>
  prisma.payment.upsert({
    create: {
      ...input,
      currency: input.currency.toUpperCase(),
      id: ulid(),
      receiptUrl: input.receiptUrl ?? null,
    },
    update: { status: input.status },
    where: { providerPaymentId: input.providerPaymentId },
  });

const setServerSuspended = async (
  subscription: Subscription,
  suspended: boolean
) => {
  if (!subscription.serverId) {
    return;
  }
  const server = await prisma.server.findUnique({
    select: { deletedAt: true },
    where: { id: subscription.serverId },
  });
  if (!server || server.deletedAt) {
    return;
  }
  await setSuspended(subscription.serverId, suspended);
  await logEvent({
    action: suspended ? "billing.server.suspend" : "billing.server.unsuspend",
    actorEmail: actor(subscription.provider),
    targetId: subscription.serverId,
    targetType: "server",
  });
};

export const markPaid = async (
  subscription: Subscription,
  currentPeriodEnd?: Date | null
) => {
  if (subscription.suspendedAt) {
    await setServerSuspended(subscription, false);
  }
  await prisma.subscription.update({
    data: {
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      status: subscription.status === "canceled" ? "canceled" : "active",
      suspendedAt: null,
    },
    where: { id: subscription.id },
  });
};

export const markPastDue = (subscription: Subscription) =>
  prisma.subscription.update({
    data: { status: "past_due" },
    where: { id: subscription.id },
  });

export const suspendForBilling = async (subscription: Subscription) => {
  if (subscription.suspendedAt) {
    return;
  }
  await setServerSuspended(subscription, true);
  await prisma.subscription.update({
    data: { suspendedAt: new Date() },
    where: { id: subscription.id },
  });
};

export const endSubscription = async (
  subscription: Subscription,
  options: { immediate?: boolean } = {}
) => {
  await prisma.subscription.update({
    data: { status: "canceled" },
    where: { id: subscription.id },
  });
  const ended =
    options.immediate ||
    !subscription.currentPeriodEnd ||
    subscription.currentPeriodEnd <= new Date();
  if (ended && subscription.status !== "pending") {
    await suspendForBilling(subscription);
  }
};

export const confirmCheckout = async (
  subscription: Subscription,
  sessionId: string | null
) => {
  if (subscription.status !== "pending") {
    return;
  }
  if (subscription.provider === "stripe") {
    if (!sessionId) {
      return;
    }
    const session = await stripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (
      session.client_reference_id !== subscription.id ||
      session.status !== "complete" ||
      !session.subscription ||
      typeof session.subscription === "string"
    ) {
      return;
    }
    await activateSubscription(subscription.id, {
      currentPeriodEnd: stripePeriodEnd(session.subscription),
      providerSubscriptionId: session.subscription.id,
    });
    return;
  }
  if (!subscription.providerSubscriptionId) {
    return;
  }
  const remote = await paypal<PaypalSubscription>(
    "GET",
    `/v1/billing/subscriptions/${encodeURIComponent(subscription.providerSubscriptionId)}`
  );
  if (remote.status === "ACTIVE" && remote.custom_id === subscription.id) {
    await activateSubscription(subscription.id, {
      currentPeriodEnd: remote.billing_info?.next_billing_time
        ? new Date(remote.billing_info.next_billing_time)
        : null,
    });
  }
};

export const cancelSubscription = async (subscription: Subscription) => {
  if (!subscription.providerSubscriptionId) {
    throw new Error("This subscription isn't active");
  }
  await (subscription.provider === "stripe"
    ? stripe().subscriptions.update(subscription.providerSubscriptionId, {
        cancel_at_period_end: true,
      })
    : paypal(
        "POST",
        `/v1/billing/subscriptions/${encodeURIComponent(subscription.providerSubscriptionId)}/cancel`,
        { reason: "Cancelled by the customer" }
      ));
  await prisma.subscription.update({
    data: {
      cancelAtPeriodEnd: true,
      ...(subscription.provider === "paypal" ? { status: "canceled" } : {}),
    },
    where: { id: subscription.id },
  });
};

export const resumeSubscription = async (subscription: Subscription) => {
  if (
    subscription.provider !== "stripe" ||
    !subscription.providerSubscriptionId
  ) {
    throw new Error("Only card subscriptions can be resumed");
  }
  await stripe().subscriptions.update(subscription.providerSubscriptionId, {
    cancel_at_period_end: false,
  });
  await prisma.subscription.update({
    data: { cancelAtPeriodEnd: false },
    where: { id: subscription.id },
  });
};

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export const sweepSubscriptions = async () => {
  await prisma.subscription.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) },
      status: "pending",
    },
  });
  const ended = await prisma.subscription.findMany({
    where: {
      OR: [
        { currentPeriodEnd: null },
        { currentPeriodEnd: { lte: new Date() } },
      ],
      status: "canceled",
      suspendedAt: null,
    },
  });
  await Promise.allSettled(ended.map(suspendForBilling));
};
