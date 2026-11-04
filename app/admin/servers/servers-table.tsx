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
import { cn } from "@/lib/utils";

import { adminDeleteServer } from "../actions/servers";

interface AdminServer {
  id: string;
  name: string;
  status: string | null;
  nodeId: string | null;
  createdAt: string;
  egg: { name: string; image: string | null } | null;
  node: { name: string } | null;
  allocation: { ip: string; ipAlias: string | null; port: number } | null;
  user: { id: string; email: string; name: string | null };
}

interface PagedResponse {
  servers: AdminServer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusOf = (
  server: AdminServer
): { label: string; dot: string; text: string } => {
  if (!server.nodeId) {
    return {
      dot: "bg-amber-500",
      label: "not deployed",
      text: "text-amber-600 dark:text-amber-400",
    };
  }
  switch (server.status) {
    case null: {
      return {
        dot: "bg-emerald-500",
        label: "installed",
        text: "text-emerald-600 dark:text-emerald-400",
      };
    }
    case "installing":
    case "restoring_backup": {
      return {
        dot: "bg-amber-500",
        label: server.status.replace("_", " "),
        text: "text-amber-600 dark:text-amber-400",
      };
    }
    default: {
      return {
        dot: "bg-red-500",
        label: server.status.replace("_", " "),
        text: "text-red-600 dark:text-red-400",
      };
    }
  }
};

const STATES = [
  { label: "All", value: "all" },
  { label: "Installed", value: "installed" },
  { label: "Installing", value: "installing" },
  { label: "Install failed", value: "install_failed" },
  { label: "Suspended", value: "suspended" },
  { label: "Not deployed", value: "undeployed" },
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
    // oxlint-disable-next-line react/set-state-in-effect -- data fetch: syncing with the API is what effects are for
    void fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
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
      <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
        {(loading || !data) && (
          <div className="divide-border/50 divide-y">
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
          <div className="text-muted-foreground py-16 text-center text-sm">
            No servers found.
          </div>
        )}
        {!loading && data && data.servers.length > 0 && (
          <div className="divide-border/50 divide-y">
            {data.servers.map((server) => {
              const state = statusOf(server);
              return (
                <div
                  key={server.id}
                  className="group hover:bg-muted/30 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  {/* Game image */}
                  {server.egg?.image ? (
                    <Image
                      src={server.egg.image}
                      alt={server.egg.name}
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="border-border/50 bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg border">
                      <Server className="text-muted-foreground size-4" />
                    </div>
                  )}

                  {/* Name + owner */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link
                        className="truncate text-sm font-medium hover:underline"
                        href={`/admin/servers/${server.id}`}
                      >
                        {server.name}
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        <div
                          className={cn("size-1.5 rounded-full", state.dot)}
                        />
                        <span className={cn("text-xs capitalize", state.text)}>
                          {state.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {server.user.name ?? server.user.email}
                      {server.allocation && (
                        <span className="ml-2 font-mono">
                          {server.allocation.ipAlias ?? server.allocation.ip}:
                          {server.allocation.port}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Meta — hidden on mobile */}
                  <div className="text-muted-foreground hidden shrink-0 items-center gap-4 text-xs sm:flex">
                    <span>{server.egg?.name ?? "—"}</span>
                    <span>{server.node?.name ?? "—"}</span>
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
                    className="hover:text-destructive size-8 shrink-0 opacity-60 transition-opacity hover:opacity-100"
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
        <div className="text-muted-foreground flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
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
              The server and its files are removed from its node immediately.
              This action cannot be undone.
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
