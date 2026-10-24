"use client";
import {
  CpuIcon,
  HardDriveIcon,
  MemoryStickIcon,
  SendIcon,
  TerminalIcon,
  TimerIcon,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

import { Panel, PanelCard } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes, formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ConsoleOutput } from "../components/console-output";
import { useDaemonSocket } from "../components/daemon-socket";
import { useServer } from "../components/server-context";

const Stat = ({
  icon: Icon,
  label,
  value,
  limit,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  limit?: string;
}) => (
  <div className="border-border/60 bg-card flex items-center gap-3 rounded-lg border px-3 py-2">
    <Icon className="text-muted-foreground size-4 shrink-0" />
    <div className="flex min-w-0 flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate font-mono text-sm">
        {value}
        {limit && <span className="text-muted-foreground"> / {limit}</span>}
      </span>
    </div>
  </div>
);

const ConsoleTab = () => {
  const { server } = useServer();
  const socket = useDaemonSocket();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const state = socket.state ?? "offline";
  const canSend =
    socket.status === "connected" &&
    (state === "running" || state === "starting");
  const { stats } = socket;
  const mib = 1024 * 1024;

  const submit = () => {
    const command = input.trim();
    if (!command || !canSend) {
      return;
    }
    socket.sendCommand(command);
    setHistory((prev) =>
      [command, ...prev.filter((c) => c !== command)].slice(0, 50)
    );
    setHistoryIndex(-1);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      if (next >= 0) {
        setHistoryIndex(next);
        setInput(history[next] ?? "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(Math.max(next, -1));
      setInput(next >= 0 ? (history[next] ?? "") : "");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          icon={CpuIcon}
          label="CPU"
          limit={server.limits.cpu > 0 ? `${server.limits.cpu}%` : undefined}
          value={
            stats && state !== "offline"
              ? `${stats.cpuAbsolute.toFixed(1)}%`
              : "—"
          }
        />
        <Stat
          icon={MemoryStickIcon}
          label="Memory"
          limit={
            server.limits.memory > 0
              ? formatBytes(server.limits.memory * mib)
              : undefined
          }
          value={
            stats && state !== "offline" ? formatBytes(stats.memoryBytes) : "—"
          }
        />
        <Stat
          icon={HardDriveIcon}
          label="Disk"
          limit={
            server.limits.disk > 0
              ? formatBytes(server.limits.disk * mib)
              : undefined
          }
          value={stats ? formatBytes(stats.diskBytes) : "—"}
        />
        <Stat
          icon={TimerIcon}
          label="Uptime"
          value={
            stats && state !== "offline"
              ? formatUptime(stats.uptimeMs)
              : "Offline"
          }
        />
      </div>

      <Panel className="min-h-0 flex-1" title="Console">
        <PanelCard className="flex min-h-[24rem] flex-1 flex-col overflow-hidden p-0">
          <div className="border-border/60 bg-muted/40 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <TerminalIcon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="text-muted-foreground truncate font-mono text-xs">
                {server.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  socket.status === "connected"
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/40"
                )}
              />
              <span className="text-muted-foreground font-mono text-xs">
                {socket.status === "connected" ? state : socket.status}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-zinc-950">
            <ConsoleOutput
              lines={socket.lines}
              placeholder={
                socket.status === "connected"
                  ? "Waiting for output…"
                  : (socket.error ?? "Connecting to the node…")
              }
            />
          </div>

          <div className="border-border/60 bg-muted/20 flex shrink-0 flex-row items-center gap-2 border-t px-3 py-2">
            <span className="shrink-0 font-mono text-sm text-emerald-500 select-none">
              $
            </span>
            <Input
              className="placeholder:text-muted-foreground/50 h-8 flex-1 overflow-hidden border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
              disabled={!canSend}
              placeholder={
                canSend
                  ? "Type a command… (↑↓ history)"
                  : `Server is ${state}. Start it to send commands.`
              }
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={onKeyDown}
            />
            <Button
              aria-label="Send command"
              className="size-8 shrink-0"
              disabled={!canSend || !input.trim()}
              size="icon"
              variant="ghost"
              onClick={submit}
            >
              <SendIcon className="size-3.5" />
            </Button>
          </div>
        </PanelCard>
      </Panel>
    </div>
  );
};

export default ConsoleTab;
