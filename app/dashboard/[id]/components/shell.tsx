"use client";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArchiveIcon,
  BarChart2Icon,
  FolderIcon,
  GamepadIcon,
  InfoIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlayIcon,
  RotateCcwIcon,
  Settings2Icon,
  SkullIcon,
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ServerRole } from "@/lib/server-roles";
import { meetsMinServerRole } from "@/lib/server-roles";
import { cn } from "@/lib/utils";
import type { PowerAction } from "@/protocol";

import { PageBody, PageHeader } from "../../components/page-header";
import { deleteServer } from "../actions/delete";
import { sendPowerAction } from "../actions/power";
import { DaemonSocketProvider, useDaemonSocket } from "./daemon-socket";
import { ServerProvider } from "./server-context";
import type { ServerView } from "./server-context";

const TONE = {
  bad: "border-red-500/40 bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  busy: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  idle: "border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400",
} as const;

const DOT: Record<keyof typeof TONE, string> = {
  bad: "bg-red-500",
  busy: "bg-amber-500",
  good: "bg-emerald-500",
  idle: "bg-zinc-400",
};

const ALL_TABS = [
  {
    icon: LayoutDashboardIcon,
    label: "Overview",
    minRole: "viewer",
    value: "connect",
  },
  { icon: TerminalIcon, label: "Console", minRole: "viewer", value: "console" },
  { icon: BarChart2Icon, label: "Graphs", minRole: "viewer", value: "graphs" },
  {
    icon: ActivityIcon,
    label: "Activity",
    minRole: "viewer",
    value: "activity",
  },
  { icon: FolderIcon, label: "Files", minRole: "admin", value: "files" },
  { icon: ArchiveIcon, label: "Backups", minRole: "admin", value: "backups" },
  { icon: InfoIcon, label: "Details", minRole: "member", value: "details" },
  {
    icon: Settings2Icon,
    label: "Startup",
    minRole: "admin",
    value: "settings",
  },
  { icon: Users2Icon, label: "Team", minRole: "owner", value: "team" },
] as const satisfies readonly {
  icon: unknown;
  label: string;
  minRole: ServerRole;
  value: string;
}[];

interface Props {
  server: ServerView;
  serverRole: ServerRole;
  children: ReactNode;
}

// Combines the panel-side status with the daemon's live power state.
const useStatus = (
  server: ServerView
): { label: string; tone: keyof typeof TONE } => {
  const socket = useDaemonSocket();
  if (!server.deployed) {
    if (server.errorReason?.startsWith("Legacy")) {
      return { label: "Legacy", tone: "idle" };
    }
    return server.status === "install_failed"
      ? { label: "Deployment failed", tone: "bad" }
      : { label: "Awaiting deployment", tone: "busy" };
  }
  if (socket.state === "installing" || server.status === "installing") {
    return { label: "Installing", tone: "busy" };
  }
  switch (server.status) {
    case "install_failed":
    case "reinstall_failed": {
      return { label: "Install failed", tone: "bad" };
    }
    case "suspended": {
      return { label: "Suspended", tone: "bad" };
    }
    case "restoring_backup": {
      return { label: "Restoring backup", tone: "busy" };
    }
    default: {
      break;
    }
  }
  if (socket.status === "connecting" && !socket.state) {
    return { label: "Connecting", tone: "idle" };
  }
  if (socket.status === "disconnected" && !socket.state) {
    return { label: "Node unreachable", tone: "bad" };
  }
  switch (socket.state) {
    case "running": {
      return { label: "Running", tone: "good" };
    }
    case "starting": {
      return { label: "Starting", tone: "busy" };
    }
    case "stopping": {
      return { label: "Stopping", tone: "busy" };
    }
    default: {
      return { label: "Offline", tone: "idle" };
    }
  }
};

