import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ModeToggle } from "@/components/mode-toggle";
import { createMetadata } from "@/lib/seo/metadata";
import { getSession } from "@/lib/session";
import { getBranding } from "@/lib/settings";

export const generateMetadata = async () => {
  const { panelName } = await getBranding();
  return createMetadata({
    description: `Sign in to ${panelName}.`,
    robots: { follow: false, index: false },
    siteName: panelName,
    title: "Sign in",
  });
};

const AuthLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }
  const { panelName } = await getBranding();

  return (
    <div className="relative grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="border-border/60 bg-card/40 relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="from-primary/15 via-background to-accent/10 absolute inset-0 bg-linear-to-br" />
        <div className="text-foreground/[0.03] absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative z-10 flex items-center gap-3">
          <BrandLogo className="text-foreground h-9 w-auto" />
          <span className="flex flex-col">
            <span className="text-xl leading-tight font-bold">{panelName}</span>
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Game Servers
            </span>
          </span>
        </div>
        <div className="relative z-10 flex justify-center">
          <BrandLogo className="text-foreground h-24 w-auto opacity-90 drop-shadow-[0_0_60px_color-mix(in_oklch,var(--primary)_35%,transparent)]" />
        </div>
        <p className="text-muted-foreground relative z-10 max-w-sm text-sm">
          Consoles, files, backups and your team, all in one place for every
          server you run.
        </p>
      </aside>
      <main className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute top-6 right-6">
          <ModeToggle />
        </div>
        <div className="w-full max-w-md space-y-8">{children}</div>
      </main>
    </div>
  );
};

export default AuthLayout;
