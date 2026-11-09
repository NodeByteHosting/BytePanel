"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * TouchButton - A button optimized for mobile touch with proper sizing
 * Ensures minimum 44px height on mobile for comfortable touch targets
 */
export const TouchButton = ({
  className,
  compact = false,
  ...props
}: ButtonProps & { compact?: boolean }) => (
  <Button
    className={cn(
      "transition-all active:scale-95",
      !compact && "min-h-11 sm:min-h-10",
      compact && "min-h-10 sm:min-h-9",
      className
    )}
    {...props}
  />
);

TouchButton.displayName = "TouchButton";

/**
 * TouchIconButton - Icon button with proper mobile touch sizing
 */
export const TouchIconButton = ({
  className,
  size: _size,
  ...props
}: ButtonProps) => (
  <Button
    size="icon"
    className={cn("h-11 w-11 sm:h-10 sm:w-10", className)}
    {...props}
  />
);

TouchIconButton.displayName = "TouchIconButton";

/**
 * ResponsiveButtonGroup - Button group that stacks on mobile, rows on desktop
 */
export const ResponsiveButtonGroup = ({
  className: _className,
  direction = "horizontal",
  ...props
}: React.ComponentProps<"div"> & {
  direction?: "vertical" | "horizontal";
}) => (
  <div
    className={cn(
      "flex gap-2",
      direction === "vertical" ? "flex-col" : "sm:flex-row"
    )}
    {...props}
  />
);

ResponsiveButtonGroup.displayName = "ResponsiveButtonGroup";