const ServerActions = ({
  server,
  canControl,
  canDelete,
  onDelete,
}: {
  server: ServerView;
  canControl: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) => {
  const socket = useDaemonSocket();
  const [pending, setPending] = useState<PowerAction | null>(null);
  const blocked =
    !server.deployed ||
    server.status === "suspended" ||
    server.status === "installing";

  const power = async (action: PowerAction) => {
    if (socket.status === "connected") {
      socket.setPower(action);
      return;
    }
    setPending(action);
    const result = await sendPowerAction({ action, serverId: server.id });
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
    }
  };

  const state = socket.state ?? "offline";
  return (
    <div className="flex items-center gap-1.5">
      {canControl && !blocked && state === "offline" && (
        <Button
          className="gap-1.5"
          disabled={pending !== null}
          size="sm"
          onClick={() => power("start")}
        >
          <PlayIcon className="size-3.5" />
          <span className="hidden sm:inline">Start</span>
        </Button>
      )}
      {canControl &&
        !blocked &&
        state !== "offline" &&
        state !== "installing" && (
          <>
            <Button
              className="gap-1.5"
              disabled={pending !== null || state === "stopping"}
              size="sm"
              variant="outline"
              onClick={() => power("restart")}
            >
              <RotateCcwIcon className="size-3.5" />
              <span className="hidden sm:inline">Restart</span>
            </Button>
            {state === "stopping" ? (
              <Button
                className="gap-1.5"
                size="sm"
                variant="destructive"
                onClick={() => power("kill")}
              >
                <SkullIcon className="size-3.5" />
                <span className="hidden sm:inline">Kill</span>
              </Button>
            ) : (
              <Button
                className="gap-1.5"
                disabled={pending !== null}
                size="sm"
                variant="outline"
                onClick={() => power("stop")}
              >
                <SquareIcon className="size-3.5" />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            )}
          </>
        )}
      {pending && (
        <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
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
            {canControl && server.deployed && (
              <>
                <DropdownMenuItem onSelect={() => power("kill")}>
                  <SkullIcon />
                  Force kill
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={onDelete} variant="destructive">
              <Trash2Icon />
              Delete server
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const StatusBadge = ({ server }: { server: ServerView }) => {
  const { label, tone } = useStatus(server);
  return (
    <Badge className={cn("text-xs font-medium", TONE[tone])} variant="outline">
      <span
        className={cn(
          "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
          DOT[tone]
        )}
      />
      {label}
    </Badge>
  );
};

const NotDeployedNotice = ({ server }: { server: ServerView }) => {
  const legacy = server.errorReason?.startsWith("Legacy");
  let title = "Your server is being deployed.";
  if (legacy) {
    title = "This server runs on a dedicated VPS from the previous platform.";
  } else if (server.status === "install_failed") {
    title = "We couldn't place this server on a node.";
  }
  return (
    <Panel>
      <PanelCard className="flex items-start gap-3 text-sm">
        {server.status === "install_failed" || legacy ? (
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
        ) : (
          <Loader2Icon className="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin" />
        )}
        <div className="flex flex-col gap-1">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground">
            {legacy
              ? "Contact support to migrate it onto a NodeByte node."
              : (server.errorReason ??
                "Once payment is confirmed it is placed on a node and installed automatically. This page updates when it's ready.")}
          </p>
        </div>
      </PanelCard>
    </Panel>
  );
};

const InstallBanner = ({ server }: { server: ServerView }) => {
  const socket = useDaemonSocket();
  const installing =
    socket.state === "installing" || server.status === "installing";
  const failed =
    server.status === "install_failed" || server.status === "reinstall_failed";
  if (!installing && !failed && server.status !== "suspended") {
    return null;
  }
  let message = "This server is suspended. Contact support for help.";
  if (installing) {
    message =
      "The server is installing. Install output appears in the console.";
  } else if (failed) {
    message =
      "The install script failed. Check the console output, then reinstall from the Startup tab.";
  }
  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        installing ? TONE.busy : TONE.bad
      )}
    >
      {installing ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <AlertTriangleIcon className="size-4" />
      )}
      {message}
    </div>
  );
};

export const ServerShell = ({
  server: initial,
  serverRole,
  children,
}: Props) => {
  const canControl = meetsMinServerRole(serverRole, "member");
  const canDelete = meetsMinServerRole(serverRole, "owner");
  const visibleTabs = ALL_TABS.filter((t) =>
    meetsMinServerRole(serverRole, t.minRole)
  );
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const activeTab =
    segment && ALL_TABS.some((tab) => tab.value === segment)
      ? segment
      : "connect";
  const [server, setServer] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const updateServer = (patch: Partial<ServerView>) =>
    setServer((prev) => ({ ...prev, ...patch }));

  // Server-rendered props change on router.refresh(); keep local state in step.
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setServer(initial);
  }

  // While deploying / installing, re-fetch the panel-side status periodically.
  const transitional =
    !server.deployed ||
    server.status === "installing" ||
    server.status === "restoring_backup";
  useEffect(() => {
    if (!transitional) {
      return;
    }
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router, transitional]);

  const runDelete = async () => {
    setDeleting(true);
    const result = await deleteServer({ serverId: server.id });
    setDeleting(false);
    if (result.ok) {
      router.push("/dashboard");
    } else {
      toast.error(result.error);
    }
  };

  const gameIcon = server.game?.image ? (
    <Image
      alt={server.game.name}
      className="size-10 rounded-lg object-cover"
      height={40}
      src={server.game.image}
      width={40}
    />
  ) : (
    <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
      <GamepadIcon className="size-5" />
    </div>
  );

  const actions = (
    <ServerActions
      canControl={canControl}
      canDelete={canDelete}
      onDelete={() => setDeleteOpen(true)}
      server={server}
    />
  );

  const deleteDialog = (
    <AlertDialog
      onOpenChange={(open) => {
        setDeleteOpen(open);
        if (!open) {
          setDeleteConfirmName("");
        }
      }}
      open={deleteOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this server?</AlertDialogTitle>
          <AlertDialogDescription>
            Your server and all its worlds, saves, files and backups will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Type{" "}
            <span className="text-foreground font-medium">{server.name}</span>{" "}
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
            disabled={deleting || deleteConfirmName.trim() !== server.name}
            onClick={runDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <ServerProvider value={{ server, updateServer }}>
      <DaemonSocketProvider enabled={server.deployed} serverId={server.id}>
        <PageHeader
          actions={actions}
          flush={server.deployed}
          icon={gameIcon}
          meta={<StatusBadge server={server} />}
          title={server.name}
        >
          {server.deployed && (
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
          )}
        </PageHeader>
        <PageBody
          flush={activeTab === "console"}
          wide={activeTab === "console"}
        >
          {server.deployed ? (
            <>
              <InstallBanner server={server} />
              {children}
            </>
          ) : (
            <NotDeployedNotice server={server} />
          )}
        </PageBody>
        {deleteDialog}
      </DaemonSocketProvider>
    </ServerProvider>
  );
};
