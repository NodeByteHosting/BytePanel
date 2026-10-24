import Link from "next/link";

import { AnimatedLogo } from "@/components/animated-logo";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-start justify-center gap-8 px-6 py-24">
    <AnimatedLogo className="size-20" />
    <h1 className="max-w-[20ch] text-5xl font-medium tracking-tight text-balance sm:text-6xl">
      Page not found.
    </h1>
    <p className="text-muted-foreground max-w-[60ch] text-lg text-balance">
      The page you were looking for doesn&apos;t exist or has been moved. Head
      back home and try again.
    </p>
    <div className="flex flex-row items-center gap-3">
      <Button asChild size="lg">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
      <Button asChild size="lg" variant="ghost">
        <Link href="/">Go home</Link>
      </Button>
    </div>
    <dl className="border-foreground/10 mt-4 flex flex-col gap-2 border-t pt-6">
      <dt className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
        Status
      </dt>
      <dd className="font-mono text-sm tabular-nums">Error 404 / Not Found</dd>
    </dl>
  </main>
);

export default NotFound;
