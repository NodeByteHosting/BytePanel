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
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

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
      <Badge variant="secondary" className="gap-1 text-xs">
        <Shield className="size-3" />
        Super Admin
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge variant="secondary" className="text-xs">
        Admin
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      User
    </Badge>
  );
};

export const UsersTable = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Ban dialog state
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
    // Refresh in place
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
    // Redirect to the dashboard — the impersonation cookie is now set
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
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
      <Card>
        <CardContent className="p-0">
          {(loading || !data) && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {!loading && data && data.users.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          )}
          {!loading && data && data.users.length > 0 && (
            <div className="divide-y">
              {data.users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-4 px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-lg">
                      {user.image && (
                        <AvatarImage
                          src={user.image}
                          alt={user.name ?? user.email}
                          className="rounded-lg"
                        />
                      )}
                      <AvatarFallback className="rounded-lg text-xs">
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-none">
                        {user.name ?? user.email}
                      </span>
                      {user.name && (
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {user.banned && (
                      <Badge variant="destructive" className="text-xs">
                        Banned
                      </Badge>
                    )}
                    <RoleBadge role={user.role} superAdmin={user.superAdmin} />
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {user._count.servers} server
                      {user._count.servers === 1 ? "" : "s"}
                    </span>
                    <span className="hidden text-xs text-muted-foreground md:block">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
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
                        {/* Impersonate — only for plain users, never admins */}
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

      {/* Ban dialog */}
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
