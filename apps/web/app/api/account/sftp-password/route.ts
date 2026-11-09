import { hashPassword } from "better-auth/crypto";
import { NextResponse } from "next/server";

import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateSftpPassword } from "@/lib/sftp";

export const runtime = "nodejs";

export const POST = async () => {
  const user = await requireUser();
  const password = generateSftpPassword();
  const passwordHash = await hashPassword(password);
  await prisma.sftpCredential.upsert({
    create: { passwordHash, userId: user.id },
    update: { passwordHash },
    where: { userId: user.id },
  });
  await logEvent({
    action: "account.sftp_password_changed",
    actorEmail: user.email,
    actorId: user.id,
    targetId: user.id,
    targetType: "user",
  });
  return NextResponse.json(
    { password },
    { headers: { "Cache-Control": "no-store" } }
  );
};
