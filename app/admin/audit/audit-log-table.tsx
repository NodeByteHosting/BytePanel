"use client";

import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

// Colour-code action categories
const actionVariant = (
  action: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (action.startsWith("admin.")) {
    return "secondary";
  }
  if (
    action.startsWith("server.delete") ||
    action.startsWith("admin.user.ban")
  ) {
    return "destructive";
  }
  if (action.startsWith("billing.")) {
    return "outline";
  }
  return "default";
};

// Format action code for display: "admin.user.set_role" → "admin · user · set role"
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
          <SlidersHorizontal className="size-4" />
          Filter
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {(loading || !data) && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {!loading && data && data.logs.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No audit events found.
            </div>
          )}
          {!loading && data && data.logs.length > 0 && (
            <div className="divide-y">
              {data.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={actionVariant(log.action)}
                        className="font-mono text-xs"
                      >
                        {fmtAction(log.action)}
                      </Badge>
                      {log.targetType && (
                        <span className="text-xs text-muted-foreground">
                          on{" "}
                          <span className="text-foreground/70">
                            {log.targetType}
                          </span>
                          {log.targetId && (
                            <span className="ml-1 font-mono text-xs text-muted-foreground/60">
                              {log.targetId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        by{" "}
                        <span className="text-foreground/80">
                          {log.actorEmail ?? "system"}
                        </span>
                      </span>
                      {log.ipAddress && (
                        <span className="font-mono">{log.ipAddress}</span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground/70 break-all">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2">
              {page} / {data.totalPages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={page >= data.totalPages}
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
