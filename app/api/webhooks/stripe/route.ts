import type { InvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Stripe } from "stripe";
import { start } from "workflow/api";

import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  sendInvoicePaidEmail,
  sendInvoiceFailedEmail,
  sendSuspensionWarningEmail,
  sendServerCreatedEmail,
} from "@/lib/mail";
import { ADDON_DEFAULTS, SUSPENSION_GRACE_DAYS } from "@/lib/pricing";
import { stripe } from "@/lib/stripe";
import { provisionServer } from "@/lib/workflows/provision-server";

/**
 * Map a Stripe subscription status to our internal SubscriptionStatus enum.
 * Both use the same value names so this is a simple cast, but kept explicit
 * for safety if the enum ever diverges.
 */
const toSubscriptionStatus = (
  status: Stripe.Subscription["status"]
): SubscriptionStatus => {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused": {
      return status;
    }
    default: {
      return "incomplete";
    }
  }
};

const toInvoiceStatus = (
  status: Stripe.Invoice["status"] | null | undefined
): InvoiceStatus => {
  switch (status) {
    case "draft":
    case "open":
    case "paid":
    case "uncollectible":
    case "void": {
      return status;
    }
    default: {
      return "open";
    }
  }
};

/** Resolve the Stripe customer ID string from an invoice object. */
const resolveInvoiceCustomerId = (invoice: Stripe.Invoice): string | null => {
  if (typeof invoice.customer === "string") {
    return invoice.customer;
  }
  return (invoice.customer as Stripe.Customer | null)?.id ?? null;
};

/** Resolve the Stripe subscription ID string from an invoice object. */
const resolveInvoiceSubId = (invoice: Stripe.Invoice): string | null => {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (typeof sub === "string") {
    return sub;
  }
  return sub?.id ?? null;
};

/** Resolve the paid_at date from invoice status_transitions. */
const resolveInvoicePaidAt = (invoice: Stripe.Invoice): Date | null => {
  if (typeof invoice.status_transitions?.paid_at === "number") {
    return new Date(invoice.status_transitions.paid_at * 1000);
  }
  return null;
};

/** Build prisma upsert args for an Invoice record. */
const buildInvoiceUpsertData = (
  invoice: Stripe.Invoice,
  billingCustomerId: string,
  internalSubId: string | null,
  paidAt: Date | null
) => ({
  create: {
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    billingCustomerId,
    currency: (invoice.currency ?? "gbp").toUpperCase(),
    description: invoice.description ?? null,
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
    id: invoice.id,
    invoicePdf: invoice.invoice_pdf ?? null,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    paidAt,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    periodStart: invoice.period_start
      ? new Date(invoice.period_start * 1000)
      : null,
    status: toInvoiceStatus(invoice.status),
    stripeInvoiceId: invoice.id,
    subscriptionId: internalSubId,
  },
  update: {
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    description: invoice.description ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    paidAt,
    status: toInvoiceStatus(invoice.status),
  },
  where: { stripeInvoiceId: invoice.id },
});

/** Upsert an Invoice record from a Stripe invoice object. */
const upsertInvoice = async (invoice: Stripe.Invoice) => {
  const customerId = resolveInvoiceCustomerId(invoice);
  if (!customerId) {
    return;
  }

  const subId = resolveInvoiceSubId(invoice);

  // Resolve our internal subscription ID from the Stripe subscription ID
  let internalSubId: string | null = null;
  if (subId) {
    const sub = await prisma.subscription.findUnique({
      select: { id: true },
      where: { stripeSubscriptionId: subId },
    });
    internalSubId = sub?.id ?? null;
  }

  // Resolve our internal billing customer ID from the Stripe customer ID
  const billingCustomer = await prisma.billingCustomer.findUnique({
    select: { id: true },
    where: { stripeCustomerId: customerId },
  });
  if (!billingCustomer) {
    return;
  }

  const paidAt = resolveInvoicePaidAt(invoice);
  await prisma.invoice.upsert(
    buildInvoiceUpsertData(invoice, billingCustomer.id, internalSubId, paidAt)
  );
};

