import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";

const base = () =>
  env.PAYPAL_SANDBOX
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const TOKEN_KEY = "billing:paypal:token";

const accessToken = async () => {
  const cached = await redis.get(TOKEN_KEY);
  if (cached) {
    return cached;
  }
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal is not configured");
  }
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    body: "grant_type=client_credentials",
    headers: {
      authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`PayPal sign-in failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  await redis.set(
    TOKEN_KEY,
    body.access_token,
    "EX",
    Math.max(60, body.expires_in - 300)
  );
  return body.access_token;
};

export const paypal = async <T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> => {
  const res = await fetch(`${base()}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      accept: "application/json",
      authorization: `Bearer ${await accessToken()}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    method,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const message =
      typeof data.message === "string" ? data.message : "request failed";
    throw new Error(`PayPal: ${message} (HTTP ${res.status})`);
  }
  return data as T;
};

export interface PaypalSubscription {
  billing_info?: { next_billing_time?: string };
  custom_id?: string;
  id: string;
  links?: { href: string; rel: string }[];
  status: string;
}

export const paypalPlanFor = async (
  plan: { id: string; name: string; paypalPlanId: string | null },
  priceMonthCents: number,
  currency: string
) => {
  if (plan.paypalPlanId) {
    return plan.paypalPlanId;
  }
  const product = await paypal<{ id: string }>(
    "POST",
    "/v1/catalogs/products",
    {
      category: "SOFTWARE",
      name: plan.name.slice(0, 127),
      type: "SERVICE",
    }
  );
  const created = await paypal<{ id: string }>("POST", "/v1/billing/plans", {
    billing_cycles: [
      {
        frequency: { interval_count: 1, interval_unit: "MONTH" },
        pricing_scheme: {
          fixed_price: {
            currency_code: currency,
            value: (priceMonthCents / 100).toFixed(2),
          },
        },
        sequence: 1,
        tenure_type: "REGULAR",
        total_cycles: 0,
      },
    ],
    name: plan.name.slice(0, 127),
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
    product_id: product.id,
  });
  await prisma.plan.update({
    data: { paypalPlanId: created.id },
    where: { id: plan.id },
  });
  return created.id;
};

export const verifyPaypalWebhook = async (
  headers: Headers,
  event: unknown
): Promise<boolean> => {
  const header = (name: string) => headers.get(name) ?? "";
  const result = await paypal<{ verification_status: string }>(
    "POST",
    "/v1/notifications/verify-webhook-signature",
    {
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_event: event,
      webhook_id: env.PAYPAL_WEBHOOK_ID,
    }
  );
  return result.verification_status === "SUCCESS";
};
