import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AdminSectionProps {
  children: ReactNode;
  className?: string;
}

export const AdminSection = ({ children, className }: AdminSectionProps) => (
  <div
    className={cn(
      "overflow-hidden rounded-xl border border-border/60 bg-card",
      className
    )}
  >
    {children}
  </div>
);

interface AdminSectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export const AdminSectionHeader = ({
  title,
  description,
  actions,
  className,
}: AdminSectionHeaderProps) => (
  <div
    className={cn(
      "flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4",
      className
    )}
  >
    <div>
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
);