/** Resolve promo code and coupon details from a subscription's discounts. */
const resolveSubscriptionDiscount = (subscription: Stripe.Subscription) => {
  const firstDiscount = subscription.discounts?.[0];
  const discountObj =
    firstDiscount && typeof firstDiscount !== "string" ? firstDiscount : null;

  let promoCode: string | null = null;
  if (discountObj) {
    promoCode =
      typeof discountObj.promotion_code === "string"
        ? discountObj.promotion_code
        : ((discountObj.promotion_code as { code?: string } | null)?.code ??
          null);
  }

  const couponObj =
    discountObj?.source.coupon && typeof discountObj.source.coupon !== "string"
      ? discountObj.source.coupon
      : null;

  return {
    couponAmountOff: couponObj?.amount_off ?? null,
    couponPercentOff: couponObj?.percent_off ?? null,
    promoCode,
  };
};

/** Resolve current period start/end from a subscription (2026 API compat). */
const resolveSubscriptionPeriod = (subscription: Stripe.Subscription) => {
  const subAny = subscription as unknown as Record<string, unknown>;
  return {
    periodEnd:
      typeof subAny.current_period_end === "number"
        ? new Date(subAny.current_period_end * 1000)
        : null,
    periodStart:
      typeof subAny.current_period_start === "number"
        ? new Date(subAny.current_period_start * 1000)
        : null,
  };
};

/** Handle customer.subscription.created / customer.subscription.updated */
const buildSubscriptionUpsertData = (
  subscription: Stripe.Subscription,
  firstItem: Stripe.SubscriptionItem | undefined,
  serverId: string,
  promoCode: string | null,
  couponAmountOff: number | null,
  periodStart: Date | null,
  periodEnd: Date | null,
  stripeProductId: string
) => {
  const canceledAt = subscription.cancel_at
    ? new Date((subscription.cancel_at as number) * 1000)
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;
  const stripePriceId = firstItem?.price.id ?? "";
  const status = toSubscriptionStatus(subscription.status);
  return {
    create: {
      billingCustomerId: subscription.customer as string,
      canceledAt,
      currency: subscription.currency.toUpperCase(),
      currentPeriodEnd: periodEnd,
      currentPeriodStart: periodStart,
      discountAmountCents: couponAmountOff,
      id: subscription.id,
      planName: subscription.metadata?.serverType ?? "unknown",
      pricePerMonthCents: firstItem?.price.unit_amount ?? 0,
      promoCode,
      serverId,
      status,
      stripePriceId,
      stripeProductId,
      stripeSubscriptionId: subscription.id,
      trialEnd,
    },
    update: {
      canceledAt,
      currentPeriodEnd: periodEnd,
      currentPeriodStart: periodStart,
      discountAmountCents: couponAmountOff,
      promoCode,
      status,
      stripePriceId,
      trialEnd,
    },
    where: { stripeSubscriptionId: subscription.id },
  };
};

const handleSubscriptionChanged = async (
  eventType: string,
  subscription: Stripe.Subscription
) => {
  const serverId = subscription.metadata?.nodebyteServerId;
  if (!serverId) {
    return;
  }

  const { promoCode, couponAmountOff, couponPercentOff } =
    resolveSubscriptionDiscount(subscription);
  const { periodStart, periodEnd } = resolveSubscriptionPeriod(subscription);

  const [firstItem] = subscription.items.data;
  const stripeProductId =
    typeof firstItem?.price.product === "string"
      ? firstItem.price.product
      : ((firstItem?.price.product as Stripe.Product)?.id ?? "");

  await prisma.subscription.upsert(
    buildSubscriptionUpsertData(
      subscription,
      firstItem,
      serverId,
      promoCode,
      couponAmountOff,
      periodStart,
      periodEnd,
      stripeProductId
    )
  );

  // Log promo applied audit event if a discount just appeared
  if (
    eventType === "customer.subscription.updated" &&
    promoCode &&
    couponAmountOff !== null
  ) {
    await logEvent({
      action: "billing.promo_applied",
      metadata: {
        amountOffCents: couponAmountOff,
        percentOff: couponPercentOff,
        promoCode,
        stripeSubscriptionId: subscription.id,
      },
      targetId: serverId,
      targetType: "server",
    });
  }
};

