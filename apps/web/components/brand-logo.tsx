"use client";

import { AnimatedLogo } from "@/components/animated-logo";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { useBranding } from "@/providers/branding";

// The provider's uploaded logo, or the built-in mark when none is set.
export const BrandLogo = ({
  animated,
  className,
}: {
  animated?: boolean;
  className?: string;
}) => {
  const { logoUrl, panelName } = useBranding();
  if (logoUrl) {
    return (
      // Arbitrary admin-supplied URL, so next/image remotePatterns can't cover it.
      // oxlint-disable-next-line nextjs/no-img-element
      <img
        alt={panelName}
        className={cn("object-contain", className)}
        src={logoUrl}
      />
    );
  }
  return animated ? (
    <AnimatedLogo className={className} />
  ) : (
    <Logo className={className} />
  );
};
