import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

import { InviteAcceptCard } from "./accept-card";

const InvitePage = async ({
  params,
}: {
  params: Promise<{ token: string }>;
}) => {
  const { token } = await params;
  const user = await requireUser();

  const invite = await prisma.serverInvite.findUnique({
    include: {
      invitedBy: { select: { email: true, name: true } },
      server: { select: { id: true, name: true } },
    },
    where: { token },
  });

  if (!invite) {
    return (
      <InviteAcceptCard
        state="invalid"
        message="This invite link is invalid or has already been used."
      />
    );
  }

  if (invite.acceptedAt) {
    redirect(`/dashboard/${invite.serverId}`);
  }

  if (invite.expiresAt < new Date()) {
    return (
      <InviteAcceptCard
        state="expired"
        message={`This invite expired on ${invite.expiresAt.toLocaleDateString()}.`}
      />
    );
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return (
      <InviteAcceptCard
        state="mismatch"
        message={`This invite was sent to ${invite.email} but you are signed in as ${user.email}.`}
      />
    );
  }

  return (
    <InviteAcceptCard
      state="pending"
      invite={{
        expiresAt: invite.expiresAt.toISOString(),
        invitedByName: invite.invitedBy.name ?? invite.invitedBy.email,
        role: invite.role,
        serverId: invite.server.id,
        serverName: invite.server.name,
        token,
      }}
    />
  );
};

export default InvitePage;
