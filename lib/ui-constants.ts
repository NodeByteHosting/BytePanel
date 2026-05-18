/**
 * Shared UI constants for status styling and configuration
 * Used across admin panel, dashboard, and other components
 */

export const SERVER_STATE_CONFIG = {
  failed: {
    bgColor: "bg-destructive/10 border-destructive/20",
    color: "text-destructive",
    dot: "bg-destructive",
    label: "Failed",
  },
  lost: {
    bgColor: "bg-destructive/10 border-destructive/20",
    color: "text-destructive",
    dot: "bg-destructive",
    label: "Lost",
  },
  provisioning: {
    bgColor: "bg-blue-500/10 border-blue-200 dark:border-blue-900",
    color: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    label: "Provisioning",
  },
  running: {
    bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-900",
    color: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Running",
  },
  stopped: {
    bgColor: "bg-muted border-border/50",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
    label: "Stopped",
  },
  unhealthy: {
    bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-900",
    color: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Unhealthy",
  },
  unknown: {
    bgColor: "bg-muted border-border/50",
    color: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
    label: "Unknown",
  },
} as const;

export const SUBSCRIPTION_STATUS_CONFIG = {
  active: {
    bgColor: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-900",
    color: "text-emerald-600 dark:text-emerald-400",
    label: "Active",
  },
  cancelled: {
    bgColor: "bg-destructive/10 border-destructive/20",
    color: "text-destructive",
    label: "Cancelled",
  },
  past_due: {
    bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-900",
    color: "text-amber-600 dark:text-amber-400",
    label: "Past Due",
  },
} as const;

export type ServerState = keyof typeof SERVER_STATE_CONFIG;
export type SubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS_CONFIG;
