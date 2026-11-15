import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).url().optional(),
  },
  runtimeEnv: {
    ANALYZE: process.env.ANALYZE,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BYTEPANEL_DEBUG: process.env.BYTEPANEL_DEBUG,
    BYTEPANEL_PUBLIC_URL: process.env.BYTEPANEL_PUBLIC_URL,
    BYTEPAY_API_URL: process.env.BYTEPAY_API_URL,
    BYTEPAY_CLIENT_ID: process.env.BYTEPAY_CLIENT_ID,
    BYTEPAY_CLIENT_SECRET: process.env.BYTEPAY_CLIENT_SECRET,
    BYTEPAY_URL: process.env.BYTEPAY_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_SANDBOX: process.env.PAYPAL_SANDBOX,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    REDIS_URL: process.env.REDIS_URL,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    UPDATE_CHECK_AGENT_REPO: process.env.UPDATE_CHECK_AGENT_REPO,
    UPDATE_CHECK_PANEL_REPO: process.env.UPDATE_CHECK_PANEL_REPO,
  },
  server: {
    ANALYZE: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().min(1).url(),
    BYTEPANEL_DEBUG: z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((v) => v === "true" || v === "1"),
    BYTEPANEL_PUBLIC_URL: z.string().min(1).url().optional(),
    BYTEPAY_API_URL: z.string().min(1).url().optional(),
    BYTEPAY_CLIENT_ID: z.string().min(1).optional(),
    BYTEPAY_CLIENT_SECRET: z.string().min(1).optional(),
    BYTEPAY_URL: z.string().min(1).url().optional(),
    DATABASE_URL: z.string().min(1).url().optional(),
    DATABASE_URL_UNPOOLED: z.string().min(1).url().optional(),
    GITHUB_TOKEN: z.string().min(1).optional(),
    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
    PAYPAL_CLIENT_ID: z.string().min(1).optional(),
    PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
    PAYPAL_SANDBOX: z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((v) => v === "true" || v === "1"),
    PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).url().default("redis://localhost:6379"),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().min(1).url().optional(),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_USER: z.string().min(1).optional(),
    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    UPDATE_CHECK_AGENT_REPO: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/u)
      .default("NodeByteHosting/GSM"),
    UPDATE_CHECK_PANEL_REPO: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/u)
      .default("NodeByteHosting/GSM"),
  },
});

export const API_URL = (
  env.BYTEPANEL_PUBLIC_URL ?? env.BETTER_AUTH_URL
).replace(/\/+$/u, "");

export const SEO_URL = API_URL;

export const bytepayEnabled = Boolean(
  env.BYTEPAY_URL &&
  env.BYTEPAY_API_URL &&
  env.BYTEPAY_CLIENT_ID &&
  env.BYTEPAY_CLIENT_SECRET
);

export const stripeEnabled = Boolean(
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
);

export const paypalEnabled = Boolean(
  env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID
);
