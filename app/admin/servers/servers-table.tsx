"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Server,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { games } from "@/games";

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

const stateBadgeVariant = (
  state: string,
  desiredState: string
): "default" | "secondary" | "destructive" | "outline" => {
  if (desiredState === "deleted") {
    return "destructive";
  }
  if (state === "running") {
    return "default";
  }
  if (state === "failed" || state === "lost") {
    return "destructive";
  }
  if (state === "unhealthy") {
    return "secondary";
  }
  return "outline";
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

  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
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
          <SelectTrigger className="w-36">
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
      <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
        {(loading || !data) && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {!loading && data && data.servers.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No servers found.
          </div>
        )}
        {!loading && data && data.servers.length > 0 && (
          <div className="divide-y divide-border/50">
            {data.servers.map((server) => {
              const game = games.find((g) => g.id === server.game);
              const deleting = server.desiredState === "deleted";
              return (
                <div
                  key={server.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {game ? (
                      <Image
                        src={game.image}
                        alt={game.name}
                        width={28}
                        height={28}
                        className="size-7 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-card/50">
                        <Server className="size-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {server.name}
                        </span>
                        <Badge
                          variant={stateBadgeVariant(
                            server.observedState,
                            server.desiredState
                          )}
                          className="shrink-0 text-xs"
                        >
                          {deleting ? "deleting" : server.observedState}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {server.user.name ?? server.user.email}
                        {server.ipv4 && (
                          <span className="ml-2 font-mono">{server.ipv4}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {server.location}
                    </span>
                    <span className="hidden text-xs text-muted-foreground md:block">
                      {new Date(server.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="size-7"
                    >
                      <Link href={`/dashboard/${server.id}`}>
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
