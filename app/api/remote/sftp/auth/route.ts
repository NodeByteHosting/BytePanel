import type { Node } from "@prisma/client";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { redis } from "@/lib/redis";
import { parseJson, remoteHandler } from "@/lib/remote/handler";
import { meetsMinServerRole } from "@/lib/server-roles";
import type { ServerRole } from "@/lib/server-roles";
import { parseSftpUsername } from "@/lib/sftp";
import { REDIS_KEYS, sftpAuthRequestSchema } from "@/protocol";
import type { SftpAuthResponse } from "@/protocol";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_MINUTE = 10;

const denied = (message = "Invalid credentials") =>
  NextResponse.json({ error: message }, { status: 403 });

// Verified against when the account doesn't exist, so unknown emails take as
// long to reject as wrong passwords.
let dummyHash: Promise<string> | null = null;

const checkPassword = async (
  userId: string | null,
  password: string
): Promise<boolean> => {
  const account = userId
    ? await prisma.account.findFirst({
        select: { password: true },
        where: { providerId: "credential", userId },
      })
    : null;
  if (!account?.password) {
    dummyHash ??= hashPassword("nodebyte-sftp-dummy");
    await verifyPassword({ hash: await dummyHash, password });
    return false;
  }
  return verifyPassword({ hash: account.password, password });
};

interface SftpUser {
  id: string;
  role: string;
  superAdmin: boolean;
}

const roleOn = (
  user: SftpUser,
  server: { userId: string; members: { role: string }[] }
): ServerRole | null => {
  if (server.userId === user.id) {
    return "owner";
  }
  if (user.superAdmin || user.role === "admin") {
    return "admin";
  }
  return (server.members[0]?.role as ServerRole | undefined) ?? null;
};

// Servers on this node the user may manage files on (server role "admin"+,
// the same requirement as the file manager), optionally narrowed to one id.
const manageableServers = async (
  node: Node,
  user: SftpUser,
  serverId: string | null
) => {
  const servers = await prisma.server.findMany({
    select: {
      id: true,
      members: { select: { role: true }, where: { userId: user.id } },
      status: true,
      userId: true,
      uuid: true,
    },
    where: {
      deletedAt: null,
      nodeId: node.id,
      ...(serverId ? { uuid: { startsWith: serverId } } : {}),
    },
  });
  return servers.filter((server) => {
    const role = roleOn(user, server);
    return role !== null && meetsMinServerRole(role, "admin");
  });
};

// Resolves one reading of the username. Null = no such account, try the next.
const login = async (
  node: Node,
  candidate: { email: string; serverId: string | null },
  password: string,
  ip: string | null
): Promise<Response | null> => {
  const user = await prisma.user.findUnique({
    select: {
      banExpires: true,
      banned: true,
      id: true,
      role: true,
      superAdmin: true,
    },
    where: { email: candidate.email },
  });
  if (!user) {
    return null;
  }
  if (!(await checkPassword(user.id, password))) {
    return denied();
  }
  if (user.banned && (!user.banExpires || user.banExpires > new Date())) {
    return denied("Account is banned");
  }
  const servers = await manageableServers(node, user, candidate.serverId);
  if (servers.length !== 1) {
    return denied(
      servers.length === 0
        ? "No server you can manage files on matches this username"
        : "You have several servers on this node; use <email>.<server id>"
    );
  }
  const [server] = servers;
  if (!server || server.status === "suspended") {
    return denied("Server is suspended");
  }
  await emitActivity({
    actorId: user.id,
    ip,
    message: "Logged in over SFTP",
    phase: "server:sftp.login",
    serverId: server.id,
    source: "daemon",
  });
  return NextResponse.json({
    serverUuid: server.uuid,
    userUuid: user.id,
  } satisfies SftpAuthResponse);
};

// Called by the daemon for every SFTP login.
export const POST = remoteHandler(async ({ node, request }) => {
  const body = await parseJson(request, sftpAuthRequestSchema);
  if ("response" in body) {
    return body.response;
  }
  const { ip, password, username } = body.data;

  const attemptsKey = REDIS_KEYS.sftpAuthAttempts(ip ?? username);
  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) {
    await redis.expire(attemptsKey, 60);
  }
  if (attempts > MAX_ATTEMPTS_PER_MINUTE) {
    return NextResponse.json(
      { error: "Too many login attempts" },
      { status: 429 }
    );
  }

  let response: Response | null = null;
  for (const candidate of parseSftpUsername(username)) {
    // oxlint-disable-next-line no-await-in-loop -- at most two readings, tried in order
    response = await login(node, candidate, password, ip);
    if (response) {
      break;
    }
  }
  if (response?.ok) {
    await redis.del(attemptsKey);
  }
  if (response) {
    return response;
  }

  await checkPassword(null, password);
  return denied();
});
