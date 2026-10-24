"use client";

import React from "react";

import { cn } from "@/lib/utils";

interface ResponsiveTypographyProps<
  T extends HTMLElement,
> extends React.HTMLAttributes<T> {
  ref?: React.Ref<T>;
  variant?: "h1" | "h2" | "h3" | "h4" | "body" | "caption";
}

const variantStyles = {
  body: "text-sm sm:text-base leading-relaxed",
  caption: "text-xs sm:text-sm text-muted-foreground",
  h1: "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
  h2: "text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight",
  h3: "text-lg sm:text-xl lg:text-2xl font-semibold tracking-tight",
  h4: "text-base sm:text-lg lg:text-xl font-semibold",
};

export const ResponsiveHeading = ({
  className,
  variant = "h2",
  level = 2,
  ...props
}: ResponsiveTypographyProps<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
}) => {
  const Component = `h${level}` as const;
  return (
    <Component className={cn(variantStyles[variant], className)} {...props} />
  );
};

ResponsiveHeading.displayName = "ResponsiveHeading";

export const ResponsiveText = ({
  className,
  variant = "body",
  ...props
}: ResponsiveTypographyProps<HTMLParagraphElement>) => (
  <p className={cn(variantStyles[variant], className)} {...props} />
);

ResponsiveText.displayName = "ResponsiveText";

interface ResponsiveContainerProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg" | "full";
}

export const ResponsiveContainer = ({
  className,
  size = "lg",
  ...props
}: ResponsiveContainerProps) => {
  const sizeStyles = {
    full: "w-full",
    lg: "max-w-6xl",
    md: "max-w-4xl",
    sm: "max-w-2xl",
  };

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
};

ResponsiveContainer.displayName = "ResponsiveContainer";
