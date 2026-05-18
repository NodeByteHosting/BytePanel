"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PagedResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const categoryStyle = (
  action: string
): { dot: string; text: string; bg: string } => {
  if (
    action.startsWith("admin.user.ban") ||
    action.startsWith("server.delete")
  ) {
    return {
      bg: "bg-red-500/10",
      dot: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
    };
  }
  if (action.startsWith("admin.")) {
    return {
      bg: "bg-violet-500/10",
      dot: "bg-violet-500",
      text: "text-violet-600 dark:text-violet-400",
    };
  }
  if (action.startsWith("billing.")) {
    return {
      bg: "bg-emerald-500/10",
      dot: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (action.startsWith("server.")) {
    return {
      bg: "bg-blue-500/10",
      dot: "bg-blue-500",
      text: "text-blue-600 dark:text-blue-400",
    };
  }
  if (action.startsWith("auth.")) {
    return {
      bg: "bg-amber-500/10",
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    bg: "bg-zinc-500/10",
    dot: "bg-zinc-400",
    text: "text-zinc-600 dark:text-zinc-400",
  };
};

const fmtAction = (action: string) =>
  action.replaceAll("_", " ").replaceAll(".", " · ");

export const AuditLogTable = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "50",
      });
      if (search) {
        params.set("q", search);
      }
      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      setData(await res.json());
    } catch {
      toast.error("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email, action, or target ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(q);
                setPage(1);
              }
            }}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setSearch(q);
            setPage(1);
          }}
        >
          Search
        </Button>
      </div>

      {/* Timeline */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        {(loading || !data) && (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-4">
                <div className="flex shrink-0 flex-col items-center gap-1 pt-1.5">
                  <Skeleton className="size-2 rounded-full" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="hidden h-3 w-24 sm:block" />
              </div>
            ))}
          </div>
        )}
        {!loading && data && data.logs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No audit events found.
          </div>
        )}
        {!loading && data && data.logs.length > 0 && (
          <div className="divide-y divide-border/50">
            {data.logs.map((log) => {
              const style = categoryStyle(log.action);
              return (
                <div
                  key={log.id}
                  className="flex gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                >
                  {/* Left: coloured timeline dot + line */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div
                      className={cn("size-2 shrink-0 rounded-full", style.dot)}
                    />
                    <div className="w-px flex-1 bg-border/40" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0">
                        {/* Action badge */}
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-medium",
                            style.bg,
                            style.text
                          )}
                        >
                          {fmtAction(log.action)}
                        </span>

                        {/* Actor + target */}
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>
                            by{" "}
                            <span className="font-medium text-foreground/80">
                              {log.actorEmail ?? "system"}
                            </span>
                          </span>
                          {log.targetType && (
                            <span>
                              on{" "}
                              <span className="text-foreground/70">
                                {log.targetType}
                              </span>
                              {log.targetId && (
                                <span className="ml-1 font-mono text-muted-foreground/60">
                                  {log.targetId.slice(0, 8)}…
                                </span>
                              )}
                            </span>
                          )}
                          {log.ipAddress && (
                            <span className="font-mono">{log.ipAddress}</span>
                          )}
                        </p>

                        {/* Metadata */}
                        {log.metadata &&
                          Object.keys(log.metadata).length > 0 && (
                            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground/60">
                              {JSON.stringify(log.metadata)}
                            </p>
                          )}
                      </div>

                      {/* Timestamp */}
                      <time
                        className="shrink-0 text-xs text-muted-foreground/70"
                        dateTime={log.createdAt}
                      >
                        {new Date(log.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
