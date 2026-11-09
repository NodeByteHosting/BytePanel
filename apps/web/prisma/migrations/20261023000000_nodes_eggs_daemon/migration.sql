-- Pterodactyl-style architecture: shared nodes running the NodeByte daemon,
-- locations/allocations, nests/eggs, plans and node-local backups. Replaces the
-- one-VPS-per-server agent model.

-- Preserve everything needed to find and clean up legacy per-server VPSes
-- (and their game settings) before the columns are dropped.
CREATE TABLE "legacy_vps_servers" AS
SELECT "id", "userId", "name", "game", "location", "serverType", "provider",
       "providerServerId", "ipv4", "rconPassword", "joinPassword", "settings",
       "observedState"::text AS "observedState", "createdAt", "deletedAt"
FROM "servers";

ALTER TABLE "legacy_vps_servers" ADD CONSTRAINT "legacy_vps_servers_pkey" PRIMARY KEY ("id");

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('installing', 'install_failed', 'reinstall_failed', 'suspended', 'restoring_backup');

-- DropForeignKey
ALTER TABLE "agents" DROP CONSTRAINT "agents_serverId_fkey";

-- DropForeignKey
ALTER TABLE "agent_errors" DROP CONSTRAINT "agent_errors_agentId_fkey";

-- DropForeignKey
ALTER TABLE "agent_errors" DROP CONSTRAINT "agent_errors_serverId_fkey";

-- DropForeignKey
ALTER TABLE "agent_enrollments" DROP CONSTRAINT "agent_enrollments_serverId_fkey";

-- DropForeignKey
ALTER TABLE "commands" DROP CONSTRAINT "commands_serverId_fkey";

-- DropForeignKey
ALTER TABLE "log_chunks" DROP CONSTRAINT "log_chunks_serverId_fkey";

-- DropIndex
DROP INDEX "servers_providerServerId_key";

-- DropIndex
DROP INDEX "servers_desiredState_observedState_idx";

-- AlterTable
ALTER TABLE "servers" DROP COLUMN "backupsEnabled",
DROP COLUMN "desiredState",
DROP COLUMN "game",
DROP COLUMN "ipv4",
DROP COLUMN "joinPassword",
DROP COLUMN "location",
DROP COLUMN "observedState",
DROP COLUMN "phase",
DROP COLUMN "poweredOff",
DROP COLUMN "provider",
DROP COLUMN "providerServerId",
DROP COLUMN "rconPassword",
DROP COLUMN "serverType",
DROP COLUMN "settings",
ADD COLUMN     "allocationId" TEXT,
ADD COLUMN     "allocationLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "backupLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cpu" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "disk" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eggId" TEXT,
ADD COLUMN     "image" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "installedAt" TIMESTAMP(3),
ADD COLUMN     "io" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "memory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nodeId" TEXT,
ADD COLUMN     "oomDisabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "skipScripts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startup" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" "ServerStatus",
ADD COLUMN     "swap" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "threads" TEXT,
ADD COLUMN     "uuid" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Drop the backfill defaults
ALTER TABLE "servers" ALTER COLUMN "cpu" DROP DEFAULT;
ALTER TABLE "servers" ALTER COLUMN "disk" DROP DEFAULT;
ALTER TABLE "servers" ALTER COLUMN "image" DROP DEFAULT;
ALTER TABLE "servers" ALTER COLUMN "memory" DROP DEFAULT;
ALTER TABLE "servers" ALTER COLUMN "startup" DROP DEFAULT;
ALTER TABLE "servers" ALTER COLUMN "uuid" DROP DEFAULT;

-- Legacy servers have no node; flag them so the UI can explain.
UPDATE "servers" SET "errorReason" = 'Legacy VPS server: re-deploy on a node to manage it here.' WHERE "nodeId" IS NULL AND "deletedAt" IS NULL;

-- AlterTable
ALTER TABLE "activity_events" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "ip" TEXT;

-- DropTable
DROP TABLE "agents";

-- DropTable
DROP TABLE "agent_errors";

-- DropTable
DROP TABLE "agent_enrollments";

-- DropTable
DROP TABLE "commands";

-- DropTable
DROP TABLE "log_chunks";

-- DropEnum
DROP TYPE "DesiredState";

