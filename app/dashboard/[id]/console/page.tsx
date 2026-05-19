"use client";
import { CopyIcon, HistoryIcon, SendIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Panel, PanelCard } from "@/components/panel";
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
  const [_historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isSending, setIsSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
      setShowHistory(true);
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
          setShowHistory(false);
          return -1;
        }
        return prev;
      });
    }
  };

  const isRunning = server.observedState === "running";

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-6">
      {/* Live metrics */}
      {isRunning && (
        <Panel title="Live Metrics" className="shrink-0">
          <PanelCard>
            <LiveMetricsPanel
              maxPlayers={(server.settings?.maxPlayers as number) || undefined}
              observedState={server.observedState}
              serverId={server.id}
            />
          </PanelCard>
        </Panel>
      )}

      {/* Terminal */}
      <Panel title="Console" className="flex-1 min-h-0">
        <PanelCard className="overflow-hidden p-0 flex-1 min-h-0 flex flex-col">
          {/* Title bar */}
          <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground truncate">
                {server.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "size-2 rounded-full shrink-0",
                  isRunning ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {isRunning ? "live" : server.observedState}
              </span>
            </div>
          </div>

          {/* Log output — fills remaining height */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <LogsStream serverId={server.id} />
          </div>

          {/* History dropdown */}
          {showHistory && commandHistory.length > 0 && (
            <div className="shrink-0 border-t border-border/60 bg-muted/20 max-h-32 overflow-y-auto">
              <div className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground">
                <HistoryIcon className="size-3" />
                Recent Commands
              </div>
              <ul className="divide-y divide-border/40">
                {commandHistory.slice(0, 10).map((cmd, idx) => (
                  <li key={idx}>
                    <button
                      className="w-full px-4 py-1.5 text-left font-mono text-xs hover:bg-muted/40 transition-colors text-foreground/80"
                      onClick={() => {
                        setCommandInput(cmd);
                        setShowHistory(false);
                        setHistoryIndex(-1);
                      }}
                    >
                      {cmd}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Command input */}
          {isRunning ? (
            <div className="shrink-0 flex flex-row items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
              <span className="select-none font-mono text-sm text-emerald-500 shrink-0">
                $
              </span>
              <Input
                className="flex-1 h-8 border-0 bg-transparent font-mono text-sm shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 overflow-hidden"
                disabled={isSending}
                placeholder="Command (↑↓ history, Enter to send)"
                value={commandInput}
                onChange={(e) => {
                  setCommandInput(e.target.value);
                  setHistoryIndex(-1);
                }}
                onKeyDown={handleKeyDown}
              />
              <div className="flex gap-1">
                {commandInput && (
                  <Button
                    className="size-8 shrink-0"
                    disabled={isSending}
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await navigator.clipboard.writeText(commandInput);
                      toast.success("Copied");
                    }}
                  >
                    <CopyIcon className="size-3.5" />
                  </Button>
                )}
                <Button
                  className="size-8 shrink-0"
                  disabled={!commandInput.trim() || isSending}
                  size="icon"
                  variant="ghost"
                  onClick={() => void handleSendCommand()}
                >
                  <SendIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-t border-border/60 px-4 py-3 bg-muted/10">
              <p className="font-mono text-xs text-muted-foreground">
                Server is {server.observedState}. Start the server to send
                commands.
              </p>
            </div>
          )}
        </PanelCard>
      </Panel>
    </div>
  );
};

export default ConsoleTab;
