"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Server,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { games } from "@/games";
import { cn } from "@/lib/utils";

import { adminDeleteServer } from "./actions/delete";

interface AdminServer {
  id: string;
  name: string;
  game: string;
  location: string;
  serverType: string;
  observedState: string;
  desiredState: string;
  ipv4: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

interface PagedResponse {
  servers: AdminServer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const stateBadgeClass = (state: string, desiredState: string): string => {
  if (desiredState === "deleted") {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (state === "running") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (state === "failed" || state === "lost") {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  }
  if (state === "unhealthy") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  return "border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400";
};

const getServerStateColor = (state: string) => {
  if (state === "running") {
    return "bg-emerald-500";
  }
  if (state === "unhealthy") {
    return "bg-amber-500";
  }
  if (["failed", "lost", "deleting"].includes(state)) {
    return "bg-red-500";
  }
  return "bg-zinc-400";
};

const STATES = [
  { label: "All states", value: "all" },
  { label: "Running", value: "running" },
  { label: "Stopped", value: "stopped" },
  { label: "Provisioning", value: "provisioning" },
  { label: "Failed", value: "failed" },
  { label: "Unhealthy", value: "unhealthy" },
];

export const ServersTable = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) {
        params.set("q", search);
      }
      if (status && status !== "all") {
        params.set("status", status);
      }
      const res = await fetch(`/api/admin/servers?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      setData(await res.json());
    } catch {
      toast.error("Failed to load servers.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  const handleDeleteServer = useCallback(
    async (serverId: string) => {
      setDeletingIds((prev) => new Set([...prev, serverId]));
      setDeleteTarget(null);
      try {
        const result = await adminDeleteServer({ serverId });
        if (result.ok) {
          toast.success("Server deleted");
          void fetchServers();
        } else {
          toast.error(result.error || "Failed to delete server");
        }
      } catch {
        toast.error("Failed to delete server");
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(serverId);
          return next;
        });
      }
    },
    [fetchServers]
  );

  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, owner email…"
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
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="shrink-0"
          variant="secondary"
          onClick={() => {
            setSearch(q);
            setPage(1);
          }}
        >
          Search
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        {(loading || !data) && (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="hidden h-4 w-16 sm:block" />
                <Skeleton className="size-8 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>
        )}
        {!loading && data?.servers.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No servers found.
          </div>
        )}
        {!loading && data && data.servers.length > 0 && (
          <div className="divide-y divide-border/50">
            {data.servers.map((server) => {
              const game = games.find((g) => g.id === server.game);
              const deleting = server.desiredState === "deleted";
              const stateKey = deleting ? "deleting" : server.observedState;
              return (
                <div
                  key={server.id}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  {/* Game image */}
                  {game ? (
                    <Image
                      src={game.image}
                      alt={game.name}
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted">
                      <Server className="size-4 text-muted-foreground" />
                    </div>
                  )}

                  {/* Name + owner */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="truncate text-sm font-medium">
                        {server.name}
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <div
                          className={cn(
                            "size-1.5 rounded-full",
                            getServerStateColor(stateKey)
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs capitalize",
                            stateBadgeClass(
                              server.observedState,
                              server.desiredState
                            )
                              .split(" ")
                              .filter((c) => c.startsWith("text-"))
                              .join(" ") || "text-muted-foreground"
                          )}
                        >
                          {stateKey}
                        </span>
                      </div>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {server.user.name ?? server.user.email}
                      {server.ipv4 && (
                        <span className="ml-2 font-mono">{server.ipv4}</span>
                      )}
                    </p>
                  </div>

                  {/* Meta — hidden on mobile */}
                  <div className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex">
                    <span>{server.location}</span>
                    <span>
                      {new Date(server.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Open in dashboard */}
                  <Button
                    asChild
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Link
                      href={`/dashboard/${server.id}`}
                      aria-label={`Open ${server.name} in dashboard`}
                    >
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>

                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 opacity-60 transition-opacity hover:text-destructive hover:opacity-100"
                    disabled={deletingIds.has(server.id)}
                    onClick={() => setDeleteTarget(server.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
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
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Previous page"
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
              className="size-8"
              aria-label="Next page"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the server from the provider immediately. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  handleDeleteServer(deleteTarget);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
