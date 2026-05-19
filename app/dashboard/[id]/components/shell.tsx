"use client";
import {
  ActivityIcon,
  ArchiveIcon,
  BarChart2Icon,
  FolderIcon,
  InfoIcon,
  LayoutDashboardIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RotateCcwIcon,
  Settings2Icon,
  SquareIcon,
  TerminalIcon,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

const STATE_BADGE: Record<string, string> = {
  deleting:
    "border-red-500/40 bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  failed:
    "border-red-500/40 bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  lost: "border-red-500/40 bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  running:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  stopped:
    "border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400",
  unhealthy:
    "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
};

const ALL_TABS = [
  {
    icon: LayoutDashboardIcon,
    label: "Overview",
    minRole: "viewer" as ServerRole,
    value: "connect",
  },
  {
    icon: ActivityIcon,
    label: "Activity",
    minRole: "viewer" as ServerRole,
    value: "activity",
  },
  {
    icon: TerminalIcon,
    label: "Console",
    minRole: "viewer" as ServerRole,
    value: "console",
  },
  {
    icon: BarChart2Icon,
    label: "Graphs",
    minRole: "viewer" as ServerRole,
    value: "graphs",
  },
  {
    icon: ArchiveIcon,
    label: "Backups",
    minRole: "admin" as ServerRole,
    value: "backups",
  },
  {
    icon: FolderIcon,
    label: "Files",
    minRole: "admin" as ServerRole,
    value: "files",
  },
  {
    icon: InfoIcon,
    label: "Details",
    minRole: "member" as ServerRole,
    value: "details",
  },
  {
    icon: Settings2Icon,
    label: "Settings",
    minRole: "admin" as ServerRole,
    value: "settings",
  },
  {
    icon: Users2Icon,
    label: "Team",
    minRole: "owner" as ServerRole,
    value: "team",
  },
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

const getStatusDotColor = (key: string) => {
  if (key === "running") {
    return "bg-emerald-500";
  }
  if (key === "unhealthy") {
    return "bg-amber-500";
  }
  if (["failed", "lost", "deleting"].includes(key)) {
    return "bg-red-500";
  }
  return "bg-zinc-400";
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
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

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

  const handleDeleteOpenChange = (open: boolean) => {
    setDeleteOpen(open);
    if (!open) {
      setDeleteConfirmName("");
    }
  };

  const isProvisioning = PROVISIONING_PHASES.has(server.phase);
  const game = games.find((g) => g.id === server.game);

  if (!game) {
    return null;
  }

  const deleting = server.desiredState === "deleted";
  const statusKey = deleting ? "deleting" : server.observedState;
  const statusLabel = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);

  const meta = (
    <Badge
      className={cn(
        "capitalize text-xs font-medium",
        STATE_BADGE[statusKey] ??
          "border-zinc-500/40 bg-zinc-500/10 text-zinc-500"
      )}
      variant="outline"
    >
      <span
        className={cn(
          "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
          getStatusDotColor(statusKey)
        )}
      />
      {statusLabel}
    </Badge>
  );

  const actions = (
    <div className="flex items-center gap-1.5">
      {canControl && server.observedState === "stopped" && (
        <Button
          className="gap-1.5"
          disabled={pending !== null}
          size="sm"
          onClick={() => sendCommand("START")}
        >
          <PlayIcon className="size-3.5" />
          <span className="hidden sm:inline">Start</span>
        </Button>
      )}
      {canControl && server.observedState === "running" && (
        <>
          <Button
            className="gap-1.5"
            disabled={pending !== null}
            size="sm"
            variant="outline"
            onClick={() => sendCommand("RESTART")}
          >
            <RotateCcwIcon className="size-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
          <Button
            className="gap-1.5"
            disabled={pending !== null}
            size="sm"
            variant="outline"
            onClick={() => sendCommand("STOP")}
          >
            <SquareIcon className="size-3.5" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        </>
      )}
      {pending && (
        <span className="text-xs text-muted-foreground capitalize">
          {pending.toLowerCase()}…
        </span>
      )}
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Server options"
              className="size-8"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={pending !== null || deleting}
              onSelect={() => setDeleteOpen(true)}
              variant="destructive"
            >
              <Trash2Icon />
              Delete server
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const deleteDialog = (
    <AlertDialog onOpenChange={handleDeleteOpenChange} open={deleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this server?</AlertDialogTitle>
          <AlertDialogDescription>
            Your server and all its worlds, saves and settings will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Type{" "}
            <span className="font-medium text-foreground">{server.name}</span>{" "}
            to confirm.
          </p>
          <Input
            autoComplete="off"
            placeholder={server.name}
            value={deleteConfirmName}
            onChange={(event) => setDeleteConfirmName(event.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={
              pending === "DELETE" || deleteConfirmName.trim() !== server.name
            }
            onClick={runDelete}
          >
            {pending === "DELETE" ? "Deleting..." : "Delete"}
          </AlertDialogAction>
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
          className="w-full **:data-[slot=tabs-list]:w-max **:data-[slot=tabs-trigger]:flex-none"
          value={activeTab}
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
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
                    <span className="flex items-center gap-1.5">
                      <tab.icon className="size-3.5" />
                      {tab.label}
                    </span>
                  </Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </PageHeader>
      <PageBody flush={activeTab === "console"} wide={activeTab === "console"}>
        {children}
      </PageBody>
      {deleteDialog}
    </ServerProvider>
  );
};
