"use server";

import { z } from "zod";

import { startCheckout } from "@/lib/billing/service";
import { prisma } from "@/lib/db";
import { paypalEnabled, stripeEnabled } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

const orderSchema = z.object({
  eggId: z.string().min(1),
  locationId: z.string().min(1).nullable(),
  planId: z.string().min(1),
  provider: z.enum(["stripe", "paypal"]),
});

const MAX_OPEN_CHECKOUTS = 5;

export type PlaceOrderResult =
  | { ok: true; url: string }
  | { error: string; ok: false };

export const placeOrder = async (
  input: z.input<typeof orderSchema>
): Promise<PlaceOrderResult> => {
  const user = await requireUser();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Choose a plan and a game", ok: false };
  }
  const { eggId, locationId, planId, provider } = parsed.data;
  const settings = await getPanelSettings();
  if (settings.billingProvider !== "builtin") {
    return { error: "Ordering in the panel is turned off", ok: false };
  }
  if (provider === "stripe" ? !stripeEnabled : !paypalEnabled) {
    return { error: "That payment method isn't available", ok: false };
  }

  const [plan, egg] = await Promise.all([
    prisma.plan.findFirst({
      where: { active: true, id: planId, priceMonthCents: { gt: 0 } },
    }),
    prisma.egg.findFirst({ where: { enabled: true, id: eggId } }),
  ]);
  if (!plan?.priceMonthCents || !egg) {
    return { error: "That plan or game is no longer available", ok: false };
  }
  const ports = Math.max(
    1,
    Array.isArray(egg.containerPorts) ? egg.containerPorts.length : 0
  );
  if (
    plan.memory < egg.minMemory ||
    plan.disk < egg.minDisk ||
    plan.allocationLimit < ports
  ) {
    return { error: `${egg.name} needs a bigger plan`, ok: false };
  }
  const location = plan.locationId ?? locationId;
  if (
    location &&
    !(await prisma.location.findUnique({ where: { id: location } }))
  ) {
    return { error: "That location is no longer available", ok: false };
  }

  const open = await prisma.subscription.count({
    where: { status: "pending", userId: user.id },
  });
  if (open >= MAX_OPEN_CHECKOUTS) {
    return {
      error: "You have too many unfinished checkouts. Try again tomorrow.",
      ok: false,
    };
  }

  try {
    const url = await startCheckout({
      currency: settings.currency,
      order: {
        eggId: egg.id,
        locationId: location,
        name:
          egg.name.length >= 3
            ? egg.name.slice(0, 40)
            : `${egg.name} server`.slice(0, 40),
      },
      panelName: settings.panelName,
      plan: {
        id: plan.id,
        name: plan.name,
        paypalPlanId: plan.paypalPlanId,
        priceMonthCents: plan.priceMonthCents,
      },
      provider,
      user: { email: user.email, id: user.id, name: user.name ?? null },
    });
    return { ok: true, url };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Could not start checkout: ${error.message}`
          : "Could not start checkout",
      ok: false,
    };
  }
};
