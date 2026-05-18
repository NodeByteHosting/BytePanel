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

export const MobileBottomSheet = React.forwardRef<
  unknown,
  MobileBottomSheetProps
>(({ open, onOpenChange, ...props }, _ref) => {
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
});

MobileBottomSheet.displayName = "MobileBottomSheet";

export const MobileBottomSheetTrigger = DialogPrimitive.Trigger;

export const MobileBottomSheetClose = DialogPrimitive.Close;

export const MobileBottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-2xl border border-border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        "max-h-[90vh] overflow-y-auto",
        "sm:left-auto sm:right-auto sm:top-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:rounded-lg sm:w-full sm:max-w-2xl sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
        className
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
));

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

export const MobileBottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));

MobileBottomSheetTitle.displayName = "MobileBottomSheetTitle";

export const MobileBottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));

MobileBottomSheetDescription.displayName = "MobileBottomSheetDescription";
