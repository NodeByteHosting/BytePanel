import "./styles.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SEO_URL } from "@/lib/env";
import { JsonLd } from "@/lib/seo/json-ld";
import { createMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/providers/theme";

const homeDescription =
  "NodeByte GSM — manage your game servers, monitor performance, and invite team members from one place.";

export const metadata = createMetadata({
  bareTitle: true,
  description: homeDescription,
  title: "NodeByte - Game Server Manager",
});

const organizationJsonLd: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  description: homeDescription,
  name: "NodeByte Hosting",
  url: SEO_URL,
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html
    lang="en"
    className={cn(
      GeistSans.variable,
      GeistMono.variable,
      "touch-manipulation font-sans antialiased"
    )}
    suppressHydrationWarning
  >
    <body className="bg-background">
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-center" />
      </ThemeProvider>
      <JsonLd code={organizationJsonLd} />
      <Analytics />
      <SpeedInsights />
    </body>
  </html>
);

export default RootLayout;
