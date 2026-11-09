"use client";

import { AnimatedLogo } from "@/components/animated-logo";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { useBranding } from "@/providers/branding";

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
