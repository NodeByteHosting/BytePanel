"use client";

import { Menu, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

export const MobileDrawer = ({
  open: controlledOpen,
  onOpenChange,
  trigger: _trigger,
  children,
  className,
  ref,
}: MobileDrawerProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleOpenChange(!open)}
        className="lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => handleOpenChange(false)}
          role="presentation"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              handleOpenChange(false);
            }
          }}
        />
      )}

      {/* Drawer */}
      <div
        ref={ref}
        className={cn(
          "bg-background border-border fixed top-0 left-0 z-50 h-screen w-64 transform overflow-y-auto border-r transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:border-r",
          open ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        {children}
      </div>
    </>
  );
};

MobileDrawer.displayName = "MobileDrawer";
