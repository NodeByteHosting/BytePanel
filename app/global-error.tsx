"use client";

import { captureException } from "@sentry/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type NextError from "next/error";
import Link from "next/link";
import { useEffect } from "react";

import { AnimatedLogo } from "@/components/animated-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/providers/theme";

import "./styles.css";

interface GlobalErrorProperties {
  readonly error: NextError & { digest?: string };
  readonly reset: () => void;
}

const GlobalError = ({ error, reset }: GlobalErrorProperties) => {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        "touch-manipulation font-sans antialiased"
      )}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground">
        <ThemeProvider>
          <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-start justify-center gap-8 px-6 py-24">
            <AnimatedLogo className="size-20" />
            <h1 className="max-w-[20ch] text-5xl font-medium tracking-tight text-balance sm:text-6xl">
              Something went wrong.
            </h1>
            <p className="text-muted-foreground max-w-[60ch] text-lg text-balance">
              An unexpected error has occurred and our team has been notified.
              You can try again, or head back home and pretend this never
              happened.
            </p>
            <div className="flex flex-row items-center gap-3">
              <Button onClick={() => reset()} size="lg">
                Try again
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/">Go home</Link>
              </Button>
            </div>
            {error.digest ? (
              <dl className="border-foreground/10 mt-4 flex flex-col gap-2 border-t pt-6">
                <dt className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
                  Reference
                </dt>
                <dd className="font-mono text-sm tabular-nums">
                  Error 500 / {error.digest}
                </dd>
              </dl>
            ) : null}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default GlobalError;
