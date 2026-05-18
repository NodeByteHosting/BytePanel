"use client";
import { HistoryIcon, SendIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { sendRconCommand } from "../actions/rcon";
import { LiveMetricsPanel } from "../components/live-metrics-panel";
import { LogsStream } from "../components/logs-stream";
import { useServer } from "../components/server-context";

const ConsoleTab = () => {
  const { server } = useServer();
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number>(-1);
  const [isSending, setIsSending] = useState(false);

  const handleSendCommand = async () => {
    if (!commandInput.trim() || server.observedState !== "running") {
      return;
    }

    const command = commandInput.trim();
    setCommandInput("");
    setHistoryIndex(-1);

    setCommandHistory((prev) => [command, ...prev].slice(0, 50));

    setIsSending(true);
    try {
      const result = await sendRconCommand({ command, serverId: server.id });
      if (result.ok) {
        toast.success("Command sent");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Failed to send command");
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSendCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistoryIndex((prev) => {
        const next = prev + 1;
        if (next < commandHistory.length) {
          setCommandInput(commandHistory[next]);
          return next;
        }
        return prev;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistoryIndex((prev) => {
        if (prev > 0) {
          const next = prev - 1;
          setCommandInput(commandHistory[next]);
          return next;
        } else if (prev === 0) {
          setCommandInput("");
          return -1;
        }
        return prev;
      });
    }
  };

  const isRunning = server.observedState === "running";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Live metrics — compact bar when running */}
      {isRunning && (
        <div className="shrink-0 border-b border-border/50 px-4 py-3 md:px-6">
          <LiveMetricsPanel
            maxPlayers={(server.settings?.maxPlayers as number) || undefined}
            observedState={server.observedState}
            serverId={server.id}
          />
        </div>
      )}

      {/* Terminal window */}
      <div className="flex min-h-0 flex-1 flex-col bg-zinc-950">
        {/* Terminal title bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
          <TerminalIcon className="size-3.5 text-zinc-500" />
          <span className="font-mono text-xs text-zinc-400">{server.name}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isRunning ? "bg-emerald-500" : "bg-zinc-600"
              )}
            />
            <span className="font-mono text-xs text-zinc-500">
              {isRunning ? "live" : server.observedState}
            </span>
            {commandHistory.length > 0 && (
              <span className="ml-2 flex items-center gap-1 text-xs text-zinc-600">
                <HistoryIcon className="size-3" />
                {commandHistory.length}
              </span>
            )}
          </div>
        </div>

        {/* Log output — fills remaining space */}
        <div className="min-h-0 flex-1 overflow-hidden text-zinc-100">
          <LogsStream serverId={server.id} />
        </div>

        {/* Command input */}
        {isRunning ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
            <span className="select-none font-mono text-sm text-emerald-400">
              $
            </span>
            <Input
              className="h-8 flex-1 border-0 bg-transparent font-mono text-sm text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0"
              disabled={isSending}
              placeholder="Type a command… (↑↓ history, Enter to send)"
              value={commandInput}
              onChange={(e) => {
                setCommandInput(e.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={handleKeyDown}
            />
            <Button
              className="size-8 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              disabled={!commandInput.trim() || isSending}
              size="icon"
              variant="ghost"
              onClick={() => void handleSendCommand()}
            >
              <SendIcon className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
            <p className="font-mono text-xs text-zinc-600">
              Server is {server.observedState}. Start the server to send
              commands.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsoleTab;
