"use client";

import { Crown, MoreHorizontal, Send, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SERVER_ROLE_LABELS } from "@/lib/server-roles";

type MemberRole = "viewer" | "member" | "admin";

interface ServerMemberUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface ServerMember {
  id: string;
  serverId: string;
  userId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  user: ServerMemberUser;
}

interface ServerInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

interface Props {
  serverId: string;
  currentUserId: string;
  owner: ServerMemberUser;
  members: ServerMember[];
  invites: ServerInvite[];
}

const RoleBadge = ({ role }: { role: string }) => {
  const label =
    SERVER_ROLE_LABELS[role as keyof typeof SERVER_ROLE_LABELS] ?? role;
  return (
    <Badge variant="secondary" className="capitalize text-xs">
      {label}
    </Badge>
  );
};

const UserAvatar = ({ user }: { user: ServerMemberUser }) => {
  const initial = (user.name ?? user.email).charAt(0).toUpperCase();
  return (
    <Avatar className="size-8 rounded-lg">
      {user.image ? (
        <AvatarImage
          src={user.image}
          alt={user.name ?? user.email}
          className="rounded-lg"
        />
      ) : null}
      <AvatarFallback className="rounded-lg">{initial}</AvatarFallback>
    </Avatar>
  );
};

export const TeamPanel = ({
  serverId,
  currentUserId,
  owner,
  members: initialMembers,
  invites: initialInvites,
}: Props) => {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail) {
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/members`, {
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to invite user.");
        return;
      }
      if (data.type === "added") {
        setMembers((prev) => [...prev, data.member]);
        toast.success("User added to server.");
      } else {
        setInvites((prev) => [data.invite, ...prev]);
        toast.success("Invite sent — share the token with the user.");
      }
      setInviteEmail("");
      setInviteOpen(false);
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, role: MemberRole) => {
    const res = await fetch(`/api/servers/${serverId}/members/${memberId}`, {
      body: JSON.stringify({ role }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to change role.");
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
    toast.success("Role updated.");
  };

  const handleRemove = async (memberId: string) => {
    const res = await fetch(`/api/servers/${serverId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to remove member.");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("Member removed.");
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const res = await fetch(`/api/servers/${serverId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to revoke invite.");
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    toast.success("Invite revoked.");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Team members */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Team members</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage who has access to this server.
            </p>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="size-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a team member</DialogTitle>
                <DialogDescription>
                  Enter the email address of the person you want to invite. If
                  they already have an account they will be added immediately,
                  otherwise an invite token will be created.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as MemberRole)}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        Viewer — read-only access
                      </SelectItem>
                      <SelectItem value="member">
                        Member — start/stop/restart
                      </SelectItem>
                      <SelectItem value="admin">
                        Admin — files, backups, settings
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail}
                >
                  <Send className="size-4" />
                  Send invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="divide-y divide-border/50">
          {/* Owner row */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar user={owner} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {owner.name ?? owner.email}
                </span>
                {owner.name && (
                  <span className="text-xs text-muted-foreground">
                    {owner.email}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="size-3.5 text-amber-500" />
              <Badge variant="secondary" className="text-xs">
                Owner
              </Badge>
            </div>
          </div>

          {/* Member rows */}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <UserAvatar user={member.user} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {member.user.name ?? member.user.email}
                  </span>
                  {member.user.name && (
                    <span className="text-xs text-muted-foreground">
                      {member.user.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={member.role} />
                {member.userId !== currentUserId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => handleChangeRole(member.id, "viewer")}
                        disabled={member.role === "viewer"}
                      >
                        Set Viewer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleChangeRole(member.id, "member")}
                        disabled={member.role === "member"}
                      >
                        Set Member
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleChangeRole(member.id, "admin")}
                        disabled={member.role === "admin"}
                      >
                        Set Admin
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => handleRemove(member.id)}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No members yet. Invite someone to get started.
            </p>
          )}
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/50 px-5 py-4">
            <p className="text-sm font-semibold">Pending invites</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              These invites have not been accepted yet.
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{invite.email}</span>
                  <span className="text-xs text-muted-foreground">
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={invite.role} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => handleRevokeInvite(invite.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
