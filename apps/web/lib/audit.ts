import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "./db";

export type AuditAction =
  | "account.signup"
  | "account.signin"
  | "account.signout"
  | "account.password_changed"
  | "account.email_changed"
  | "account.passkey_added"
  | "account.passkey_removed"
  | "server.create"
  | "server.delete"
  | "server.start"
  | "server.stop"
  | "server.restart"
  | "server.settings_changed"
  | "server.member_invited"
  | "server.member_removed"
  | "server.member_role_changed"
  | "admin.user.ban"
  | "admin.user.unban"
  | "admin.user.set_role"
  | "admin.user.set_super_admin"
  | "admin.user.impersonate"
  | "admin.user.delete"
  | "admin.server.create"
  | "admin.server.delete"
  | "admin.server.suspend"
  | "admin.server.unsuspend"
  | "admin.server.reinstall"
  | "admin.server.build_changed"
  | "admin.location.create"
  | "admin.location.delete"
  | "admin.node.create"
  | "admin.node.update"
  | "admin.node.reset_token"
  | "admin.node.delete"
  | "admin.allocation.create"
  | "admin.allocation.delete"
  | "admin.nest.create"
  | "admin.nest.delete"
  | "admin.egg.sync"
  | "admin.egg.import"
  | "admin.egg.update"
  | "admin.egg.delete"
  | "admin.plan.create"
  | "admin.plan.update"
  | "admin.plan.delete"
  | "admin.email.test_sent"
  | "admin.email.broadcast_sent"
  | "admin.session.revoked"
  | "admin.settings.branding_changed"
  | "admin.settings.billing_changed"
  | "admin.settings.api_key_generated"
  | "admin.settings.api_key_revoked"
  | "application.user.create"
  | "application.server.create"
  | "application.server.suspend"
  | "application.server.unsuspend"
  | "application.server.change_plan"
  | "application.server.login_link"
  | "application.server.terminate";

export interface LogEventOptions {
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetId?: string | null;
  targetType?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const logEvent = async (opts: LogEventOptions): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        actorEmail: opts.actorEmail ?? null,
        actorId: opts.actorId ?? null,
        ipAddress: opts.ipAddress ?? null,
        metadata: (opts.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        targetId: opts.targetId ?? null,
        targetType: opts.targetType ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to write audit log:", error);
  }
};

export const getRequestIp = (req: Request): string | null => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return null;
};
