"use client";

import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

const parseUa = (ua: string | null) => {
  if (!ua) {
    return "Unknown device";
  }
  if (/iPhone|iPad|Android/iu.test(ua)) {
    return "Mobile";
  }
  if (/Mac/iu.test(ua)) {
    return "macOS";
  }
  if (/Windows/iu.test(ua)) {
    return "Windows";
  }
  if (/Linux/iu.test(ua)) {
    return "Linux";
  }
  return "Browser";
};

export const SessionsTable = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
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
    } catch {
      toast.error("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
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
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => fetchSessions()}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {(loading || !data) && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {!loading && data && data.sessions.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No active sessions.
            </div>
          )}
          {!loading && data && data.sessions.length > 0 && (
            <div className="divide-y">
              {data.sessions.map((session) => {
                const expiresIn =
                  new Date(session.expiresAt).getTime() - Date.now();
                const expiresInDays = Math.round(expiresIn / 86_400_000);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-4 px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Monitor className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm font-medium leading-none">
                          {session.user.name ?? session.user.email}
                          {session.user.name && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {session.user.email}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {parseUa(session.userAgent)}
                          </Badge>
                          {session.ipAddress && (
                            <span className="font-mono">
                              {session.ipAddress}
                            </span>
                          )}
                          <span>
                            expires in{" "}
                            {expiresInDays > 0 ? `${expiresInDays}d` : "< 1d"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={revoking === session.id}
                      onClick={() => handleRevoke(session)}
                    >
                      <Trash2 className="size-4" />
                      {revoking === session.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
