import type { ServerWebSocket } from "bun";

import { websocketClaimsSchema, wsFrameSchema, WS_EVENTS } from "../../../protocol";
import type { DaemonPermission, PowerAction, WebsocketClaims } from "../../../protocol";
import type { Config } from "../config";
import { errorMessage, logger } from "../log";

const log = logger("websocket");
import type { ActivityBuffer } from "../panel";
import type { Server } from "../server/server";
import { TokenError, verifyPanelJwt } from "./auth";

export interface SocketData {
  server: Server;
  ip: string | null;
  claims: (WebsocketClaims & { exp: number }) | null;
  unsubscribe: (() => void) | null;
  expiryTimers: ReturnType<typeof setTimeout>[];
}

const POWER_PERMISSION: Record<PowerAction, DaemonPermission> = {
  kill: "control.stop",
  restart: "control.restart",
  start: "control.start",
  stop: "control.stop",
};

// Events only delivered to sockets holding the given permission.
const GATED_EVENTS: Record<string, DaemonPermission> = {
  [WS_EVENTS.INSTALL_OUTPUT]: "admin.websocket.install",
  [WS_EVENTS.INSTALL_STARTED]: "admin.websocket.install",
  [WS_EVENTS.INSTALL_COMPLETED]: "admin.websocket.install",
};

const send = (ws: ServerWebSocket<SocketData>, event: string, ...args: string[]) => {
  ws.send(JSON.stringify({ args, event }));
};

const can = (ws: ServerWebSocket<SocketData>, permission: DaemonPermission) =>
  ws.data.claims?.permissions.includes(permission) ?? false;

const clearExpiry = (ws: ServerWebSocket<SocketData>) => {
  for (const timer of ws.data.expiryTimers) {
    clearTimeout(timer);
  }
  ws.data.expiryTimers = [];
};

const authenticate = async (
  ws: ServerWebSocket<SocketData>,
  token: string,
  config: Config,
) => {
  const claims = await verifyPanelJwt(token, config, websocketClaimsSchema);
  if (claims.serverUuid !== ws.data.server.uuid || !claims.permissions.includes("websocket.connect")) {
    throw new TokenError("token is not valid for this server");
  }
  const firstAuth = ws.data.unsubscribe === null;
  ws.data.claims = claims;
  clearExpiry(ws);
  const msLeft = claims.exp * 1000 - Date.now();
  ws.data.expiryTimers.push(
    setTimeout(() => send(ws, WS_EVENTS.TOKEN_EXPIRING), Math.max(0, msLeft - 60_000)),
    setTimeout(() => {
      ws.data.claims = null;
      send(ws, WS_EVENTS.TOKEN_EXPIRED);
    }, Math.max(0, msLeft)),
  );

  send(ws, WS_EVENTS.AUTH_SUCCESS);
  if (firstAuth) {
    ws.data.unsubscribe = ws.data.server.subscribe((event, payload) => {
      if (!ws.data.claims) {
        return;
      }
      const gate = GATED_EVENTS[event];
      if (gate && !can(ws, gate)) {
        return;
      }
      send(ws, event, payload);
    });
  }
  send(ws, WS_EVENTS.STATUS, ws.data.server.installing ? "installing" : ws.data.server.state);
  send(ws, WS_EVENTS.STATS, JSON.stringify(await ws.data.server.resourceUsage()));
};

export const websocketHandlers = (config: Config, activity: ActivityBuffer) => ({
  close: (ws: ServerWebSocket<SocketData>) => {
    clearExpiry(ws);
    ws.data.unsubscribe?.();
  },
  idleTimeout: 120,
  maxPayloadLength: 16 * 1024,
  message: async (ws: ServerWebSocket<SocketData>, raw: string | Buffer) => {
    const parsed = wsFrameSchema.safeParse(
      (() => {
        try {
          return JSON.parse(String(raw));
        } catch {
          return null;
        }
      })(),
    );
    if (!parsed.success) {
      return;
    }
    const { event, args = [] } = parsed.data;
    const { server } = ws.data;

    try {
      if (event === WS_EVENTS.AUTH) {
        await authenticate(ws, args[0] ?? "", config);
        return;
      }
      if (!ws.data.claims) {
        send(ws, WS_EVENTS.JWT_ERROR, "authenticate first");
        return;
      }
      const userUuid = ws.data.claims.userUuid;

      switch (event) {
        case WS_EVENTS.SET_STATE: {
          const action = args[0] as PowerAction;
          if (!(action in POWER_PERMISSION) || !can(ws, POWER_PERMISSION[action])) {
            send(ws, WS_EVENTS.DAEMON_ERROR, "permission denied");
            return;
          }
          activity.push({
            event: `server:power.${action}`,
            ip: ws.data.ip,
            serverUuid: server.uuid,
            userUuid,
          });
          await server.power(action);
          return;
        }
        case WS_EVENTS.SEND_COMMAND: {
          if (!can(ws, "control.console")) {
            send(ws, WS_EVENTS.DAEMON_ERROR, "permission denied");
            return;
          }
          const command = (args[0] ?? "").slice(0, 2048);
          if (!command) {
            return;
          }
          await server.sendCommand(command);
          activity.push({
            event: "server:console.command",
            ip: ws.data.ip,
            metadata: { command },
            serverUuid: server.uuid,
            userUuid,
          });
          return;
        }
        case WS_EVENTS.SEND_LOGS: {
          if (server.state === "offline") {
            return;
          }
          for (const line of await server.recentLogs(100)) {
            send(ws, WS_EVENTS.CONSOLE_OUTPUT, line);
          }
          return;
        }
        case WS_EVENTS.SEND_STATS: {
          send(ws, WS_EVENTS.STATS, JSON.stringify(await server.resourceUsage()));
          return;
        }
        default: {
          return;
        }
      }
    } catch (error) {
      if (error instanceof TokenError) {
        send(ws, WS_EVENTS.JWT_ERROR, error.message);
        return;
      }
      log.warn(`${event} on ${server.uuid} failed`, error);
      send(
        ws,
        WS_EVENTS.DAEMON_ERROR,
        can(ws, "admin.websocket.errors") ? errorMessage(error) : "An unexpected error occurred.",
      );
    }
  },
  open: (ws: ServerWebSocket<SocketData>) => {
    // Client must send {"event":"auth","args":[token]} within 10s.
    setTimeout(() => {
      if (!ws.data.claims && ws.readyState === 1) {
        ws.close(4001, "authentication timeout");
      }
    }, 10_000);
  },
});
