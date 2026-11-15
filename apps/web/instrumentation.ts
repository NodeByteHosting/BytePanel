import { init } from "@sentry/nextjs";

import { env } from "@/lib/env";

const opts = {
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
};

export const register = async () => {
  init(opts);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBillingSweep } = await import("@/lib/billing/sweep");
    startBillingSweep();
  }
};
