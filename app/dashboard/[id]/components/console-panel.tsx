"use client";
import { SendIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { sendRconCommand } from "../actions/rcon";

interface LogEntry {
  id: string;
  seq: number;
  line: string;
  stream: "stdout" | "stderr";
  ts: string;
}

interface ConsoleLogProps {
  serverId: string;
  isServerRunning: boolean;
}

/**
 * Real-time console log viewer with RCON command execution
 *
 * Features:
 * - Live log streaming via Server-Sent Events
 * - Command input with history navigation
 * - Auto-scroll to latest output
 * - Color-coded output (stdout vs stderr)
 * - Terminal-like aesthetics
 */
const getLogLineClass = (entry: LogEntry): string => {
  const baseClass =
    "font-mono text-sm px-3 py-1 whitespace-pre-wrap break-words";
  if (entry.stream === "stderr") {
    return `${baseClass} text-red-400 dark:text-red-500`;
  }
  return `${baseClass} text-green-400 dark:text-green-500`;
};

export const ConsolePanel = ({
  serverId,
  isServerRunning,
}: ConsoleLogProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number>(-1);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }, []);

  // Connect to log stream
  useEffect(() => {
    if (!isServerRunning) {
      setLogs([]);
      setIsConnected(false);
      return;
    }

    const eventSource = new EventSource(
      `/api/servers/${serverId}/logs/stream?cursor=0`
    );

    eventSource.addEventListener("log", (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => {
          // Avoid duplicates by checking seq
          if (prev.some((log) => log.seq === data.seq)) {
            return prev;
          }
          // Keep last 500 lines
          return [...prev, data].slice(-500);
        });
        scrollToBottom();
      } catch (error) {
        console.error("Failed to parse log event:", error);
      }
    });

    eventSource.addEventListener("open", () => {
      setIsConnected(true);
    });

    eventSource.addEventListener("error", () => {
      setIsConnected(false);
      eventSource.close();
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [serverId, isServerRunning, scrollToBottom]);

  const handleSendCommand = useCallback(async () => {
    if (!commandInput.trim() || !isServerRunning) {
      return;
    }

    const command = commandInput.trim();
    setCommandInput("");
    setHistoryIndex(-1);

    // Add to history
    setCommandHistory((prev) => [command, ...prev].slice(0, 50));

    setIsSending(true);
    try {
      const result = await sendRconCommand({
        command,
        serverId,
      });

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
  }, [commandInput, serverId, isServerRunning]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendCommand();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHistoryIndex((prev) => {
          const nextIndex = prev + 1;
          if (nextIndex < commandHistory.length) {
            setCommandInput(commandHistory[nextIndex]);
            return nextIndex;
          }
          return prev;
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHistoryIndex((prev) => {
          if (prev > 0) {
            const nextIndex = prev - 1;
            setCommandInput(commandHistory[nextIndex]);
            return nextIndex;
          } else if (prev === 0) {
            setCommandInput("");
            return -1;
          }
          return prev;
        });
      }
    },
    [handleSendCommand, commandHistory]
  );

  if (!isServerRunning) {
    return (
      <div className="flex h-96 flex-col gap-3 rounded-lg border border-border bg-background p-4">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            Console is only available when the server is running.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background">
      {/* Status indicator */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Log display */}
      <div className="flex-1 overflow-y-auto bg-slate-950 dark:bg-slate-900 rounded-lg p-4">
        <div className="space-y-0">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Waiting for server output...
            </p>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className={getLogLineClass(entry)}>
                {entry.line}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Command input */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Input
          className="font-mono text-sm h-9"
          disabled={isSending || !isServerRunning}
          onKeyDown={handleKeyDown}
          placeholder="Type command... (↑↓ for history)"
          value={commandInput}
          onChange={(e) => {
            setCommandInput(e.target.value);
            setHistoryIndex(-1);
          }}
        />
        <Button
          disabled={!commandInput.trim() || isSending || !isServerRunning}
          onClick={handleSendCommand}
          size="sm"
          variant="outline"
        >
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
