"use client";

import type { ReactNode } from "react";

import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppContainerProps {
  children: ReactNode;
}

export const AppContainer = ({ children }: AppContainerProps) => {
  const sidebar = useSidebar();

  return (
    <SidebarInset
      className={cn(
        "bg-background flex h-svh flex-col overflow-hidden transition-all",
        sidebar.open && "border-border/50 border-l"
      )}
    >
      {children}
    </SidebarInset>
  );
};
