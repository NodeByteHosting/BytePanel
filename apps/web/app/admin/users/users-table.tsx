"use client";

import {
  Ban,
  ChevronLeft,
  ChevronRight,
  LogIn,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  superAdmin: boolean;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  _count: { servers: number };
}

interface PagedResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const RoleBadge = ({
  role,
  superAdmin,
}: {
  role: string;
  superAdmin: boolean;
}) => {
  if (superAdmin) {
    return (
      <Badge
        className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400"
        variant="outline"
      >
        <Shield className="size-3" />
        Super Admin
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge
        className="border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
        variant="outline"
      >
        Admin
      </Badge>
    );
  }
  return (
    <Badge className="text-xs" variant="outline">
      User
    </Badge>
  );
};

const getAvatarClass = (superAdmin: boolean, role: string) => {
  if (superAdmin) {
    return "bg-violet-500/15 text-violet-600 dark:text-violet-400";
  }
  if (role === "admin") {
    return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  }
  return "bg-muted";
};

export const UsersTable = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) {
        params.set("q", search);
      }
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      setData(await res.json());
    } catch {
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchUsers();
  }, [fetchUsers]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Action failed.");
      return false;
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            users: prev.users.map((u) =>
              u.id === id ? { ...u, ...json.user } : u
            ),
          }
        : prev
    );
    return true;
  };

  const handleSetRole = async (user: AdminUser, role: "user" | "admin") => {
    const ok = await patch(user.id, { action: "set-role", role });
    if (ok) {
      toast.success(`${user.name ?? user.email} is now ${role}.`);
    }
  };

  const handleToggleSuperAdmin = async (user: AdminUser) => {
    const ok = await patch(user.id, {
      action: "set-super-admin",
      superAdmin: !user.superAdmin,
    });
    if (ok) {
      toast.success(
        user.superAdmin
          ? `Removed super-admin from ${user.name ?? user.email}.`
          : `${user.name ?? user.email} is now a super-admin.`
      );
    }
  };

  const handleBan = async () => {
    if (!banTarget) {
      return;
    }
    setBanning(true);
    const ok = await patch(banTarget.id, {
      action: "ban",
      banReason: banReason || undefined,
    });
    setBanning(false);
    if (ok) {
      toast.success(`${banTarget.name ?? banTarget.email} has been banned.`);
      setBanTarget(null);
      setBanReason("");
    }
  };

  const handleUnban = async (user: AdminUser) => {
    const ok = await patch(user.id, { action: "unban" });
    if (ok) {
      toast.success(`${user.name ?? user.email} has been unbanned.`);
    }
  };

  const handleImpersonate = async (user: AdminUser) => {
    const res = await fetch(`/api/admin/users/${user.id}/impersonate`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to start impersonation session.");
      return;
    }
    toast.success(`Now impersonating ${user.name ?? user.email}. Redirecting…`);
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name or email…"
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
        {!loading && data?.users.length === 0 && (
          <div className="text-muted-foreground py-16 text-center text-sm">
            No users found.
          </div>
        )}
        {!loading && data && data.users.length > 0 && (
          <div className="divide-border/50 divide-y">
            {data.users.map((user) => (
              <div
                key={user.id}
                className={cn(
                  "group hover:bg-muted/30 flex items-center gap-3 px-4 py-3 transition-colors",
                  user.banned && "bg-red-500/5"
                )}
              >
                <Avatar className="size-8 shrink-0 rounded-lg">
                  {user.image && (
                    <AvatarImage
                      src={user.image}
                      alt={user.name ?? user.email}
                      className="rounded-lg"
                    />
                  )}
                  <AvatarFallback
                    className={cn(
                      "rounded-lg text-xs font-semibold",
                      getAvatarClass(user.superAdmin, user.role)
                    )}
                  >
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-medium">
                      {user.name ?? user.email}
                    </span>
                    <RoleBadge role={user.role} superAdmin={user.superAdmin} />
                    {user.banned && (
                      <Badge
                        variant="outline"
                        className="border-red-500/40 bg-red-500/10 text-xs text-red-600 dark:text-red-400"
                      >
                        Banned
                      </Badge>
                    )}
                  </div>
                  {user.name && (
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  )}
                </div>

                <div className="text-muted-foreground hidden shrink-0 items-center gap-4 text-xs sm:flex">
                  <span className="tabular-nums">
                    {user._count.servers}{" "}
                    {user._count.servers === 1 ? "server" : "servers"}
                  </span>
                  <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Actions for ${user.name ?? user.email}`}
                      className="size-8 shrink-0 opacity-60 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      size="icon"
                      variant="ghost"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      Role
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={user.role === "user" && !user.superAdmin}
                      onSelect={() => handleSetRole(user, "user")}
                    >
                      <UserX className="size-4" />
                      Set User
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={user.role === "admin" && !user.superAdmin}
                      onSelect={() => handleSetRole(user, "admin")}
                    >
                      <UserCheck className="size-4" />
                      Set Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleToggleSuperAdmin(user)}
                    >
                      {user.superAdmin ? (
                        <>
                          <ShieldOff className="size-4" />
                          Remove Super Admin
                        </>
                      ) : (
                        <>
                          <Shield className="size-4" />
                          Make Super Admin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.banned ? (
                      <DropdownMenuItem onSelect={() => handleUnban(user)}>
                        <UserCheck className="size-4" />
                        Unban
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setBanTarget(user)}
                      >
                        <Ban className="size-4" />
                        Ban user
                      </DropdownMenuItem>
                    )}
                    {user.role === "user" && !user.superAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => handleImpersonate(user)}
                        >
                          <LogIn className="size-4" />
                          Impersonate
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

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

      <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ban {banTarget?.name ?? banTarget?.email}?
            </DialogTitle>
            <DialogDescription>
              They will be immediately signed out and blocked from signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Reason{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Textarea
              placeholder="e.g. Violation of terms of service"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={banning}
              onClick={handleBan}
            >
              <Ban className="size-4" />
              {banning ? "Banning…" : "Ban user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
