import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";

const schema = z.object({
  stripeCustomerId: z.string().min(1),
});

export const POST = async (req: Request) => {
  await requireUser();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/account/billing`;

  const session = await stripe.billingPortal.sessions.create({
    customer: parsed.data.stripeCustomerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
};
