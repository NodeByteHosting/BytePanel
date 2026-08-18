import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { games } from "@/games";
import { prisma } from "@/lib/db";
import { SNAPSHOT_ENVIRONMENT } from "@/lib/env";
import { getProviderForUserWithImage } from "@/lib/providers";
import { requireServerRole } from "@/lib/rbac";
import type { ServerRole } from "@/lib/server-roles";
import { requireUser } from "@/lib/session";

import { ServerShell } from "./components/shell";

const ServerLayout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) => {
  const user = await requireUser();
  const { id } = await params;

  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  // Enforce at least viewer-level access (admins get implicit access)
  const serverRole: ServerRole = await requireServerRole(
    user.id,
    id,
    userRole,
    userSuperAdmin,
    "viewer"
  );

  // Fetch the server — allow access if user is owner or admin
  const isSystemAdmin = userSuperAdmin || userRole === "admin";
  const server = await prisma.server.findFirst({
    include: { agent: { select: { lastHeartbeatAt: true } } },
    where: {
      deletedAt: null,
      id,
      ...(isSystemAdmin
        ? {}
        : {
            OR: [
              { userId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }),
    },
  });

  if (!server) {
    notFound();
  }

  const { provider, imageId } = await getProviderForUserWithImage(
    user.id,
    SNAPSHOT_ENVIRONMENT
  );

  // Fetch catalog with fallback for missing images
  let catalog;
  try {
    catalog = await provider.getCatalog(imageId);
  } catch {
    // Image not found or catalog unavailable — use empty fallback
    catalog = { currency: "gbp", serverTypes: [] };
  }

  const serverType = catalog.serverTypes.find(
    (t) => t.name === server.serverType
  );
  const location = serverType?.locations.find(
    (l) => l.name === server.location
  );

  const specs = serverType
    ? {
        architecture: serverType.architecture,
        cores: serverType.cores,
        cpuType: serverType.cpuType,
        disk: serverType.disk,
        memory: serverType.memory,
        typeName: serverType.name,
      }
    : null;

  const locationInfo = location
    ? { city: location.city, country: location.country, name: location.name }
    : { city: null, country: null, name: server.location };

  const game = games.find((g) => g.id === server.game);
  const eligibleTypes = game
    ? catalog.serverTypes.filter(
        (t) =>
          t.memory >= game.requirements.memory &&
          t.cores >= game.requirements.cpu &&
          t.locations.some((l) => l.name === server.location && l.available)
      )
    : [];

  return (
    <ServerShell
      currency={catalog.currency}
      eligibleTypes={eligibleTypes}
      serverRole={serverRole}
      server={{
        backupsEnabled: server.backupsEnabled,
        desiredState: server.desiredState,
        dockerImage: game?.dockerImage ?? null,
        errorReason: server.errorReason,
        game: server.game,
        id: server.id,
        ipv4: server.ipv4,
        joinPassword: server.joinPassword,
        lastHeartbeatAt: server.agent?.lastHeartbeatAt?.toISOString() ?? null,
        location: locationInfo,
        name: server.name,
        observedState: server.observedState,
        phase: server.phase,
        poweredOff: server.poweredOff,
        serverType: server.serverType,
        settings: (server.settings ?? {}) as Record<string, unknown>,
        specs,
      }}
    >
      {children}
    </ServerShell>
  );
};

export default ServerLayout;
