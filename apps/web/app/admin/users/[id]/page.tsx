import Link from "next/link";
import { notFound } from "next/navigation";

import { Panel, PanelCard } from "@/components/panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

import {
  PageBody,
  PageHeader,
} from "../../../dashboard/components/page-header";
import { RevokeSessionButton, UserAdminActions } from "./user-admin-client";

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="text-muted-foreground py-6 text-center text-sm">
    {children}
  </div>
);

const formatDate = (date: Date | null | undefined) =>
  date ? date.toLocaleString() : "-";

const formatSignInMethods = (providers: string[], passkeys: number) =>
  [...providers, ...(passkeys > 0 ? [`${passkeys} passkey(s)`] : [])].join(
    ", "
  ) || "-";

const UserBadges = ({
  banned,
  role,
  superAdmin,
}: {
  banned: boolean | null;
  role: string | null;
  superAdmin: boolean;
}) => (
  <>
    {superAdmin ? (
      <Badge
        className="border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        variant="outline"
      >
        Super Admin
      </Badge>
    ) : (
      <Badge variant="outline">{role === "admin" ? "Admin" : "User"}</Badge>
    )}
    {banned && (
      <Badge
        className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
        variant="outline"
      >
        Banned
      </Badge>
    )}
  </>
);

const AdminManageUserPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const viewer = await requireAdmin();
  const viewerSuperAdmin =
    (viewer as { superAdmin?: boolean }).superAdmin ?? false;
  const { id } = await params;

  const now = new Date();
  const [user, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      include: {
        _count: { select: { passkeys: true, serverMemberships: true } },
        accounts: {
          orderBy: { createdAt: "asc" },
          select: { createdAt: true, id: true, providerId: true },
        },
        servers: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            memory: true,
            name: true,
            node: { select: { name: true } },
            nodeId: true,
            status: true,
          },
          where: { deletedAt: null },
        },
        sessions: {
          orderBy: { updatedAt: "desc" },
          select: {
            createdAt: true,
            expiresAt: true,
            id: true,
            impersonatedBy: true,
            ipAddress: true,
            updatedAt: true,
            userAgent: true,
          },
          where: { expiresAt: { gt: now } },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          select: {
            currency: true,
            currentPeriodEnd: true,
            id: true,
            plan: { select: { name: true } },
            priceMonthCents: true,
            provider: true,
            status: true,
          },
        },
      },
      where: { id },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        actorEmail: true,
        createdAt: true,
        id: true,
        ipAddress: true,
      },
      take: 15,
      where: { OR: [{ actorId: id }, { targetId: id, targetType: "user" }] },
    }),
  ]);
  if (!user) {
    notFound();
  }

  const isSelf = (viewer as { id?: string }).id === user.id;
  const displayName = user.name || user.email;

  return (
    <>
      <PageHeader
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">Back to users</Link>
          </Button>
        }
        meta={
          <UserBadges
            banned={user.banned}
            role={user.role}
            superAdmin={user.superAdmin}
          />
        }
        title={displayName}
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <Panel title="User Information">
            <PanelCard className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Avatar className="size-14 shrink-0 rounded-xl">
                {user.image && (
                  <AvatarImage
                    alt={displayName}
                    className="rounded-xl"
                    src={user.image}
                  />
                )}
                <AvatarFallback className="bg-muted rounded-xl text-lg font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <Row label="Email">
                  {user.email}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({user.emailVerified ? "verified" : "unverified"})
                  </span>
                </Row>
                <Row label="ID">
                  <code className="text-xs">{user.id}</code>
                </Row>
                <Row label="Joined">{formatDate(user.createdAt)}</Row>
                <Row label="Last updated">{formatDate(user.updatedAt)}</Row>
                <Row label="Sign-in methods">
                  {formatSignInMethods(
                    user.accounts.map((a) => a.providerId),
                    user._count.passkeys
                  )}
                </Row>
                <Row label="Shared server access">
                  {user._count.serverMemberships}
                </Row>
                {user.banned && (
                  <>
                    <Row label="Ban reason">{user.banReason ?? "-"}</Row>
                    <Row label="Ban expires">
                      {user.banExpires ? formatDate(user.banExpires) : "Never"}
                    </Row>
                  </>
                )}
              </div>
            </PanelCard>
          </Panel>

          <UserAdminActions
            banned={user.banned}
            displayName={displayName}
            isSelf={isSelf}
            role={user.role === "admin" ? "admin" : "user"}
            sessionIds={user.sessions.map((s) => s.id)}
            superAdmin={user.superAdmin}
            userId={user.id}
            viewerSuperAdmin={viewerSuperAdmin}
          />

          <Panel title={`Servers (${user.servers.length})`}>
            <PanelCard className="divide-border/50 divide-y p-0">
              {user.servers.length === 0 ? (
                <Empty>This user owns no servers.</Empty>
              ) : (
                user.servers.map((server) => (
                  <Link
                    className="hover:bg-muted/30 flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors"
                    href={`/admin/servers/${server.id}`}
                    key={server.id}
                  >
                    <span className="truncate font-medium">{server.name}</span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                      <span className="hidden sm:inline">
                        {server.node?.name ?? "-"}
                      </span>
                      <span className="tabular-nums">{server.memory} MiB</span>
                      <Badge variant="outline">
                        {server.status?.replaceAll("_", " ") ??
                          (server.nodeId ? "installed" : "not deployed")}
                      </Badge>
                    </span>
                  </Link>
                ))
              )}
            </PanelCard>
          </Panel>

          {user.subscriptions.length > 0 && (
            <Panel title="Subscriptions">
              <PanelCard className="divide-border/50 divide-y p-0">
                {user.subscriptions.map((sub) => (
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    key={sub.id}
                  >
                    <span className="truncate">
                      {sub.plan?.name ?? "Custom"}{" "}
                      <span className="text-muted-foreground text-xs">
                        via {sub.provider}
                      </span>
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                      <span className="tabular-nums">
                        {(sub.priceMonthCents / 100).toFixed(2)}{" "}
                        {sub.currency.toUpperCase()}/mo
                      </span>
                      <span className="hidden sm:inline">
                        Renews {formatDate(sub.currentPeriodEnd)}
                      </span>
                      <Badge variant="outline">{sub.status}</Badge>
                    </span>
                  </div>
                ))}
              </PanelCard>
            </Panel>
          )}

          <Panel title={`Active sessions (${user.sessions.length})`}>
            <PanelCard className="divide-border/50 divide-y p-0">
              {user.sessions.length === 0 ? (
                <Empty>No active sessions.</Empty>
              ) : (
                user.sessions.map((session) => (
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    key={session.id}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {session.ipAddress ?? "Unknown IP"}
                        {session.impersonatedBy && (
                          <Badge className="ml-2" variant="outline">
                            Impersonation
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {session.userAgent ?? "Unknown device"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-muted-foreground hidden text-xs sm:inline">
                        Last active {formatDate(session.updatedAt)}
                      </span>
                      {viewerSuperAdmin && (
                        <RevokeSessionButton sessionId={session.id} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </PanelCard>
          </Panel>

          <Panel
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/audit">View audit log</Link>
              </Button>
            }
            title="Recent activity"
          >
            <PanelCard className="divide-border/50 divide-y p-0">
              {auditLogs.length === 0 ? (
                <Empty>No activity recorded.</Empty>
              ) : (
                auditLogs.map((log) => (
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    key={log.id}
                  >
                    <div className="flex min-w-0 flex-col">
                      <code className="truncate text-xs">{log.action}</code>
                      <span className="text-muted-foreground truncate text-xs">
                        by {log.actorEmail ?? "system"}
                        {log.ipAddress && ` · ${log.ipAddress}`}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </PanelCard>
          </Panel>
        </div>
      </PageBody>
    </>
  );
};

export default AdminManageUserPage;
