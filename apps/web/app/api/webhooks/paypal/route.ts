import { NextResponse } from "next/server";

import { paypal, verifyPaypalWebhook } from "@/lib/billing/paypal";
import type { PaypalSubscription } from "@/lib/billing/paypal";
import {
  activateSubscription,
  endSubscription,
  findByProvider,
  markPaid,
  markPastDue,
  recordPayment,
  suspendForBilling,
} from "@/lib/billing/service";
import { paypalEnabled } from "@/lib/env";

export const runtime = "nodejs";

interface PaypalEvent {
  event_type: string;
  resource: Record<string, unknown>;
}

interface PaypalSale {
  amount?: { currency?: string; total?: string };
  billing_agreement_id?: string;
  id: string;
}

const nextBilling = (remote: PaypalSubscription) =>
  remote.billing_info?.next_billing_time
    ? new Date(remote.billing_info.next_billing_time)
    : null;

const subscriptionEvent = async (
  event: PaypalEvent,
  action: (
    subscription: NonNullable<Awaited<ReturnType<typeof findByProvider>>>,
    remote: PaypalSubscription
  ) => Promise<unknown>
) => {
  const remote = event.resource as unknown as PaypalSubscription;
  const subscription = await findByProvider("paypal", remote.id);
  if (subscription) {
    await action(subscription, remote);
  }
};

const handlers: Record<string, (event: PaypalEvent) => Promise<unknown>> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": async (event) => {
    const remote = event.resource as unknown as PaypalSubscription;
    if (remote.custom_id) {
      await activateSubscription(remote.custom_id, {
        currentPeriodEnd: nextBilling(remote),
        providerSubscriptionId: remote.id,
      });
    }
  },
  "BILLING.SUBSCRIPTION.CANCELLED": (event) =>
    subscriptionEvent(event, (subscription) => endSubscription(subscription)),
  "BILLING.SUBSCRIPTION.EXPIRED": (event) =>
    subscriptionEvent(event, (subscription) =>
      endSubscription(subscription, { immediate: true })
    ),
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED": (event) =>
    subscriptionEvent(event, (subscription) => markPastDue(subscription)),
  "BILLING.SUBSCRIPTION.RE-ACTIVATED": (event) =>
    subscriptionEvent(event, (subscription, remote) =>
      markPaid(subscription, nextBilling(remote))
    ),
  "BILLING.SUBSCRIPTION.SUSPENDED": (event) =>
    subscriptionEvent(event, async (subscription) => {
      await markPastDue(subscription);
      await suspendForBilling(subscription);
    }),
  "PAYMENT.SALE.COMPLETED": async (event) => {
    const sale = event.resource as unknown as PaypalSale;
    if (!sale.billing_agreement_id) {
      return;
    }
    const subscription = await findByProvider(
      "paypal",
      sale.billing_agreement_id
    );
    if (!subscription) {
      return;
    }
    await recordPayment({
      amountCents: Math.round(Number(sale.amount?.total ?? 0) * 100),
      currency: sale.amount?.currency ?? subscription.currency,
      providerPaymentId: sale.id,
      status: "paid",
      subscriptionId: subscription.id,
    });
    const remote = await paypal<PaypalSubscription>(
      "GET",
      `/v1/billing/subscriptions/${encodeURIComponent(sale.billing_agreement_id)}`
    );
    await markPaid(subscription, nextBilling(remote));
  },
};

export const POST = async (request: Request) => {
  if (!paypalEnabled) {
    return NextResponse.json(
      { error: "PayPal is not configured" },
      { status: 404 }
    );
  }
  let event: PaypalEvent;
  try {
    event = (await request.json()) as PaypalEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!(await verifyPaypalWebhook(request.headers, event))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  await handlers[event.event_type]?.(event);
  return NextResponse.json({ received: true });
};
