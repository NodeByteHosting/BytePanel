import { NextResponse } from "next/server";
import { ulid } from "ulid";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendServerInviteEmail, sendServerMemberAddedEmail } from "@/lib/mail";
import { requireServerRole } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

// 7 days
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "member", "admin"]),
});

// GET /api/servers/[id]/members — list members + pending invites
export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: serverId } = await params;
  const user = await requireUser();
  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  await requireServerRole(
    user.id,
    serverId,
    userRole,
    userSuperAdmin,
    "viewer"
  );

  const [members, invites] = await Promise.all([
    prisma.serverMember.findMany({
      include: {
        user: { select: { email: true, id: true, image: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      where: { serverId },
    }),
    prisma.serverInvite.findMany({
      orderBy: { createdAt: "desc" },
      where: { acceptedAt: null, expiresAt: { gt: new Date() }, serverId },
    }),
  ]);

  // Also return the server owner
  const server = await prisma.server.findUnique({
    select: {
      user: { select: { email: true, id: true, image: true, name: true } },
    },
    where: { id: serverId },
  });

  return NextResponse.json({ invites, members, owner: server?.user ?? null });
};

// POST /api/servers/[id]/members — invite by email
export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: serverId } = await params;
  const user = await requireUser();
  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  // Only owner (or system admin) can invite
  await requireServerRole(user.id, serverId, userRole, userSuperAdmin, "owner");

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, role } = parsed.data;

  // Check if they're already a member
  const existingUser = await prisma.user.findUnique({
    select: { id: true },
    where: { email },
  });

  if (existingUser) {
    // Check if already a member
    const existing = await prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: existingUser.id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This user is already a member of this server." },
        { status: 409 }
      );
    }

    // Check if they're the owner
    const server = await prisma.server.findUnique({
      select: { userId: true },
      where: { id: serverId },
    });
    if (server?.userId === existingUser.id) {
      return NextResponse.json(
        { error: "This user is already the owner." },
        { status: 409 }
      );
    }

    // Directly add as member (no invite needed — they already have an account)
    const member = await prisma.serverMember.create({
      data: {
        id: ulid(),
        invitedById: user.id,
        role,
        serverId,
        userId: existingUser.id,
      },
      include: {
        user: { select: { email: true, id: true, image: true, name: true } },
      },
    });

    // Notify the added user by email (fire-and-forget)
    const [serverInfo, inviter] = await Promise.all([
      prisma.server.findUnique({
        select: { name: true },
        where: { id: serverId },
      }),
      prisma.user.findUnique({
        select: { email: true, name: true },
        where: { id: user.id },
      }),
    ]);
    const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/u, "");
    void sendServerMemberAddedEmail({
      addedByName: inviter?.name ?? inviter?.email ?? "Someone",
      role,
      serverName: serverInfo?.name ?? "a server",
      serverUrl: `${baseUrl}/dashboard/${serverId}`,
      toEmail: member.user.email,
    });

    return NextResponse.json({ member, type: "added" }, { status: 201 });
  }

  // User doesn't exist yet — create a pending invite
  // Cancel any existing pending invite for this email
  await prisma.serverInvite.deleteMany({
    where: { email, serverId },
  });

  const token = ulid();
  const invite = await prisma.serverInvite.create({
    data: {
      email,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      id: ulid(),
      invitedById: user.id,
      role,
      serverId,
      token,
    },
  });

  // Fetch server name + inviter display name for the email
  const [server, inviter] = await Promise.all([
    prisma.server.findUnique({
      select: { name: true },
      where: { id: serverId },
    }),
    prisma.user.findUnique({
      select: { email: true, name: true },
      where: { id: user.id },
    }),
  ]);

  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/u, "");
  const acceptUrl = `${baseUrl}/invite/${token}`;

  // Fire-and-forget — email failures must not block the response
  void sendServerInviteEmail({
    acceptUrl,
    expiresAt: invite.expiresAt.toISOString(),
    invitedByName: inviter?.name ?? inviter?.email ?? "Someone",
    role,
    serverName: server?.name ?? "a server",
    toEmail: email,
  });

  return NextResponse.json({ invite, type: "invited" }, { status: 201 });
};
