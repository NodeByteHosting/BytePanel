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
  <>
    <header className="border-border/60 bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1 shrink-0 transition-colors" />
      <Separator className="mr-2 h-4!" orientation="vertical" />
    </header>
    <div
      className={cn(
        "flex shrink-0 flex-col gap-4 px-4 pt-6 md:px-6",
        !flush && "pb-1"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {icon ? (
            <div className="text-muted-foreground shrink-0">{icon}</div>
          ) : null}
          <h1 className="text-foreground truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {meta ? (
            <div className="flex shrink-0 items-center gap-2">{meta}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  </>
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
