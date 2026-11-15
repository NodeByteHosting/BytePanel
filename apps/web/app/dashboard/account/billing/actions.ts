"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logEvent } from "@/lib/audit";
import { cancelSubscription, resumeSubscription } from "@/lib/billing/service";
import { stripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { API_URL, stripeEnabled } from "@/lib/env";
import { requireUser } from "@/lib/session";

export type BillingActionResult = { error: string; ok: false } | { ok: true };

const ownSubscription = async (id: string) => {
  const user = await requireUser();
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
  });
  return { subscription, user };
};

const failure = (error: unknown): BillingActionResult => ({
  error: error instanceof Error ? error.message : "Something went wrong",
  ok: false,
});

export const cancelMySubscription = async (
  id: string
): Promise<BillingActionResult> => {
  const { subscription, user } = await ownSubscription(id);
  if (!subscription || subscription.status === "pending") {
    return { error: "Subscription not found", ok: false };
  }
  try {
    await cancelSubscription(subscription);
  } catch (error) {
    return failure(error);
  }
  await logEvent({
    action: "billing.subscription.cancel",
    actorEmail: user.email,
    actorId: user.id,
    targetId: subscription.id,
    targetType: "subscription",
  });
  revalidatePath("/dashboard/account/billing");
  return { ok: true };
};

export const resumeMySubscription = async (
  id: string
): Promise<BillingActionResult> => {
  const { subscription, user } = await ownSubscription(id);
  if (!subscription) {
    return { error: "Subscription not found", ok: false };
  }
  try {
    await resumeSubscription(subscription);
  } catch (error) {
    return failure(error);
  }
  await logEvent({
    action: "billing.subscription.resume",
    actorEmail: user.email,
    actorId: user.id,
    targetId: subscription.id,
    targetType: "subscription",
  });
  revalidatePath("/dashboard/account/billing");
  return { ok: true };
};

export const openCardPortal = async () => {
  const user = await requireUser();
  const latest = await prisma.subscription.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      provider: "stripe",
      providerCustomerId: { not: null },
      status: { not: "pending" },
      userId: user.id,
    },
  });
  if (!stripeEnabled || !latest?.providerCustomerId) {
    redirect("/dashboard/account/billing");
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: latest.providerCustomerId,
    return_url: `${API_URL}/dashboard/account/billing`,
  });
  redirect(session.url);
};
