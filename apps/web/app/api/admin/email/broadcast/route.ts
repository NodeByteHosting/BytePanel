import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp, logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { requireSuperAdmin } from "@/lib/session";

const schema = z.object({
  audience: z.enum(["all", "admins"]),
  body: z.string().min(1),
  subject: z.string().min(1),
});

// POST /api/admin/email/broadcast — superAdmin only
export const POST = async (req: Request) => {
  const actor = await requireSuperAdmin();
  const actorId = (actor as { id?: string }).id ?? null;
  const actorEmail = (actor as { email?: string }).email ?? null;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { subject, body: bodyText, audience } = parsed.data;

  const users = await prisma.user.findMany({
    select: { email: true, name: true },
    where:
      audience === "admins"
        ? { OR: [{ role: "admin" }, { superAdmin: true }] }
        : {},
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, sans-serif; color: #e5e5e5; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #111; border: 1px solid #222; border-radius: 12px; overflow: hidden; }
    .header { background: #161616; padding: 28px 36px 22px; border-bottom: 1px solid #222; }
    .logo { font-size: 17px; font-weight: 700; color: #fff; }
    .logo span { color: #7c3aed; }
    .body { padding: 32px 36px; font-size: 14px; line-height: 1.65; color: #a3a3a3; white-space: pre-wrap; }
    .footer { padding: 18px 36px; background: #0d0d0d; font-size: 11px; color: #404040; text-align: center; }
    .footer a { color: #525252; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><div class="logo">{{logo}}</div></div>
    <div class="body">${bodyText.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} {{panelName}} &mdash;
      <a href="{{websiteUrl}}">{{websiteHost}}</a> &mdash;
      <a href="{{supportUrl}}">Support</a>
    </div>
  </div>
</body>
</html>`.trim();

  // Send individually so one failure doesn't block the rest
  const results = await Promise.allSettled(
    users.map((u) => sendMail({ html, subject, text: bodyText, to: u.email }))
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && r.value
  ).length;
  const failed = users.length - sent;

  await logEvent({
    action: "admin.email.broadcast_sent",
    actorEmail,
    actorId,
    ipAddress: getRequestIp(req),
    metadata: { audience, failed, recipientCount: users.length, sent, subject },
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ failed, sent, total: users.length });
};