-- DropEnum
DROP TYPE "ObservedState";

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "long" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "locationId" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "fqdn" TEXT NOT NULL,
    "scheme" TEXT NOT NULL DEFAULT 'https',
    "behindProxy" BOOLEAN NOT NULL DEFAULT false,
    "daemonListen" INTEGER NOT NULL DEFAULT 8080,
    "daemonBase" TEXT NOT NULL DEFAULT '/var/lib/nodebyte/volumes',
    "memory" INTEGER NOT NULL,
    "memoryOverallocate" INTEGER NOT NULL DEFAULT 0,
    "disk" INTEGER NOT NULL,
    "diskOverallocate" INTEGER NOT NULL DEFAULT 0,
    "uploadSize" INTEGER NOT NULL DEFAULT 100,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "daemonTokenId" TEXT NOT NULL,
    "daemonToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ipAlias" TEXT,
    "port" INTEGER NOT NULL,
    "notes" TEXT,
    "serverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "author" TEXT NOT NULL DEFAULT 'support@nodebyte.co.uk',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eggs" (
    "id" TEXT NOT NULL,
    "nestId" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "author" TEXT NOT NULL DEFAULT 'support@nodebyte.co.uk',
    "image" TEXT,
    "dockerImages" JSONB NOT NULL,
    "startup" TEXT NOT NULL DEFAULT '',
    "configStartupDone" JSONB NOT NULL DEFAULT '[]',
    "configStop" TEXT NOT NULL DEFAULT '^C',
    "configFiles" JSONB NOT NULL DEFAULT '[]',
    "fileDenylist" JSONB NOT NULL DEFAULT '[]',
    "features" JSONB NOT NULL DEFAULT '[]',
    "mountPath" TEXT NOT NULL DEFAULT '/home/container',
    "extraMounts" JSONB NOT NULL DEFAULT '[]',
    "containerUser" TEXT NOT NULL DEFAULT 'daemon',
    "volumeOwner" TEXT,
    "invocationMode" TEXT NOT NULL DEFAULT 'env',
    "containerPorts" JSONB NOT NULL DEFAULT '[]',
    "stripAnsi" BOOLEAN NOT NULL DEFAULT false,
    "scriptContainer" TEXT NOT NULL DEFAULT 'ghcr.io/pterodactyl/installers:debian',
    "scriptEntry" TEXT NOT NULL DEFAULT 'bash',
    "scriptInstall" TEXT NOT NULL DEFAULT '',
    "minMemory" INTEGER NOT NULL DEFAULT 0,
    "minDisk" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eggs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_variables" (
    "id" TEXT NOT NULL,
    "eggId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "envVariable" TEXT NOT NULL,
    "defaultValue" TEXT NOT NULL DEFAULT '',
    "userViewable" BOOLEAN NOT NULL DEFAULT true,
    "userEditable" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT NOT NULL DEFAULT 'nullable|string',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egg_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_variables" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "memory" INTEGER NOT NULL,
    "disk" INTEGER NOT NULL,
    "cpu" INTEGER NOT NULL,
    "swap" INTEGER NOT NULL DEFAULT 0,
    "io" INTEGER NOT NULL DEFAULT 500,
    "backupLimit" INTEGER NOT NULL DEFAULT 2,
    "allocationLimit" INTEGER NOT NULL DEFAULT 1,
    "priceMonthCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "locationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ignoredFiles" TEXT NOT NULL DEFAULT '',
    "isSuccessful" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "checksum" TEXT,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_short_key" ON "locations"("short");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_uuid_key" ON "nodes"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_daemonTokenId_key" ON "nodes"("daemonTokenId");

-- CreateIndex
CREATE INDEX "nodes_locationId_idx" ON "nodes"("locationId");

-- CreateIndex
CREATE INDEX "allocations_serverId_idx" ON "allocations"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_nodeId_ip_port_key" ON "allocations"("nodeId", "ip", "port");

-- CreateIndex
CREATE UNIQUE INDEX "nests_name_key" ON "nests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "eggs_slug_key" ON "eggs"("slug");

-- CreateIndex
CREATE INDEX "eggs_nestId_idx" ON "eggs"("nestId");

-- CreateIndex
CREATE UNIQUE INDEX "egg_variables_eggId_envVariable_key" ON "egg_variables"("eggId", "envVariable");

-- CreateIndex
CREATE UNIQUE INDEX "server_variables_serverId_variableId_key" ON "server_variables"("serverId", "variableId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "backups_uuid_key" ON "backups"("uuid");

-- CreateIndex
CREATE INDEX "backups_serverId_idx" ON "backups"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "servers_uuid_key" ON "servers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "servers_allocationId_key" ON "servers"("allocationId");

-- CreateIndex
CREATE INDEX "servers_nodeId_idx" ON "servers"("nodeId");

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_nestId_fkey" FOREIGN KEY ("nestId") REFERENCES "nests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_variables" ADD CONSTRAINT "egg_variables_eggId_fkey" FOREIGN KEY ("eggId") REFERENCES "eggs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_variables" ADD CONSTRAINT "server_variables_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_variables" ADD CONSTRAINT "server_variables_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES "egg_variables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_eggId_fkey" FOREIGN KEY ("eggId") REFERENCES "eggs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

