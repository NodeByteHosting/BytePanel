import { init, replayIntegration } from "@sentry/nextjs";

import { env } from "@/lib/env";

export const initializeSentry = (): ReturnType<typeof init> =>
  init({
    debug: false,

    dsn: env.NEXT_PUBLIC_SENTRY_DSN,

    integrations: [
      replayIntegration({
        blockAllMedia: true,
        maskAllText: true,
      }),
    ],

    replaysOnErrorSampleRate: 1,

    replaysSessionSampleRate: 0.1,

    tracesSampleRate: 1,
  });
