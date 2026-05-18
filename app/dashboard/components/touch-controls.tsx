"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

/**
 * TouchButton - A button optimized for mobile touch with proper sizing
 * Ensures minimum 44px height on mobile for comfortable touch targets
 */
export const TouchButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { compact?: boolean }
>(({ className, compact = false, ...props }, ref) => (
  <Button
    ref={ref}
    className={cn(
      "transition-all active:scale-95",
      !compact && "min-h-11 sm:min-h-10",
      compact && "min-h-10 sm:min-h-9",
      className
    )}
    {...props}
  />
));

TouchButton.displayName = "TouchButton";

/**
 * TouchIconButton - Icon button with proper mobile touch sizing
 */
export const TouchIconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size: _size, ...props }, ref) => (
    <Button
      ref={ref}
      size="icon"
      className={cn("h-11 w-11 sm:h-10 sm:w-10", className)}
      {...props}
    />
  )
);

TouchIconButton.displayName = "TouchIconButton";

/**
 * ResponsiveButtonGroup - Button group that stacks on mobile, rows on desktop
 */
export const ResponsiveButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    direction?: "vertical" | "horizontal";
  }
>(({ className: _className, direction = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex gap-2",
      direction === "vertical" ? "flex-col" : "sm:flex-row"
    )}
    {...props}
  />
));

ResponsiveButtonGroup.displayName = "ResponsiveButtonGroup";
