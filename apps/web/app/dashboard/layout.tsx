import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

import { AppContainer } from "./components/app-container";
import { AppSidebar } from "./components/app-sidebar";
import type { SidebarHealth, SidebarServer } from "./components/app-sidebar";
import { ImpersonationBanner } from "./components/impersonation-banner";

const serverSelect = {
  egg: { select: { image: true, name: true } },
  id: true,
  name: true,
  nodeId: true,
  status: true,
} as const;

const healthOf = (server: {
  nodeId: string | null;
  status: string | null;
}): SidebarHealth => {
  if (
    !server.nodeId ||
    server.status === "installing" ||
    server.status === "restoring_backup"
  ) {
    return "pending";
  }
  return server.status ? "issue" : "ready";
};

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  const { user } = session;

  const role = (user as { role?: string }).role ?? "user";
  const superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  const impersonatorId =
    (session.session as { impersonatedBy?: string | null }).impersonatedBy ??
    null;

  const ownedServers = await prisma.server.findMany({
    orderBy: { createdAt: "desc" },
    select: serverSelect,
    where: { deletedAt: null, userId: user.id },
  });

  const memberships = await prisma.serverMember.findMany({
    include: {
      server: {
        select: { ...serverSelect, deletedAt: true },
      },
    },
    where: { userId: user.id },
  });

  const memberServers = memberships
    .filter((m) => m.server.deletedAt === null)
    .map((m) => m.server);

  const ownedIds = new Set(ownedServers.map((s) => s.id));
  const servers: SidebarServer[] = [
    ...ownedServers,
    ...memberServers.filter((s) => !ownedIds.has(s.id)),
  ].map((s) => ({
    gameImage: s.egg?.image ?? null,
    gameName: s.egg?.name ?? null,
    health: healthOf(s),
    id: s.id,
    name: s.name,
  }));

  return (
    <SidebarProvider className="bg-sidebar h-svh">
      <AppSidebar
        servers={servers}
        user={{
          email: user.email,
          hasImage: Boolean(user.image),
          name: user.name ?? null,
          role,
          superAdmin,
        }}
      />
      <AppContainer>
        {impersonatorId && (
          <ImpersonationBanner
            impersonatedEmail={user.email}
            impersonatedName={user.name ?? null}
          />
        )}
        {children}
      </AppContainer>
    </SidebarProvider>
  );
};

export default DashboardLayout;
