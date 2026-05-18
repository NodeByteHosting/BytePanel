"use client";

import {
  Power,
  PowerOff,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  Users,
  Activity,
} from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ActivityType =
  | "server_started"
  | "server_stopped"
  | "server_failed"
  | "server_created"
  | "server_deleted"
  | "server_updated"
  | "server_health_changed"
  | "user_joined"
  | "user_left";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date;
  icon?: React.ReactNode;
  status?: "success" | "warning" | "error" | "info";
  user?: {
    name: string;
    avatar?: string;
  };
}

interface ActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
  className?: string;
}

const activityConfig: Record<
  ActivityType,
  {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }
> = {
  server_created: {
    bgColor: "bg-blue-500/10",
    color: "text-blue-600 dark:text-blue-400",
    icon: <Plus className="h-4 w-4" />,
  },
  server_deleted: {
    bgColor: "bg-red-500/10",
    color: "text-red-600 dark:text-red-400",
    icon: <Trash2 className="h-4 w-4" />,
  },
  server_failed: {
    bgColor: "bg-destructive/10",
    color: "text-destructive",
    icon: <AlertCircle className="h-4 w-4" />,
  },
  server_health_changed: {
    bgColor: "bg-orange-500/10",
    color: "text-orange-600 dark:text-orange-400",
    icon: <Activity className="h-4 w-4" />,
  },
  server_started: {
    bgColor: "bg-emerald-500/10",
    color: "text-emerald-600 dark:text-emerald-400",
    icon: <Power className="h-4 w-4" />,
  },
  server_stopped: {
    bgColor: "bg-amber-500/10",
    color: "text-amber-600 dark:text-amber-400",
    icon: <PowerOff className="h-4 w-4" />,
  },
  server_updated: {
    bgColor: "bg-purple-500/10",
    color: "text-purple-600 dark:text-purple-400",
    icon: <Edit className="h-4 w-4" />,
  },
  user_joined: {
    bgColor: "bg-green-500/10",
    color: "text-green-600 dark:text-green-400",
    icon: <Users className="h-4 w-4" />,
  },
  user_left: {
    bgColor: "bg-gray-500/10",
    color: "text-gray-600 dark:text-gray-400",
    icon: <Users className="h-4 w-4" />,
  },
};

const timeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  if (seconds < 604_800) {
    return `${Math.floor(seconds / 86_400)}d ago`;
  }

  return date.toLocaleDateString();
};

export const ActivityFeed = ({
  items,
  maxItems = 10,
  className,
}: ActivityFeedProps) => {
  const displayItems = items.slice(0, maxItems);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest changes and events in your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity yet
            </p>
          ) : (
            displayItems.map((item) => {
              const config = activityConfig[item.type];
              const icon = item.icon || config.icon;

              return (
                <div
                  key={item.id}
                  className="flex gap-3 pb-4 border-b border-border/50 last:border-0 last:pb-0"
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-lg p-2 flex-shrink-0",
                      config.bgColor
                    )}
                  >
                    <div className={config.color}>{icon}</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {item.status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs flex-shrink-0",
                            item.status === "success" &&
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                            item.status === "warning" &&
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                            item.status === "error" &&
                              "bg-destructive/10 text-destructive border-destructive/20"
                          )}
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(item.timestamp)}
                      </p>

                      {item.user && (
                        <p className="text-xs text-muted-foreground">
                          by{" "}
                          <span className="font-medium">{item.user.name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > maxItems && (
          <div className="mt-4 text-center">
            <button className="text-sm text-primary hover:underline">
              View all activity ({items.length})
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ActivityFeedItemProps {
  type: ActivityType;
  title: string;
  timestamp: Date;
  onClick?: () => void;
  className?: string;
}

export const ActivityFeedItem = ({
  type,
  title,
  timestamp,
  onClick,
  className,
}: ActivityFeedItemProps) => {
  const config = activityConfig[type];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className={cn("flex-shrink-0 p-2 rounded-lg", config.bgColor)}>
        <div className={config.color}>{config.icon}</div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(timestamp)}</p>
      </div>
    </button>
  );
};
