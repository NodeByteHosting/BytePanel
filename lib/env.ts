import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z
      .string()
      .min(1)
      .startsWith("G-")
      .optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).startsWith("phc_").optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).url().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
      .string()
      .min(1)
      .startsWith("pk_")
      .optional(),
  },
  extends: [vercel()],
  runtimeEnv: {
    ANALYZE: process.env.ANALYZE,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    HETZNER_API_TOKEN: process.env.HETZNER_API_TOKEN,
    HETZNER_SNAPSHOT_IMAGE_ID: process.env.HETZNER_SNAPSHOT_IMAGE_ID,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    NODEBYTE_PUBLIC_URL: process.env.NODEBYTE_PUBLIC_URL,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    VERCEL_AUTOMATION_BYPASS_SECRET:
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  },
  server: {
    ANALYZE: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),

    BETTER_AUTH_URL: z.string().min(1).url(),
    BLOB_READ_WRITE_TOKEN: z
      .string()
      .min(1)
      .startsWith("vercel_blob_rw_")
      .optional(),

    DATABASE_URL: z.string().min(1).url().optional(),
    DATABASE_URL_UNPOOLED: z.string().min(1).url().optional(),

    // Hetzner credentials for lib/providers. Not used by the node model, so it
    // may be left unset.
    HETZNER_API_TOKEN: z.string().default(""),
    // Pre-built golden image ID; if unset the platform auto-manages a snapshot
    HETZNER_SNAPSHOT_IMAGE_ID: z.string().min(1).optional(),

    KV_REST_API_TOKEN: z.string().min(1).optional(),

    KV_REST_API_URL: z.string().min(1).url().optional(),

    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
    // Overrides the computed API_URL for local dev bakes — set this to a
    // publicly reachable URL (e.g. ngrok/Cloudflare Tunnel) so the builder VM
    // on Hetzner can download the agent binary. Not needed on Vercel.
    NODEBYTE_PUBLIC_URL: z.string().min(1).url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),

    SENTRY_PROJECT: z.string().min(1).optional(),
    // SMTP — all optional; when unset, email sending is silently skipped
    SMTP_FROM: z.string().email().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_USER: z.string().min(1).optional(),

    STRIPE_SECRET_KEY: z.string().min(1).startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).startsWith("whsec_").optional(),
    VERCEL_AUTOMATION_BYPASS_SECRET: z.string().min(1).optional(),
  },
});

const LOCAL_URL = "http://localhost:3000";

const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  : null;
const branchUrl = env.VERCEL_BRANCH_URL
  ? `https://${env.VERCEL_BRANCH_URL}`
  : null;

// Always points at the production deployment. Used for canonical SEO surfaces
// (sitemap, robots, metadataBase, Schema.org url) so previews don't leak their
// .vercel.app hostname into search indexes.
export const SEO_URL = productionUrl ?? LOCAL_URL;

// Points at the current deployment; node daemons call back to this URL
// (/api/remote/*) and it is written into each node's daemon.json. Production deployments use the project's prod
// URL; previews use the branch-stable URL (so callbacks survive redeploys of
// the same branch); dev falls back to localhost.
//
// NODEBYTE_PUBLIC_URL overrides everything — required in local dev when the
// nodes cannot reach localhost:3000 (use a tunnel URL).
export const API_URL =
  env.NODEBYTE_PUBLIC_URL ??
  (env.VERCEL_ENV === "production"
    ? (productionUrl ?? LOCAL_URL)
    : (branchUrl ?? LOCAL_URL));
