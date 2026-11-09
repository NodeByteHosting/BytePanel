import { arch, platform, release } from "node:os";
import { availableParallelism } from "node:os";
import { join } from "node:path";

import type { Server as BunServer } from "bun";
import { z } from "zod";

import {
  backupCreateRequestSchema,
  backupRestoreRequestSchema,
  commandsRequestSchema,
  createServerRequestSchema,
  fileTransferClaimsSchema,
  filesCompressRequestSchema,
  filesCreateDirectoryRequestSchema,
  filesDecompressRequestSchema,
  filesDeleteRequestSchema,
  filesPullRequestSchema,
  filesRenameRequestSchema,
  powerRequestSchema,
} from "@nodebyte/protocol";
import type { DaemonServerDetails, SystemInfo } from "@nodebyte/protocol";
import type { Config } from "../config";
import { COMMIT, VERSION } from "../config";
import type { Docker } from "../docker";
import { errorMessage, logger } from "../log";
import type { Backups } from "../server/backups";
import { FilesystemError } from "../server/filesystem";
import type { ServerManager } from "../server/manager";
import type { Server } from "../server/server";
import { ServerError } from "../server/server";
import type { SftpServer } from "../sftp";
import { checkBearer, TokenError, verifyPanelJwt } from "./auth";
import type { SocketData } from "./websocket";

const log = logger("http");

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { headers, status });

const noContent = (headers: Record<string, string> = {}) => new Response(null, { headers, status: 204 });

const parseBody = async <T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return parsed.data;
};

interface Deps {
  config: Config;
  docker: Docker;
  manager: ServerManager;
  backups: Backups;
  sftp: SftpServer | null;
}

const details = async (server: Server): Promise<DaemonServerDetails> => ({
  isInstalling: server.installing,
  isSuspended: server.config.suspended,
  utilization: await server.resourceUsage(),
  uuid: server.uuid,
});

