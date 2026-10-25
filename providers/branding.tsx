"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { Branding } from "@/lib/settings";

const BrandingContext = createContext<Branding>({
  logoUrl: null,
  panelName: "NodeByte",
  supportUrl: null,
  websiteUrl: null,
});

// Set once in the root layout from /admin/settings.
export const BrandingProvider = ({
  branding,
  children,
}: {
  branding: Branding;
  children: ReactNode;
}) => (
  <BrandingContext.Provider value={branding}>
    {children}
  </BrandingContext.Provider>
);

export const useBranding = () => useContext(BrandingContext);
