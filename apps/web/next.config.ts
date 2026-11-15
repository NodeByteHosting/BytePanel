import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { env } from "@/lib/env";

const otelRegex = /@opentelemetry\/instrumentation/u;

const readCommit = () => {
  if (process.env.BYTEPANEL_COMMIT_SHA) {
    return process.env.BYTEPANEL_COMMIT_SHA;
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

const WORKSPACE_PACKAGES = ["@bytepanel/games", "@bytepanel/protocol"];

const baseConfig: NextConfig = {
  allowedDevOrigins: env.BYTEPANEL_PUBLIC_URL
    ? [new URL(env.BYTEPANEL_PUBLIC_URL).hostname]
    : [],

  env: {
    BYTEPANEL_COMMIT_SHA: readCommit(),
    BYTEPANEL_PANEL_VERSION: version,
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

  outputFileTracingRoot: path.join(process.cwd(), "../.."),

  transpilePackages: WORKSPACE_PACKAGES,

  webpack(cfg) {
    cfg.ignoreWarnings = [{ module: otelRegex }];
    return cfg;
  },
};

const withSentry = (config: NextConfig): NextConfig =>
  env.SENTRY_ORG && env.SENTRY_PROJECT
    ? withSentryConfig(
        {
          ...config,
          transpilePackages: [...WORKSPACE_PACKAGES, "@sentry/nextjs"],
        },
        {
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          silent: !process.env.CI,
          tunnelRoute: "/monitoring",
          webpack: {
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