export const createFetchHandler = (deps: Deps) => {
  const { config, docker, manager, backups, sftp } = deps;
  const panelOrigin = new URL(config.remote).origin;
  const allowedOrigins = new Set([panelOrigin, ...config.allowedOrigins]);

  const cors = (req: Request): Record<string, string> => {
    const origin = req.headers.get("origin");
    if (!origin || !allowedOrigins.has(origin)) {
      return {};
    }
    return {
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-origin": origin,
      "access-control-max-age": "7200",
      vary: "origin",
    };
  };

  const requireServer = (uuid: string): Server => {
    const server = manager.get(uuid);
    if (!server) {
      throw new HttpError(404, "server not found on this node");
    }
    return server;
  };

  // Routes reached by the browser with a panel-issued, short-lived JWT.
  const transferRoutes = async (req: Request, url: URL): Promise<Response | null> => {
    const token = url.searchParams.get("token");
    if (!token) {
      throw new HttpError(401, "missing token");
    }
    const claims = await verifyPanelJwt(token, config, fileTransferClaimsSchema);
    const server = requireServer(claims.serverUuid);

    if (req.method === "GET" && url.pathname === "/download/file" && claims.kind === "download") {
      const { file, name } = await server.fs.fileForDownload(claims.path);
      return new Response(file, {
        headers: {
          ...cors(req),
          "content-disposition": `attachment; filename="${name.replaceAll('"', "")}"`,
          "content-type": "application/octet-stream",
        },
      });
    }
    if (req.method === "GET" && url.pathname === "/download/backup" && claims.kind === "backup") {
      const file = Bun.file(backups.file(claims.path));
      if (!(await file.exists())) {
        throw new HttpError(404, "backup not found");
      }
      return new Response(file, {
        headers: {
          ...cors(req),
          "content-disposition": `attachment; filename="backup-${claims.path}.tar.gz"`,
          "content-type": "application/gzip",
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/upload/file" && claims.kind === "upload") {
      const form = await req.formData();
      const files = form
        .getAll("files")
        .filter((f) => typeof f !== "string") as unknown as (Blob & { name: string })[];
      if (files.length === 0) {
        throw new HttpError(400, "no files supplied");
      }
      const limit = config.api.uploadLimitMb * 1024 * 1024;
      for (const file of files) {
        if (file.size > limit) {
          throw new HttpError(413, `${file.name} exceeds the ${config.api.uploadLimitMb} MiB upload limit`);
        }
        await server.fs.write(join(claims.path, file.name), file);
      }
      return noContent(cors(req));
    }
    throw new HttpError(403, "token does not permit this action");
  };

  const serverRoutes = async (
    req: Request,
    url: URL,
    uuid: string,
    rest: string,
  ): Promise<Response> => {
    const method = req.method;
    if (rest === "" && method === "GET") {
      return json(await details(requireServer(uuid)));
    }
    if (rest === "" && method === "DELETE") {
      sftp?.disconnect(uuid);
      await manager.remove(uuid);
      return noContent();
    }
    const server = requireServer(uuid);
    const q = url.searchParams;

    switch (`${method} ${rest}`) {
      case "GET /logs": {
        const size = Math.min(Number(q.get("size") ?? 100) || 100, 1000);
        return json({ data: await server.recentLogs(size) });
      }
      case "POST /power": {
        const { action } = await parseBody(req, powerRequestSchema);
        // Power actions can take minutes; acknowledge immediately like Wings.
        void server.power(action).catch((error) => log.warn(`power ${action} on ${uuid} failed`, error));
        return noContent();
      }
      case "POST /commands": {
        const { commands } = await parseBody(req, commandsRequestSchema);
        for (const command of commands) {
          await server.sendCommand(command);
        }
        return noContent();
      }
      case "POST /sync": {
        await server.syncConfiguration();
        if (server.config.suspended) {
          sftp?.disconnect(uuid);
        }
        if (server.config.suspended && server.state !== "offline") {
          await server.power("kill");
        }
        return noContent();
      }
      case "POST /reinstall": {
        if (server.installing) {
          throw new HttpError(409, "server is already installing");
        }
        await server.syncConfiguration();
        void server.install(true);
        return new Response(null, { status: 202 });
      }
      case "GET /files/list-directory": {
        return json(await server.fs.list(q.get("directory") ?? "/"));
      }
      case "GET /files/contents": {
        const file = await server.fs.readForEditor(q.get("file") ?? "");
        return new Response(file, { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      case "POST /files/write": {
        const file = q.get("file");
        if (!file) {
          throw new HttpError(400, "file query parameter is required");
        }
        await server.fs.write(file, await req.arrayBuffer());
        return noContent();
      }
      case "POST /files/delete": {
        const body = await parseBody(req, filesDeleteRequestSchema);
        await server.fs.delete(body.root, body.files);
        return noContent();
      }
      case "PUT /files/rename": {
        const body = await parseBody(req, filesRenameRequestSchema);
        await server.fs.rename(body.root, body.files);
        return noContent();
      }
      case "POST /files/create-directory": {
        const body = await parseBody(req, filesCreateDirectoryRequestSchema);
        await server.fs.createDirectory(body.path, body.name);
        return noContent();
      }
      case "POST /files/pull": {
        const body = await parseBody(req, filesPullRequestSchema);
        return json(await server.fs.pull(body));
      }
      case "POST /files/compress": {
        const body = await parseBody(req, filesCompressRequestSchema);
        return json({ name: await server.fs.compress(body.root, body.files) });
      }
      case "POST /files/decompress": {
        const body = await parseBody(req, filesDecompressRequestSchema);
        await server.fs.decompress(body.root, body.file);
        return noContent();
      }
      case "POST /backup": {
        const body = await parseBody(req, backupCreateRequestSchema);
        backups.create(server, body.uuid, body.ignore);
        return new Response(null, { status: 202 });
      }
      default: {
        break;
      }
    }

    const backupMatch = /^\/backup\/([0-9a-f-]{36})(\/restore)?$/u.exec(rest);
    if (backupMatch) {
      const [, backupUuid = "", restore] = backupMatch;
      if (method === "DELETE" && !restore) {
        await backups.remove(backupUuid);
        return noContent();
      }
      if (method === "POST" && restore) {
        const body = await parseBody(req, backupRestoreRequestSchema);
        await backups.restore(server, backupUuid, body.truncateDirectory);
        return new Response(null, { status: 202 });
      }
    }
    throw new HttpError(404, "route not found");
  };

  return async (req: Request, bun: BunServer<SocketData>): Promise<Response | undefined> => {
    const url = new URL(req.url);
    try {
      if (req.method === "OPTIONS") {
        return noContent(cors(req));
      }

      // Browser websocket: auth happens inside the socket via the "auth" event.
      const ws = /^\/api\/servers\/([0-9a-f-]{36})\/ws$/u.exec(url.pathname);
      if (ws && req.method === "GET") {
        const origin = req.headers.get("origin");
        if (origin && !allowedOrigins.has(origin)) {
          throw new HttpError(403, "origin not allowed");
        }
        const server = requireServer(ws[1] ?? "");
        const upgraded = bun.upgrade(req, {
          data: {
            claims: null,
            expiryTimers: [],
            ip: bun.requestIP(req)?.address ?? null,
            server,
            unsubscribe: null,
          },
        });
        if (upgraded) {
          return undefined;
        }
        throw new HttpError(400, "websocket upgrade failed");
      }

      if (url.pathname.startsWith("/download/") || url.pathname.startsWith("/upload/")) {
        const res = await transferRoutes(req, url);
        if (res) {
          return res;
        }
      }

      if (!url.pathname.startsWith("/api/")) {
        throw new HttpError(404, "route not found");
      }
      if (!checkBearer(req, config)) {
        throw new HttpError(401, "invalid or missing bearer token");
      }

      if (url.pathname === "/api/system" && req.method === "GET") {
        const info: SystemInfo = {
          architecture: arch(),
          commit: COMMIT,
          cpuCount: availableParallelism(),
          dockerVersion: await docker.version(),
          kernelVersion: release(),
          os: platform(),
          version: VERSION,
        };
        return json(info);
      }
      if (url.pathname === "/api/servers" && req.method === "GET") {
        return json({ data: await Promise.all(manager.all().map(details)) });
      }
      if (url.pathname === "/api/servers" && req.method === "POST") {
        const body = await parseBody(req, createServerRequestSchema);
        await manager.create(body.uuid, body.startOnCompletion);
        return new Response(null, { status: 202 });
      }

      const match = /^\/api\/servers\/([0-9a-f-]{36})(\/.*)?$/u.exec(url.pathname);
      if (match) {
        return await serverRoutes(req, url, match[1] ?? "", match[2] ?? "");
      }
      throw new HttpError(404, "route not found");
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof TokenError
            ? 401
            : error instanceof FilesystemError || error instanceof ServerError
              ? error.status
              : error instanceof z.ZodError
                ? 422
                : 500;
      if (status >= 500) {
        log.error(`${req.method} ${url.pathname} failed`, error);
      }
      return json({ error: errorMessage(error) }, status, cors(req));
    }
  };
};
