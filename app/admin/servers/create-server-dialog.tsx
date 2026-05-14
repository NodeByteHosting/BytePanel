"use client";

import { Loader2, PlusCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { adminCreateServer } from "@/app/admin/actions/create-server";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { games } from "@/games";
import type { CatalogServerType } from "@/lib/providers/types";

// Minimal user type returned by the admin users API
interface AdminUser {
  id: string;
  email: string;
  name: string | null;
}

interface CatalogResponse {
  serverTypes: CatalogServerType[];
}

const TIER_LABELS: Record<string, string> = {
  dedicated: "Dedicated CPU (General Purpose)",
  "shared-optimised": "Shared CPU — Optimised (Regular Performance)",
  "shared-standard": "Shared CPU — Standard (Cost-Optimised)",
};

export const CreateServerDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [targetUserId, setTargetUserId] = useState("");
  const [gameId, setGameId] = useState("");
  const [serverType, setServerType] = useState("");
  const [location, setLocation] = useState("");
  const [name, setName] = useState("");
  const [skipBilling, setSkipBilling] = useState(false);

  // Async data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [catalogTypes, setCatalogTypes] = useState<CatalogServerType[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Fetch all users for the user picker (paginated search)
  const fetchUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", q });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load users");
      }
      const data = (await res.json()) as { users: AdminUser[] };
      setUsers(data.users ?? []);
    } catch {
      toast.error("Could not load users");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch catalog when the dialog opens
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await fetch("/api/admin/catalog");
      if (!res.ok) {
        throw new Error("Failed to load catalog");
      }
      const data = (await res.json()) as CatalogResponse;
      setCatalogTypes(data.serverTypes ?? []);
    } catch {
      toast.error("Could not load server catalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchUsers("");
      fetchCatalog();
    }
  }, [open, fetchUsers, fetchCatalog]);

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        fetchUsers(userSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, open, fetchUsers]);

  // Reset location when server type changes
  useEffect(() => {
    setLocation("");
  }, [serverType]);

  const selectedType = catalogTypes.find((t) => t.name === serverType);

  // Group server types by tier for the select
  const byTier: Record<string, CatalogServerType[]> = {};
  for (const t of catalogTypes) {
    const tier = t.tier ?? "shared-standard";
    if (!byTier[tier]) {
      byTier[tier] = [];
    }
    byTier[tier].push(t);
  }

  const availableLocations =
    selectedType?.locations.filter((l) => l.supported) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !targetUserId ||
      !gameId ||
      !serverType ||
      !location ||
      name.length < 3
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const result = await adminCreateServer({
        game: gameId,
        location,
        name,
        serverType,
        skipBilling,
        targetUserId,
      });

      if (result.ok) {
        toast.success("Server is being provisioned", {
          description: `Server "${name}" will be ready in ~60 seconds`,
        });
        setOpen(false);
        // Reset form
        setTargetUserId("");
        setGameId("");
        setServerType("");
        setLocation("");
        setName("");
        setSkipBilling(false);
      } else {
        toast.error("Failed to create server", { description: result.error });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-1.5 h-4 w-4" />
          Create server
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create server (admin)</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User picker */}
          <div className="space-y-1.5">
            <Label htmlFor="user-search">Assign to user</Label>
            <Input
              id="user-search"
              placeholder="Search by email or name…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="mb-1"
            />
            <Select
              value={targetUserId}
              onValueChange={setTargetUserId}
              disabled={usersLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    usersLoading ? "Loading users…" : "Select a user"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="font-medium">{u.email}</span>
                    {u.name && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {u.name}
                      </span>
                    )}
                  </SelectItem>
                ))}
                {!usersLoading && users.length === 0 && (
                  <div className="text-muted-foreground py-2 text-center text-sm">
                    No users found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Game */}
          <div className="space-y-1.5">
            <Label>Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Server type */}
          <div className="space-y-1.5">
            <Label>Server type</Label>
            <Select
              value={serverType}
              onValueChange={setServerType}
              disabled={catalogLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    catalogLoading ? "Loading catalog…" : "Select a server type"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(byTier).map(([tier, types]) => (
                  <SelectGroup key={tier}>
                    <SelectLabel>{TIER_LABELS[tier] ?? tier}</SelectLabel>
                    {types.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        <span className="font-mono">{t.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {t.cores}vCPU · {t.memory}GB · {t.disk}GB · £
                          {t.pricePerMonth.toFixed(2)}/mo
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Region</Label>
            <Select
              value={location}
              onValueChange={setLocation}
              disabled={!selectedType}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedType
                      ? "Select a region"
                      : "Select a server type first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.map((l) => (
                  <SelectItem
                    key={l.name}
                    value={l.name}
                    disabled={!l.available}
                  >
                    <span className="font-mono">{l.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {l.city}, {l.country} · £{l.pricePerMonth.toFixed(2)}/mo
                      {!l.available && " (unavailable)"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Server name */}
          <div className="space-y-1.5">
            <Label htmlFor="server-name">Server name</Label>
            <Input
              id="server-name"
              placeholder="e.g. My Minecraft Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={40}
            />
          </div>

          {/* Skip billing toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Skip Stripe billing</p>
              <p className="text-muted-foreground text-xs">
                Create server without charging the user (admin-assigned)
              </p>
            </div>
            <Switch checked={skipBilling} onCheckedChange={setSkipBilling} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create server
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