/** Handle customer.subscription.deleted */
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  await prisma.subscription.updateMany({
    data: { canceledAt: new Date(), status: "canceled" },
    where: { stripeSubscriptionId: subscription.id },
  });
};

/** Handle invoice.payment_succeeded */
const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  await upsertInvoice(invoice);

  const subId = resolveInvoiceSubId(invoice);
  if (!subId) {
    return;
  }

  const updated = await prisma.subscription.updateMany({
    data: { status: "active", suspendedAt: null },
    where: { status: { not: "canceled" }, stripeSubscriptionId: subId },
  });

  if (updated.count > 0) {
    const sub = await prisma.subscription.findFirst({
      select: { server: { select: { id: true } }, serverId: true },
      where: { stripeSubscriptionId: subId },
    });
    if (sub?.serverId) {
      await prisma.server.updateMany({
        data: { desiredState: "running" },
        where: { desiredState: "stopped", id: sub.serverId },
      });
    }
  }

  const customer = await prisma.billingCustomer.findUnique({
    select: { user: { select: { email: true, name: true } } },
    where: { stripeCustomerId: invoice.customer as string },
  });
  if (customer?.user) {
    const sub = await prisma.subscription.findFirst({
      select: { planName: true, pricePerMonthCents: true },
      where: { stripeSubscriptionId: subId },
    });
    await sendInvoicePaidEmail({
      amountPaidCents: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      invoicePdf: invoice.invoice_pdf ?? null,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      planName: sub?.planName ?? "Server",
      toEmail: customer.user.email,
      toName: customer.user.name,
    });
  }
};

/** Send the server-created welcome email — errors are silently swallowed */
const sendCheckoutWelcomeEmail = async (serverId: string) => {
  const server = await prisma.server.findUnique({
    select: {
      game: true,
      location: true,
      name: true,
      user: { select: { email: true, name: true } },
    },
    where: { id: serverId },
  });
  if (!server?.user) {
    return;
  }
  const appUrl = process.env.BETTER_AUTH_URL ?? "https://panel.nodebyte.host";
  try {
    await sendServerCreatedEmail({
      game: server.game,
      region: server.location,
      serverName: server.name,
      serverUrl: `${appUrl}/dashboard/${serverId}`,
      toEmail: server.user.email,
      userName: server.user.name,
    });
  } catch {
    // ignore
  }
};

/** Upsert subscription + addons from a completed checkout */
const upsertCheckoutSubscriptionAndAddons = async (
  session: Stripe.Checkout.Session,
  subscriptionId: string,
  customerId: string
) => {
  const serverId = session.metadata?.nodebyteServerId ?? "";
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const [firstItem] = subscription.items.data;
  const pricePerMonthCents = firstItem?.price.unit_amount ?? 0;
  const stripeProductId =
    typeof firstItem?.price.product === "string"
      ? firstItem.price.product
      : ((firstItem?.price.product as Stripe.Product)?.id ?? "");

  await prisma.subscription.upsert({
    create: {
      billingCustomerId: customerId,
      currency: (subscription.currency ?? "gbp").toUpperCase(),
      id: subscriptionId,
      planName: subscription.metadata?.serverType ?? "unknown",
      pricePerMonthCents,
      serverId,
      status: "active",
      stripePriceId: firstItem?.price.id ?? "",
      stripeProductId,
      stripeSubscriptionId: subscriptionId,
    },
    update: { status: "active" },
    where: { stripeSubscriptionId: subscriptionId },
  });

  await prisma.serverAddon.createMany({
    data: [
      {
        freeAllowance: ADDON_DEFAULTS.backup.freeAllowance,
        id: `${serverId}-backup`,
        pricePerUnitCents: ADDON_DEFAULTS.backup.pricePerExtraUnitCents,
        quantity: ADDON_DEFAULTS.backup.freeAllowance,
        serverId,
        subscriptionId,
        type: "backup",
      },
      {
        freeAllowance: ADDON_DEFAULTS.snapshot.freeAllowance,
        id: `${serverId}-snapshot`,
        pricePerUnitCents: ADDON_DEFAULTS.snapshot.pricePerExtraUnitCents,
        quantity: ADDON_DEFAULTS.snapshot.freeAllowance,
        serverId,
        subscriptionId,
        type: "snapshot",
      },
      {
        freeAllowance: ADDON_DEFAULTS.database.freeAllowance,
        id: `${serverId}-database`,
        pricePerUnitCents: ADDON_DEFAULTS.database.pricePerExtraUnitCents,
        quantity: ADDON_DEFAULTS.database.freeAllowance,
        serverId,
        subscriptionId,
        type: "database",
      },
    ],
    skipDuplicates: true,
  });

  return serverId;
};

