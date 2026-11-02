import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { env } from "@/lib/env";

const otelRegex = /@opentelemetry\/instrumentation/u;

// Build-time version info, inlined for lib/version.ts.
const readCommit = () => {
  if (env.VERCEL_GIT_COMMIT_SHA) {
    return env.VERCEL_GIT_COMMIT_SHA;
  }
  try {
    return execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
};
const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as {
  version: string;
};

const baseConfig: NextConfig = {
  env: {
    NODEBYTE_COMMIT_SHA: readCommit(),
    NODEBYTE_PANEL_VERSION: version,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        hostname: "shared.fastly.steamstatic.com",
        pathname: "/store_item_assets/steam/apps/**",
        protocol: "https",
      },
    ],
  },

  rewrites() {
    return Promise.resolve([
      {
        destination: "https://us-assets.i.posthog.com/static/:path*",
        source: "/ingest/static/:path*",
      },
      {
        destination: "https://us.i.posthog.com/:path*",
        source: "/ingest/:path*",
      },
      {
        destination: "https://us.i.posthog.com/decide",
        source: "/ingest/decide",
      },
    ]);
  },

  webpack(cfg) {
    cfg.ignoreWarnings = [{ module: otelRegex }];
    return cfg;
  },
};

const withSentry = (config: NextConfig): NextConfig =>
  env.VERCEL
    ? withSentryConfig(
        { ...config, transpilePackages: ["@sentry/nextjs"] },
        {
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          silent: !env.CI,
          tunnelRoute: "/monitoring",
          webpack: {
            automaticVercelMonitors: true,
            treeshake: {
              removeDebugLogging: true,
            },
          },
          widenClientFileUpload: true,
        }
      )
    : config;

const withAnalyzer = (config: NextConfig): NextConfig =>
  env.ANALYZE === "true" ? withBundleAnalyzer()(config) : config;

export default withAnalyzer(withSentry(baseConfig));
