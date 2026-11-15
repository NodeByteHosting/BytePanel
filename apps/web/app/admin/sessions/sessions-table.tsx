"use client";

import {
  AppleIcon,
  ChevronLeft,
  ChevronRight,
  GlobeIcon,
  LaptopIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminSession {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  user: { name: string | null; email: string };
}

interface PagedResponse {
  sessions: AdminSession[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const getDeviceInfo = (
  ua: string | null
): { label: string; icon: React.ElementType; os: string } => {
  if (!ua) {
    return { icon: GlobeIcon, label: "Unknown", os: "Unknown" };
  }
  if (/iPhone/iu.test(ua)) {
    return { icon: SmartphoneIcon, label: "iPhone", os: "iOS" };
  }
  if (/iPad/iu.test(ua)) {
    return { icon: AppleIcon, label: "iPad", os: "iPadOS" };
  }
  if (/Android/iu.test(ua)) {
    return { icon: SmartphoneIcon, label: "Android", os: "Android" };
  }
  if (/Mac/iu.test(ua)) {
    return { icon: LaptopIcon, label: "Mac", os: "macOS" };
  }
  if (/Windows/iu.test(ua)) {
    return { icon: LaptopIcon, label: "Windows PC", os: "Windows" };
  }
  if (/Linux/iu.test(ua)) {
    return { icon: LaptopIcon, label: "Linux", os: "Linux" };
  }
  return { icon: GlobeIcon, label: "Browser", os: "Unknown" };
};

const getBrowserName = (ua: string | null): string => {
  if (!ua) {
    return "";
  }
  if (/Edg\//iu.test(ua)) {
    return "Edge";
  }
  if (/OPR\//iu.test(ua) || /Opera/iu.test(ua)) {
    return "Opera";
  }
  if (/Firefox/iu.test(ua)) {
    return "Firefox";
  }
  if (/Chrome/iu.test(ua)) {
    return "Chrome";
  }
  if (/Safari/iu.test(ua)) {
    return "Safari";
  }
  return "";
};

const getExpiryClass = (expired: boolean, expiresInDays: number) => {
  if (expired) {
    return "text-destructive";
  }
  if (expiresInDays <= 1) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-emerald-600 dark:text-emerald-400";
};

const getExpiryLabel = (expired: boolean, expiresInDays: number) => {
  if (expired) {
    return "expired";
  }
  if (expiresInDays > 0) {
    return `expires in ${expiresInDays}d`;
  }
  return "expires today";
};

export const SessionsTable = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      const res = await fetch(`/api/admin/sessions?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      setData(await res.json());
      setFetchedAt(Date.now());
    } catch {
      toast.error("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (session: AdminSession) => {
    setRevoking(session.id);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed");
      }
      toast.success(`Session for ${session.user.email} revoked.`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.filter((s) => s.id !== session.id),
              total: prev.total - 1,
            }
          : prev
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {data && (
          <p className="text-muted-foreground text-sm">
            {data.total} active session{data.total === 1 ? "" : "s"}
          </p>
        )}
        <Button
          className="ml-auto gap-1.5"
          disabled={loading}
          size="sm"
          variant="outline"
          onClick={() => fetchSessions()}
        >
          <RefreshCwIcon
            className={cn("size-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
        {(loading || !data) && (
          <div className="text-muted-foreground py-12 text-center text-sm">
            Loading…
          </div>
        )}
        {!loading && data && data.sessions.length === 0 && (
          <div className="text-muted-foreground py-12 text-center text-sm">
            No active sessions.
          </div>
        )}
        {!loading && data && data.sessions.length > 0 && (
          <div className="divide-border/50 divide-y">
            {data.sessions.map((session) => {
              const expiresIn =
                new Date(session.expiresAt).getTime() - fetchedAt;
              const expiresInDays = Math.round(expiresIn / 86_400_000);
              const expired = expiresIn <= 0;
              const device = getDeviceInfo(session.userAgent);
              const browser = getBrowserName(session.userAgent);
              const DeviceIcon = device.icon;
              const createdDate = new Date(
                session.createdAt
              ).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div
                  key={session.id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="border-border/50 bg-muted/50 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                      <DeviceIcon className="text-muted-foreground size-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm leading-snug font-medium">
                          {session.user.name ?? session.user.email}
                        </span>
                        {session.user.name && (
                          <span className="text-muted-foreground text-xs">
                            {session.user.email}
                          </span>
                        )}
                      </div>

                      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="flex items-center gap-1">
                          <DeviceIcon className="size-3 shrink-0" />
                          {device.os}
                          {browser ? ` · ${browser}` : ""}
                        </span>
                        {session.ipAddress && (
                          <span className="font-mono">{session.ipAddress}</span>
                        )}
                        <span>Started {createdDate}</span>
                        <span
                          className={cn(getExpiryClass(expired, expiresInDays))}
                        >
                          {getExpiryLabel(expired, expiresInDays)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full shrink-0 gap-1.5 sm:w-auto"
                    disabled={revoking === session.id}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(session)}
                  >
                    <Trash2Icon className="size-3.5" />
                    {revoking === session.id ? "Revoking…" : "Revoke"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Previous page"
              className="size-8 min-h-11 min-w-11"
              disabled={page <= 1}
              size="icon"
              variant="ghost"
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2">
              {page} / {data.totalPages}
            </span>
            <Button
              aria-label="Next page"
              className="size-8 min-h-11 min-w-11"
              disabled={page >= data.totalPages}
              size="icon"
              variant="ghost"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
