"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { WS_EVENTS } from "@/protocol";
import type { PowerAction, PowerState, ResourceUsage } from "@/protocol";

export interface ConsoleLine {
  id: number;
  text: string;
  kind: "console" | "install" | "daemon";
}

type SocketStatus = "connecting" | "connected" | "disconnected" | "unavailable";

interface DaemonSocketValue {
  status: SocketStatus;
  error: string | null;
  // Live power state from the daemon; "installing" while an install runs.
  state: PowerState | "installing" | null;
  stats: ResourceUsage | null;
  // Rolling history of CPU / memory samples for the graphs tab.
  history: { t: number; cpu: number; memory: number; rx: number; tx: number }[];
  lines: ConsoleLine[];
  sendCommand: (command: string) => void;
  setPower: (action: PowerAction) => void;
  clearConsole: () => void;
}

const DaemonSocketContext = createContext<DaemonSocketValue | null>(null);

export const useDaemonSocket = () => {
  const ctx = useContext(DaemonSocketContext);
  if (!ctx) {
    throw new Error("useDaemonSocket must be used within DaemonSocketProvider");
  }
  return ctx;
};

const MAX_LINES = 1000;
const MAX_HISTORY = 120;

// One websocket per server page, shared by the header, console and graphs
// (Pterodactyl's model). The panel issues a short-lived JWT; we refresh it
// before expiry and reconnect with backoff.
export const DaemonSocketProvider = ({
  serverId,
  enabled,
  children,
}: {
  serverId: string;
  enabled: boolean;
  children: ReactNode;
}) => {
  const [status, setStatus] = useState<SocketStatus>(
    enabled ? "connecting" : "unavailable"
  );
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DaemonSocketValue["state"]>(null);
  const [stats, setStats] = useState<ResourceUsage | null>(null);
  const [history, setHistory] = useState<DaemonSocketValue["history"]>([]);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const lineId = useRef(0);
  const lastNet = useRef<{ t: number; rx: number; tx: number } | null>(null);

  const pushLines = useCallback(
    (texts: string[], kind: ConsoleLine["kind"]) => {
      setLines((prev) => {
        const next = [
          ...prev,
          ...texts.map((text) => ({ id: (lineId.current += 1), kind, text })),
        ];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    },
    []
  );

  const send = useCallback((event: string, args: string[] = []) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ args, event }));
    }
  }, []);

  // Live stats sample → current usage + rolling history (with network rates).
  const recordStats = useCallback((raw: string) => {
    let usage: ResourceUsage;
    try {
      usage = JSON.parse(raw) as ResourceUsage;
    } catch {
      return;
    }
    setStats(usage);
    const now = Date.now();
    const prev = lastNet.current;
    const dt = prev ? (now - prev.t) / 1000 : 0;
    const rate = (current: number, previous: number) =>
      dt > 0 ? Math.max(0, (current - previous) / dt) : 0;
    const rx = prev ? rate(usage.network.rxBytes, prev.rx) : 0;
    const tx = prev ? rate(usage.network.txBytes, prev.tx) : 0;
    lastNet.current = {
      rx: usage.network.rxBytes,
      t: now,
      tx: usage.network.txBytes,
    };
    if (usage.state !== "offline") {
      setHistory((h) =>
        [
          ...h,
          { cpu: usage.cpuAbsolute, memory: usage.memoryBytes, rx, t: now, tx },
        ].slice(-MAX_HISTORY)
      );
    }
  }, []);

  // Events that don't depend on the connection lifecycle.
  const handleEvent = useCallback(
    (event: string, arg: string) => {
      switch (event) {
        case WS_EVENTS.STATUS: {
          setState(arg as DaemonSocketValue["state"]);
          break;
        }
        case WS_EVENTS.CONSOLE_OUTPUT: {
          pushLines(
            [arg],
            arg.includes("[NodeByte Daemon]") ? "daemon" : "console"
          );
          break;
        }
        case WS_EVENTS.INSTALL_OUTPUT: {
          pushLines([arg], "install");
          break;
        }
        case WS_EVENTS.INSTALL_STARTED: {
          setState("installing");
          break;
        }
        case WS_EVENTS.INSTALL_COMPLETED: {
          setState("offline");
          pushLines(
            [
              arg === "success"
                ? "Installation completed."
                : "Installation failed.",
            ],
            "daemon"
          );
          break;
        }
        case WS_EVENTS.STATS: {
          recordStats(arg);
          break;
        }
        case WS_EVENTS.JWT_ERROR:
        case WS_EVENTS.DAEMON_ERROR: {
          setError(arg || "Daemon error");
          break;
        }
        default: {
          break;
        }
      }
    },
    [pushLines, recordStats]
  );

  useEffect(() => {
    if (!enabled) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchToken = async () => {
      const res = await fetch(`/api/servers/${serverId}/websocket`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { token: string; socket: string };
    };

    const reauth = async () => {
      try {
        const { token } = await fetchToken();
        send(WS_EVENTS.AUTH, [token]);
      } catch (error_) {
        setError(
          error_ instanceof Error ? error_.message : "Token refresh failed"
        );
      }
    };

    // Assigned below; declared first because connect and scheduleRetry
    // reference each other.
    let connect: () => Promise<void> = () => Promise.resolve();

    const scheduleRetry = () => {
      if (cancelled) {
        return;
      }
      attempt += 1;
      setStatus("disconnected");
      retryTimer = setTimeout(
        () => {
          connect();
        },
        Math.min(30_000, 1000 * 2 ** attempt)
      );
    };

    connect = async () => {
      setStatus("connecting");
      let details: { token: string; socket: string };
      try {
        details = await fetchToken();
      } catch (error_) {
        setError(
          error_ instanceof Error ? error_.message : "Unable to connect"
        );
        scheduleRetry();
        return;
      }
      if (cancelled) {
        return;
      }
      const ws = new WebSocket(details.socket);
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({ args: [details.token], event: WS_EVENTS.AUTH })
        );
      });

      ws.addEventListener("message", (message) => {
        let frame: { event: string; args?: string[] };
        try {
          frame = JSON.parse(String(message.data));
        } catch {
          return;
        }
        const arg = frame.args?.[0] ?? "";
        if (frame.event === WS_EVENTS.AUTH_SUCCESS) {
          attempt = 0;
          setError(null);
          setStatus("connected");
          if (lineId.current === 0) {
            send(WS_EVENTS.SEND_LOGS);
          }
        } else if (
          frame.event === WS_EVENTS.TOKEN_EXPIRING ||
          frame.event === WS_EVENTS.TOKEN_EXPIRED
        ) {
          reauth();
        } else {
          handleEvent(frame.event, arg);
        }
      });

      ws.addEventListener("close", () => {
        if (socketRef.current === ws) {
          socketRef.current = null;
        }
        if (!cancelled) {
          setStatus("disconnected");
          scheduleRetry();
        }
      });
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, handleEvent, send, serverId]);

  const value = useMemo<DaemonSocketValue>(
    () => ({
      clearConsole: () => setLines([]),
      error,
      history,
      lines,
      sendCommand: (command) => send(WS_EVENTS.SEND_COMMAND, [command]),
      setPower: (action) => send(WS_EVENTS.SET_STATE, [action]),
      state,
      stats,
      status,
    }),
    [error, history, lines, send, state, stats, status]
  );

  return (
    <DaemonSocketContext.Provider value={value}>
      {children}
    </DaemonSocketContext.Provider>
  );
};
