-- Drop tables and columns left over from the one-VPS-per-server model:
-- per-user snapshot builds and Hetzner hourly usage billing. Neither is read
-- or written since the nodes/eggs migration. legacy_vps_servers and
-- system_snapshots (still read by lib/providers) are kept.
-- DropForeignKey
ALTER TABLE "snapshot_builds" DROP CONSTRAINT "snapshot_builds_userId_fkey";

-- DropForeignKey
ALTER TABLE "usage_invoices" DROP CONSTRAINT "usage_invoices_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "hourlyRateMilliCents",
DROP COLUMN "usageBillingStartedAt",
DROP COLUMN "usageLastBilledAt";

-- DropTable
DROP TABLE "snapshot_builds";

-- DropTable
DROP TABLE "usage_invoices";

-- DropEnum
DROP TYPE "SnapshotBuildStatus";

