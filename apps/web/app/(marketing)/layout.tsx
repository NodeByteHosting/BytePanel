import Link from "next/link";
import type { ReactNode } from "react";

import { FloatingNav } from "@/app/components/floating-nav";
import { getSession } from "@/lib/session";

const MarketingLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="flex min-h-dvh flex-col pb-32">
      <main className="flex-1">{children}</main>

      <footer className="border-border/50 border-t">
        <p className="text-muted-foreground mx-auto w-full max-w-6xl px-6 py-10 text-center text-sm">
          {/* oxlint-disable-next-line react/purity */}
          &copy; {new Date().getFullYear()}{" "}
          <Link
            href="https://nodebyte.co.uk"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            NodeByte LTD
          </Link>
          . All rights reserved.
        </p>
      </footer>

      <FloatingNav isAuthenticated={isAuthenticated} />
    </div>
  );
};

export default MarketingLayout;
