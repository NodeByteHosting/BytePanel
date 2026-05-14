"use client";

import type { ReactNode } from "react";

import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export const AdminContainer = ({ children }: { children: ReactNode }) => {
  const sidebar = useSidebar();

  return (
    <SidebarInset
      className={cn(
        "h-svh overflow-hidden bg-background transition-all",
        sidebar.open && "border-l border-border/50"
      )}
    >
      {children}
    </SidebarInset>
  );
};
