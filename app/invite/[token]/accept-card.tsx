"use client";

import { CheckCircle2, Clock, Mail, ShieldAlert, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SERVER_ROLE_LABELS } from "@/lib/rbac";

type InviteState = "pending" | "invalid" | "expired" | "mismatch";

interface PendingInvite {
  token: string;
  serverName: string;
  serverId: string;
  invitedByName: string;
  role: string;
  expiresAt: string;
}

interface Props {
  state: InviteState;
  message?: string;
  invite?: PendingInvite;
}

const STATE_ICON: Record<Exclude<InviteState, "pending">, React.ReactNode> = {
  expired: <Clock className="size-10 text-amber-500" />,
  invalid: <XCircle className="size-10 text-destructive" />,
  mismatch: <ShieldAlert className="size-10 text-destructive" />,
};

export const InviteAcceptCard = ({ state, message, invite }: Props) => {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (!invite) {
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${invite.token}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to accept invite.");
        return;
      }
      toast.success(`You've joined ${invite.serverName}!`);
      router.push(`/dashboard/${invite.serverId}`);
    } finally {
      setAccepting(false);
    }
  };

  if (state === "pending" && invite) {
    const roleLabel =
      SERVER_ROLE_LABELS[invite.role as keyof typeof SERVER_ROLE_LABELS] ??
      invite.role;

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-7 text-primary" />
            </div>
            <CardTitle>Server Invite</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">
                {invite.invitedByName}
              </span>{" "}
              has invited you to collaborate on{" "}
              <span className="font-medium text-foreground">
                {invite.serverName}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm text-muted-foreground">Your role</span>
              <Badge variant="secondary" className="text-sm capitalize">
                {roleLabel}
              </Badge>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Expires{" "}
              {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/dashboard")}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              disabled={accepting}
              onClick={handleAccept}
            >
              <CheckCircle2 className="size-4" />
              {accepting ? "Accepting…" : "Accept invite"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const errorTitles: Record<string, string> = {
    expired: "Invite expired",
    mismatch: "Wrong account",
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {STATE_ICON[state as Exclude<InviteState, "pending">]}
          </div>
          <CardTitle>{errorTitles[state] ?? "Invalid invite"}</CardTitle>
          {message && <CardDescription>{message}</CardDescription>}
        </CardHeader>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            Go to dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
