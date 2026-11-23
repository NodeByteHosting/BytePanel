"use client";
import { Ban, LogIn, Shield, ShieldOff, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Panel, PanelCard } from "@/components/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const useRequest = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const request = async (
    url: string,
    init: RequestInit,
    success: string
  ): Promise<boolean> => {
    setPending(true);
    try {
      const res = await fetch(url, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Action failed.");
        return false;
      }
      toast.success(success);
      router.refresh();
      return true;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      setPending(false);
    }
  };

  return { pending, request };
};

export const RevokeSessionButton = ({ sessionId }: { sessionId: string }) => {
  const { pending, request } = useRequest();
  return (
    <Button
      disabled={pending}
      size="sm"
      variant="outline"
      onClick={() =>
        request(
          `/api/admin/sessions/${sessionId}`,
          { method: "DELETE" },
          "Session revoked"
        )
      }
    >
      Revoke
    </Button>
  );
};

export const UserAdminActions = ({
  userId,
  displayName,
  role,
  superAdmin,
  banned,
  isSelf,
  viewerSuperAdmin,
  sessionIds,
}: {
  userId: string;
  displayName: string;
  role: "user" | "admin";
  superAdmin: boolean;
  banned: boolean;
  isSelf: boolean;
  viewerSuperAdmin: boolean;
  sessionIds: string[];
}) => {
  const router = useRouter();
  const { pending, request } = useRequest();
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banExpires, setBanExpires] = useState("");

  const patch = (body: Record<string, unknown>, success: string) =>
    request(
      `/api/admin/users/${userId}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      success
    );

  const handleBan = async () => {
    const ok = await patch(
      {
        action: "ban",
        banExpiresAt: banExpires
          ? new Date(banExpires).toISOString()
          : undefined,
        banReason: banReason || undefined,
      },
      `${displayName} has been banned.`
    );
    if (ok) {
      setBanOpen(false);
      setBanReason("");
      setBanExpires("");
    }
  };

  const handleImpersonate = async () => {
    const res = await fetch(`/api/admin/users/${userId}/impersonate`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "Failed to start impersonation session.");
      return;
    }
    toast.success(`Now impersonating ${displayName}. Redirecting…`);
    window.location.href = "/dashboard";
  };

  const handleRevokeAll = async () => {
    const results = await Promise.all(
      sessionIds.map((id) =>
        fetch(`/api/admin/sessions/${id}`, { method: "DELETE" })
      )
    );
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      toast.error(`Failed to revoke ${failed} session(s).`);
    } else {
      toast.success("All sessions revoked");
    }
    router.refresh();
  };

  return (
    <Panel title="Manage">
      <PanelCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Select
              disabled={pending || isSelf}
              value={role}
              onValueChange={(value) =>
                patch(
                  { action: "set-role", role: value },
                  `${displayName} is now ${value}.`
                )
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {viewerSuperAdmin && (
            <Button
              disabled={pending || isSelf}
              variant="outline"
              onClick={() =>
                patch(
                  { action: "set-super-admin", superAdmin: !superAdmin },
                  superAdmin
                    ? `Removed super-admin from ${displayName}.`
                    : `${displayName} is now a super-admin.`
                )
              }
            >
              {superAdmin ? (
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
            </Button>
          )}

          {role === "user" && !superAdmin && !isSelf && (
            <Button
              disabled={pending}
              variant="outline"
              onClick={handleImpersonate}
            >
              <LogIn className="size-4" />
              Impersonate
            </Button>
          )}

          {viewerSuperAdmin && sessionIds.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={pending} variant="outline">
                  Revoke all sessions
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {displayName} will be signed out of {sessionIds.length}{" "}
                    active session(s).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevokeAll}>
                    Revoke
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="ml-auto">
            {banned ? (
              <Button
                disabled={pending}
                variant="outline"
                onClick={() =>
                  patch(
                    { action: "unban" },
                    `${displayName} has been unbanned.`
                  )
                }
              >
                <UserCheck className="size-4" />
                Unban
              </Button>
            ) : (
              <Dialog open={banOpen} onOpenChange={setBanOpen}>
                <DialogTrigger asChild>
                  <Button disabled={pending || isSelf} variant="destructive">
                    <Ban className="size-4" />
                    Ban user
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ban {displayName}?</DialogTitle>
                    <DialogDescription>
                      They will be immediately signed out and blocked from
                      signing in.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ban-reason">
                        Reason{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Textarea
                        id="ban-reason"
                        placeholder="e.g. Violation of terms of service"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ban-expires">
                        Expires{" "}
                        <span className="text-muted-foreground font-normal">
                          (leave empty for permanent)
                        </span>
                      </Label>
                      <Input
                        id="ban-expires"
                        type="datetime-local"
                        value={banExpires}
                        onChange={(e) => setBanExpires(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBanOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={pending}
                      variant="destructive"
                      onClick={handleBan}
                    >
                      <Ban className="size-4" />
                      {pending ? "Banning…" : "Ban user"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </PanelCard>
    </Panel>
  );
};
