import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  children?: ReactNode;
}

export const PageHeader = ({
  title,
  icon,
  meta,
  actions,
  flush,
  children,
}: PageHeaderProps) => (
  <header
    className={cn(
      "sticky top-0 z-10 flex shrink-0 flex-col gap-0 border-b border-border/60 bg-background/80 backdrop-blur-md",
      flush && "border-b-0"
    )}
  >
    <div className="flex items-center gap-3 px-4 py-3 md:px-6">
      <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors" />
      <Separator orientation="vertical" className="h-5 opacity-40" />
      {icon ? (
        <div className="shrink-0 text-muted-foreground">{icon}</div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <h1 className="truncate text-base font-semibold text-foreground tracking-tight sm:text-lg">
          {title}
        </h1>
        {meta ? (
          <div className="flex items-center gap-2 shrink-0">{meta}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
    {children && (
      <div className={cn("px-4 md:px-6", !flush && "pb-3")}>{children}</div>
    )}
  </header>
);

export const PageBody = ({
  children,
  className,
  wide,
  constrained,
  flush,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
  constrained?: boolean;
  flush?: boolean;
}) => (
  <div
    className={cn(
      "min-h-0 flex-1",
      flush ? "flex flex-col overflow-hidden" : "overflow-y-auto",
      !flush && "px-4 py-5 md:px-6 md:py-7",
      className
    )}
  >
    {constrained && !wide ? (
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    ) : (
      children
    )}
  </div>
);
