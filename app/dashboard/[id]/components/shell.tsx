"use client";
import {
  MoreHorizontalIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
  Trash2Icon,
  Users2Icon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { games } from "@/games";
import type { CatalogServerType } from "@/lib/providers/types";
import type { ServerRole } from "@/lib/server-roles";
import { cn } from "@/lib/utils";

import { PageBody, PageHeader } from "../../components/page-header";
import { runServerCommand } from "../actions/commands";
import { deleteServer } from "../actions/delete";
import { ProvisioningStatus } from "./provisioning-status";
import { ServerProvider } from "./server-context";
import type { ServerView } from "./server-context";

const PROVISIONING_PHASES = new Set([
  "queued",
  "provisioning",
  "booting",
  "agent_connected",
  "installing",
  "starting",
  "healthy",
  "errored",
]);

const ALL_TABS = [
  { label: "Connect", minRole: "viewer" as ServerRole, value: "connect" },
  { label: "Activity", minRole: "viewer" as ServerRole, value: "activity" },
  { label: "Console", minRole: "viewer" as ServerRole, value: "console" },
  { label: "Graphs", minRole: "viewer" as ServerRole, value: "graphs" },
  { label: "Backups", minRole: "admin" as ServerRole, value: "backups" },
  { label: "Files", minRole: "admin" as ServerRole, value: "files" },
  { label: "Details", minRole: "member" as ServerRole, value: "details" },
  { label: "Settings", minRole: "admin" as ServerRole, value: "settings" },
  { label: "Team", minRole: "owner" as ServerRole, value: "team" },
] as const;

const ROLE_ORDER: Record<ServerRole, number> = {
  admin: 2,
  member: 1,
  owner: 3,
  viewer: 0,
};

const tabVisible = (minRole: ServerRole, userRole: ServerRole) =>
  ROLE_ORDER[userRole] >= ROLE_ORDER[minRole];

interface Props {
  server: ServerView;
  eligibleTypes: CatalogServerType[];
  currency: string;
  serverRole: ServerRole;
  children: ReactNode;
}

const stateBadgeClass = (state: string, deleting: boolean): string => {
  if (deleting || state === "failed" || state === "lost") {
    return "";
  }
  if (state === "running") {
    return "border-emerald-600 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
  }
  return "";
};

const stateBadgeVariant = (
  state: string,
  deleting: boolean
): "default" | "secondary" | "destructive" | "outline" => {
  if (deleting || state === "failed" || state === "lost") {
    return "destructive";
  }
  if (state === "unhealthy") {
    return "secondary";
  }
  return "outline";
};

export const ServerShell = ({
  server: initial,
  eligibleTypes,
  currency,
  serverRole,
  children,
}: Props) => {
  const canControl = ROLE_ORDER[serverRole] >= ROLE_ORDER["member"];
  const canDelete = ROLE_ORDER[serverRole] >= ROLE_ORDER["owner"];
  const visibleTabs = ALL_TABS.filter((t) => tabVisible(t.minRole, serverRole));
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const activeTab =
    segment && ALL_TABS.some((tab) => tab.value === segment)
      ? segment
      : "connect";
  const [server, setServer] = useState(initial);
  const [pending, setPending] = useState<null | string>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/servers/${initial.id}`);
      if (!res.ok) {
        return;
      }
      const { server: fresh } = await res.json();
      if (fresh) {
        setServer((prev) => ({
          ...prev,
          backupsEnabled: fresh.backupsEnabled ?? prev.backupsEnabled,
          desiredState: fresh.desiredState,
          errorReason: fresh.errorReason ?? null,
          game: fresh.game,
          id: fresh.id,
          ipv4: fresh.ipv4,
          lastHeartbeatAt: fresh.agent?.lastHeartbeatAt ?? null,
          name: fresh.name,
          observedState: fresh.observedState,
          phase: fresh.phase,
          serverType: fresh.serverType ?? prev.serverType,
        }));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [initial.id]);

  const sendCommand = async (type: "START" | "STOP" | "RESTART") => {
    setPending(type);
    const result = await runServerCommand({ serverId: server.id, type });
    setPending(null);
    if (result.ok) {
      toast.success(`${type} queued`);
    } else {
      toast.error(result.error);
    }
  };

  const runDelete = async () => {
    setPending("DELETE");
    const result = await deleteServer({ serverId: server.id });
    setPending(null);
    if (result.ok) {
      router.push("/dashboard");
    } else {
      toast.error(result.error);
    }
  };

  const updateServer = (patch: Partial<ServerView>) =>
    setServer((prev) => ({ ...prev, ...patch }));

  const isProvisioning = PROVISIONING_PHASES.has(server.phase);
  const game = games.find((g) => g.id === server.game);

  if (!game) {
    return null;
  }

  const deleting = server.desiredState === "deleted";
  const statusLabel = deleting ? "deleting" : server.observedState;

  const meta = (
    <Badge
      className={cn(
        "capitalize",
        stateBadgeClass(server.observedState, deleting)
      )}
      variant={stateBadgeVariant(server.observedState, deleting)}
    >
      {statusLabel}
    </Badge>
  );

  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Server actions" size="icon" variant="ghost">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={
            !canControl ||
            pending !== null ||
            server.observedState !== "stopped"
          }
          onSelect={() => sendCommand("START")}
        >
          <PlayIcon />
          Start
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={
            !canControl ||
            pending !== null ||
            server.observedState !== "running"
          }
          onSelect={() => sendCommand("STOP")}
        >
          <SquareIcon />
          Stop
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={
            !canControl ||
            pending !== null ||
            server.observedState !== "running"
          }
          onSelect={() => sendCommand("RESTART")}
        >
          <RotateCcwIcon />
          Restart
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending !== null || deleting}
              onSelect={() => setDeleteOpen(true)}
              variant="destructive"
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const deleteDialog = (
    <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this server?</AlertDialogTitle>
          <AlertDialogDescription>
            Your server and all its worlds, saves and settings will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={runDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const gameIcon = (
    <Image
      alt={game.name}
      className="size-10 rounded-lg object-cover"
      height={40}
      src={game.image}
      width={40}
    />
  );

  if (isProvisioning) {
    return (
      <>
        <PageHeader
          actions={actions}
          icon={gameIcon}
          meta={meta}
          title={server.name}
        />
        <PageBody>
          <ProvisioningStatus
            errored={
              server.phase === "errored" || server.observedState === "failed"
            }
            errorReason={server.errorReason}
            phase={server.phase}
          />
        </PageBody>
        {deleteDialog}
      </>
    );
  }

  return (
    <ServerProvider value={{ currency, eligibleTypes, server, updateServer }}>
      <PageHeader
        actions={actions}
        flush
        icon={gameIcon}
        meta={meta}
        title={server.name}
      >
        <Tabs
          className="[&_[data-slot=tabs-trigger]]:flex-none"
          value={activeTab}
        >
          <TabsList variant="line">
            {visibleTabs.map((tab) => (
              <TabsTrigger asChild key={tab.value} value={tab.value}>
                <Link
                  href={
                    tab.value === "connect"
                      ? `/dashboard/${server.id}`
                      : `/dashboard/${server.id}/${tab.value}`
                  }
                >
                  {tab.value === "team" ? (
                    <span className="flex items-center gap-1.5">
                      <Users2Icon className="size-3.5" />
                      Team
                    </span>
                  ) : (
                    tab.label
                  )}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>
      <PageBody flush={activeTab === "console"} wide={activeTab === "console"}>
        {children}
      </PageBody>
      {deleteDialog}
    </ServerProvider>
  );
};