/** Handle checkout.session.completed — creates subscription/addons and starts provisioning */
const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session
) => {
  const serverId = session.metadata?.nodebyteServerId;
  if (!serverId) {
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : ((session.subscription as Stripe.Subscription | null)?.id ?? null);
  if (!subscriptionId) {
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : ((session.customer as Stripe.Customer | null)?.id ?? "");

  await upsertCheckoutSubscriptionAndAddons(
    session,
    subscriptionId,
    customerId
  );
  await start(provisionServer, [{ serverId }]);
  revalidatePath("/dashboard", "layout");
  await sendCheckoutWelcomeEmail(serverId);
};

/** Handle invoice.payment_failed */
const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  await upsertInvoice(invoice);

  const subId = resolveInvoiceSubId(invoice);
  if (!subId) {
    return;
  }

  await prisma.subscription.updateMany({
    data: { status: "past_due" },
    where: { stripeSubscriptionId: subId },
  });

  const [sub, customer] = await Promise.all([
    prisma.subscription.findFirst({
      select: {
        currentPeriodEnd: true,
        id: true,
        serverId: true,
        suspendedAt: true,
      },
      where: { stripeSubscriptionId: subId },
    }),
    prisma.billingCustomer.findUnique({
      select: { user: { select: { email: true, name: true } } },
      where: { stripeCustomerId: invoice.customer as string },
    }),
  ]);

  if (!sub || !customer?.user) {
    return;
  }

  const createdAt = invoice.created
    ? new Date(invoice.created * 1000)
    : new Date();
  const gracePeriodEnd = new Date(
    createdAt.getTime() + SUSPENSION_GRACE_DAYS * 24 * 60 * 60 * 1000
  );

  if (new Date() >= gracePeriodEnd) {
    await Promise.all([
      prisma.server.updateMany({
        data: { desiredState: "stopped", lastSuspendedAt: new Date() },
        where: { id: sub.serverId },
      }),
      prisma.subscription.update({
        data: { suspendedAt: new Date() },
        where: { id: sub.id },
      }),
    ]);
    await logEvent({
      action: "billing.subscription_suspended",
      metadata: { invoiceId: invoice.id, reason: "grace_period_exceeded" },
      targetId: sub.serverId,
      targetType: "server",
    });
    await sendSuspensionWarningEmail({
      gracePeriodEnd,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      planName: "Server",
      suspended: true,
      toEmail: customer.user.email,
      toName: customer.user.name,
    });
  } else {
    await sendSuspensionWarningEmail({
      gracePeriodEnd,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      planName: "Server",
      suspended: false,
      toEmail: customer.user.email,
      toName: customer.user.name,
    });
    await sendInvoiceFailedEmail({
      amountDueCents: invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      gracePeriodEnd,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      toEmail: customer.user.email,
      toName: customer.user.name,
    });
  }
};

export const POST = async (req: Request) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe webhooks not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Subscription lifecycle ──────────────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChanged(event.type, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      // ── Invoice events ─────────────────────────────────────────────────
      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        await upsertInvoice(invoice);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      default: {
        // Unhandled event — return 200 to prevent Stripe retries
        break;
      }
    }
  } catch (error) {
    console.error("[stripe-webhook]", event.type, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
};
