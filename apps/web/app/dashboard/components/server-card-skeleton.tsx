"use client";

import { Skeleton } from "@/components/ui/skeleton";

export const ServerCardSkeleton = () => (
  <div className="border-border/60 bg-card space-y-4 rounded-xl border p-4">
    {/* Header section */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Skeleton className="h-12 w-12 flex-shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-8 w-8 flex-shrink-0 rounded" />
    </div>

    {/* Content section */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>

    {/* Footer section */}
    <div className="border-border flex items-center justify-between gap-2 border-t pt-2">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  </div>
);

export const ServerCardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <ServerCardSkeleton key={i} />
    ))}
  </div>
);
