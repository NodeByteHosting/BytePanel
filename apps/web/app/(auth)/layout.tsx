import { redirect } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <main className="bg-background relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Background gradient */}
      <div className="from-primary/5 via-background to-background absolute inset-0 bg-linear-to-b" />
      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="bg-primary/10 absolute top-1/4 left-1/4 h-125 w-125 animate-pulse rounded-full blur-[120px]" />
        <div
          className="bg-accent/10 absolute right-1/4 bottom-1/4 h-100 w-100 animate-pulse rounded-full blur-[100px]"
          style={{ animationDelay: "1s" }}
        />
      </div>
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] mask-[radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)] bg-size-[64px_64px]" />
      <div className="relative z-10 w-full max-w-sm space-y-6">{children}</div>
    </main>
  );
};

export default AuthLayout;
