import "server-only";
import { prisma } from "@/lib/db";

export interface SubscriptionCheckResult {
  isValid: boolean;
  status: string;
  reason?: string;
  message?: string;
}

/**
 * Check if a server's subscription is active and eligible for paid operations.
 * Returns false if subscription is not "active" or "trialing".
 */
export const checkSubscriptionForServer = async (
  serverId: string
): Promise<SubscriptionCheckResult> => {
  const subscription = await prisma.subscription.findUnique({
    select: { status: true },
    where: { serverId },
  });

  if (!subscription) {
    return {
      isValid: false,
      message: "No subscription found for this server",
      reason: "no_subscription",
      status: "unknown",
    };
  }

  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  if (!isActive) {
    return {
      isValid: false,
      message: `Cannot perform operations while subscription is ${subscription.status}. Please update your payment method or contact support.`,
      reason: "subscription_not_active",
      status: subscription.status,
    };
  }

  return {
    isValid: true,
    status: subscription.status,
  };
};

/**
 * Get suspension status for a server based on subscription.
 * Servers are suspended if subscription is past_due for more than grace period.
 */
export const getServerSuspensionStatus = async (
  serverId: string
): Promise<{ suspended: boolean; reason?: string; suspendedAt?: Date }> => {
  const subscription = await prisma.subscription.findUnique({
    select: {
      currentPeriodEnd: true,
      status: true,
      suspendedAt: true,
    },
    where: { serverId },
  });

  if (!subscription) {
    return { suspended: false };
  }

  if (subscription.suspendedAt) {
    return {
      reason: "manually_suspended_due_to_non_payment",
      suspended: true,
      suspendedAt: subscription.suspendedAt,
    };
  }

  // Could add logic to check if past_due for > SUSPENSION_GRACE_DAYS
  // and auto-suspend here

  return { suspended: false };
};

/**
 * Require that a server's subscription is active, else throw error.
 * Useful in server actions and API routes.
 */
export const requireActiveSubscription = async (
  serverId: string
): Promise<void> => {
  const check = await checkSubscriptionForServer(serverId);
  if (!check.isValid) {
    throw new Error(
      check.message || "Subscription is not active for this operation"
    );
  }
};
