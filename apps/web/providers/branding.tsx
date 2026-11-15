"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { Branding } from "@/lib/settings";

const BrandingContext = createContext<Branding>({
  bytepayLogin: false,
  logoUrl: null,
  panelName: "BytePanel",
  signUpEnabled: true,
  supportUrl: null,
  websiteUrl: null,
});

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
