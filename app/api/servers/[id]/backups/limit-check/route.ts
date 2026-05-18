import { prisma } from "@/lib/db";
import { ADDON_DEFAULTS } from "@/lib/pricing";
import { requireUser } from "@/lib/session";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await requireUser();
  const { id: serverId } = await params;

  // Verify server ownership
  const server = await prisma.server.findFirst({
    select: { id: true },
    where: { id: serverId, userId: user.id },
  });

  if (!server) {
    return Response.json({ error: "Server not found" }, { status: 404 });
  }

  // Get subscription + addons
  const subscription = await prisma.subscription.findUnique({
    select: {
      addons: {
        where: { type: "backup" },
      },
      status: true,
    },
    where: { serverId },
  });

  if (!subscription) {
    return Response.json(
      { error: "No subscription for server" },
      { status: 404 }
    );
  }

  // Check if subscription is active (required to create backups)
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  if (!isActive) {
    return Response.json(
      {
        allowed: false,
        message: `Cannot create backups while subscription is ${subscription.status}`,
        reason: "subscription_not_active",
      },
      { status: 402 }
    );
  }

  // Get addon for backups
  const [backupAddon] = subscription.addons;
  const freeAllowance =
    backupAddon?.freeAllowance ?? ADDON_DEFAULTS.backup.freeAllowance;
  const totalPurchased = backupAddon?.quantity ?? freeAllowance;

  // For MVP: assume 1 backup per allowance
  // In the future, fetch actual backup count from Hetzner API
  const estimatedUsed = Math.min(1, freeAllowance);
  const allowedTotal = totalPurchased;
  const canCreateMore = estimatedUsed < allowedTotal;

  return Response.json(
    {
      allowed: canCreateMore,
      costPerExtraBackup: ADDON_DEFAULTS.backup.pricePerExtraUnitCents,
      estimatedUsed,
      freeAllowance,
      nextBackupWouldCost: canCreateMore
        ? 0
        : ADDON_DEFAULTS.backup.pricePerExtraUnitCents,
      remainingAllowance: allowedTotal - estimatedUsed,
      totalAllowed: allowedTotal,
    },
    { status: 200 }
  );
};
