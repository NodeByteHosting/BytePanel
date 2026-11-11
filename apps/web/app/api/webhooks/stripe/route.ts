import { NextResponse } from "next/server";
import type { Stripe } from "stripe";

import {
  activateSubscription,
  endSubscription,
  findByProvider,
  markPaid,
  markPastDue,
  recordPayment,
} from "@/lib/billing/service";
import {
  invoiceSubscriptionId,
  stripe,
  stripePeriodEnd,
} from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const idOf = (ref: string | { id: string } | null) =>
  typeof ref === "string" ? ref : (ref?.id ?? null);

const linkedSubscription = async (stripeSubscriptionId: string) => {
  const known = await findByProvider("stripe", stripeSubscriptionId);
  if (known) {
    return known;
  }
  const remote = await stripe().subscriptions.retrieve(stripeSubscriptionId);
  const id = remote.metadata.subscriptionId;
  if (!id) {
    return null;
  }
  await activateSubscription(id, {
    currentPeriodEnd: stripePeriodEnd(remote),
    providerCustomerId: idOf(remote.customer),
    providerSubscriptionId: remote.id,
  });
  return prisma.subscription.findUnique({ where: { id } });
};

const handlers: Partial<
  Record<Stripe.Event["type"], (event: Stripe.Event) => Promise<void>>
> = {
  "checkout.session.completed": async (event) => {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = idOf(session.subscription);
    if (session.status !== "complete" || !subscriptionId) {
      return;
    }
    const remote = await stripe().subscriptions.retrieve(subscriptionId);
    const id = session.client_reference_id ?? remote.metadata.subscriptionId;
    if (!id) {
      return;
    }
    await activateSubscription(id, {
      currentPeriodEnd: stripePeriodEnd(remote),
      providerCustomerId: idOf(session.customer),
      providerSubscriptionId: subscriptionId,
    });
  },
  "customer.subscription.deleted": async (event) => {
    const remote = event.data.object as Stripe.Subscription;
    const subscription = await findByProvider("stripe", remote.id);
    if (subscription) {
      await endSubscription(subscription, { immediate: true });
    }
  },
  "customer.subscription.updated": async (event) => {
    const remote = event.data.object as Stripe.Subscription;
    const subscription = await findByProvider("stripe", remote.id);
    if (!subscription) {
      return;
    }
    await prisma.subscription.update({
      data: {
        cancelAtPeriodEnd: remote.cancel_at_period_end,
        currentPeriodEnd: stripePeriodEnd(remote),
      },
      where: { id: subscription.id },
    });
    if (remote.status === "active" || remote.status === "trialing") {
      await markPaid(subscription);
    } else if (remote.status === "past_due") {
      await markPastDue(subscription);
    } else if (
      remote.status === "unpaid" ||
      remote.status === "canceled" ||
      remote.status === "incomplete_expired"
    ) {
      await endSubscription(subscription, { immediate: true });
    }
  },
  "invoice.paid": async (event) => {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId || !invoice.id) {
      return;
    }
    const subscription = await linkedSubscription(stripeSubscriptionId);
    if (!subscription) {
      return;
    }
    await recordPayment({
      amountCents: invoice.amount_paid,
      currency: invoice.currency,
      providerPaymentId: invoice.id,
      receiptUrl: invoice.hosted_invoice_url,
      status: "paid",
      subscriptionId: subscription.id,
    });
    const ends = invoice.lines.data.map((line) => line.period.end);
    await markPaid(
      subscription,
      ends.length ? new Date(Math.max(...ends) * 1000) : null
    );
  },
  "invoice.payment_failed": async (event) => {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubscriptionId = invoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId || !invoice.id) {
      return;
    }
    const subscription = await findByProvider("stripe", stripeSubscriptionId);
    if (!subscription || subscription.status === "pending") {
      return;
    }
    await recordPayment({
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      providerPaymentId: invoice.id,
      receiptUrl: invoice.hosted_invoice_url,
      status: "failed",
      subscriptionId: subscription.id,
    });
    await markPastDue(subscription);
  },
};

export const POST = async (request: Request) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 404 }
    );
  }
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      body,
      request.headers.get("stripe-signature") ?? "",
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  await handlers[event.type]?.(event);
  return NextResponse.json({ received: true });
};
