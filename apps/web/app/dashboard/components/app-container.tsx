"use client";

import type { ReactNode } from "react";

import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppContainerProps {
  children: ReactNode;
}

export const AppContainer = ({ children }: AppContainerProps) => (
  <SidebarInset
    className={cn(
      "bg-background flex h-svh flex-col overflow-hidden transition-all md:h-[calc(100svh-1rem)]"
    )}
  >
    {children}
  </SidebarInset>
);
