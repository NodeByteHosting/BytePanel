"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

import { cn } from "@/lib/utils";

interface MobileBottomSheetProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Root
> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const MobileBottomSheet = ({
  open,
  onOpenChange,
  ...props
}: MobileBottomSheetProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isOpen = open ?? internalOpen;
  const handleOpenChange = (newOpen: boolean) => {
    setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      {...props}
    >
      {props.children}
    </DialogPrimitive.Root>
  );
};

MobileBottomSheet.displayName = "MobileBottomSheet";

export const MobileBottomSheetTrigger = DialogPrimitive.Trigger;

export const MobileBottomSheetClose = DialogPrimitive.Close;

export const MobileBottomSheetContent = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      className={cn(
        "border-border bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom fixed right-0 bottom-0 left-0 z-50 w-full rounded-t-2xl border p-6 shadow-lg",
        "max-h-[90vh] overflow-y-auto",
        "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-auto sm:w-full sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-lg",
        className
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
);

MobileBottomSheetContent.displayName = "MobileBottomSheetContent";

export const MobileBottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mb-4 flex items-center justify-between", className)}
    {...props}
  />
);

MobileBottomSheetHeader.displayName = "MobileBottomSheetHeader";

export const MobileBottomSheetTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={cn(
      "text-lg leading-none font-semibold tracking-tight",
      className
    )}
    {...props}
  />
);

MobileBottomSheetTitle.displayName = "MobileBottomSheetTitle";

export const MobileBottomSheetDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
);

MobileBottomSheetDescription.displayName = "MobileBottomSheetDescription";
