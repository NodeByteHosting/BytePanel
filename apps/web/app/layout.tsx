import "./styles.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Organization, WithContext } from "schema-dts";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SEO_URL } from "@/lib/env";
import { JsonLd } from "@/lib/seo/json-ld";
import { createMetadata } from "@/lib/seo/metadata";
import { getBranding } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { BrandingProvider } from "@/providers/branding";
import { ThemeProvider } from "@/providers/theme";

const homeDescription = (panelName: string) =>
  `${panelName} — manage your game servers, monitor performance, and invite team members from one place.`;

export const generateMetadata = async (): Promise<Metadata> => {
  const { panelName, logoUrl } = await getBranding();
  return createMetadata({
    bareTitle: true,
    description: homeDescription(panelName),
    // A custom logo replaces the built-in favicon too.
    ...(logoUrl && { icons: { apple: logoUrl, icon: logoUrl } }),
    siteName: panelName,
    title: `${panelName} - Game Server Manager`,
  });
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const branding = await getBranding();
  const organizationJsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    description: homeDescription(branding.panelName),
    name: branding.panelName,
    url: branding.websiteUrl ?? SEO_URL,
  };

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
      <body className="bg-background">
        <BrandingProvider branding={branding}>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="bottom-center" />
          </ThemeProvider>
        </BrandingProvider>
        <JsonLd code={organizationJsonLd} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
};

export default RootLayout;
