import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createMetadata } from "@/lib/seo/metadata";
import { getSession } from "@/lib/session";

export const metadata = createMetadata({
  description: "Sign in to NodeByte Panel.",
  robots: { follow: false, index: false },
  title: "Sign in",
});

const AuthLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-background to-background" />
      {/* Animated orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-125 w-125 animate-pulse rounded-full bg-primary/10 blur-[120px]" />
        <div
          className="absolute bottom-1/4 right-1/4 h-100 w-100 animate-pulse rounded-full bg-accent/10 blur-[100px]"
          style={{ animationDelay: "1s" }}
        />
      </div>
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
      <div className="relative z-10 w-full max-w-sm space-y-6">{children}</div>
    </main>
  );
};

export default AuthLayout;
