-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "ServerMemberRole" AS ENUM ('viewer', 'member', 'admin');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('installing', 'install_failed', 'reinstall_failed', 'suspended', 'restoring_backup');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "superAdmin" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkeys" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

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
    "daemonSftp" INTEGER NOT NULL DEFAULT 2022,
    "daemonBase" TEXT NOT NULL DEFAULT '/var/lib/bytepanel/volumes',
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
    "locationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ServerStatus",
    "nodeId" TEXT,
    "eggId" TEXT,
    "planId" TEXT,
    "externalId" TEXT,
    "allocationId" TEXT,
    "memory" INTEGER NOT NULL,
    "swap" INTEGER NOT NULL DEFAULT 0,
    "disk" INTEGER NOT NULL,
    "io" INTEGER NOT NULL DEFAULT 500,
    "cpu" INTEGER NOT NULL,
    "threads" TEXT,
    "oomDisabled" BOOLEAN NOT NULL DEFAULT true,
    "backupLimit" INTEGER NOT NULL DEFAULT 0,
    "allocationLimit" INTEGER NOT NULL DEFAULT 1,
    "startup" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "skipScripts" BOOLEAN NOT NULL DEFAULT false,
    "installedAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "lastSuspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "server_members" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ServerMemberRole" NOT NULL DEFAULT 'member',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_invites" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ServerMemberRole" NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'server',
    "actorId" TEXT,
    "ip" TEXT,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "panelName" TEXT NOT NULL DEFAULT 'BytePanel',
    "logoUrl" TEXT,
    "logoImage" BYTEA,
    "logoMime" TEXT,
    "websiteUrl" TEXT,
    "supportUrl" TEXT,
    "landingPage" BOOLEAN NOT NULL DEFAULT true,
    "storeUrl" TEXT,
    "billingApiKeyHash" TEXT,
    "billingApiKeyHint" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "passkeys_userId_idx" ON "passkeys"("userId");

-- CreateIndex
CREATE INDEX "passkeys_credentialID_idx" ON "passkeys"("credentialID");

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
CREATE UNIQUE INDEX "servers_uuid_key" ON "servers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "servers_externalId_key" ON "servers"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "servers_allocationId_key" ON "servers"("allocationId");

-- CreateIndex
CREATE INDEX "servers_userId_idx" ON "servers"("userId");

-- CreateIndex
CREATE INDEX "servers_nodeId_idx" ON "servers"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "backups_uuid_key" ON "backups"("uuid");

-- CreateIndex
CREATE INDEX "backups_serverId_idx" ON "backups"("serverId");

-- CreateIndex
CREATE INDEX "server_members_userId_idx" ON "server_members"("userId");

-- CreateIndex
CREATE INDEX "server_members_serverId_idx" ON "server_members"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "server_members_serverId_userId_key" ON "server_members"("serverId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "server_invites_token_key" ON "server_invites"("token");

-- CreateIndex
CREATE INDEX "server_invites_email_idx" ON "server_invites"("email");

-- CreateIndex
CREATE INDEX "server_invites_token_idx" ON "server_invites"("token");

-- CreateIndex
CREATE INDEX "activity_events_serverId_occurredAt_idx" ON "activity_events"("serverId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "activity_events_serverId_seq_key" ON "activity_events"("serverId", "seq");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_targetId_targetType_idx" ON "audit_logs"("targetId", "targetType");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "servers" ADD CONSTRAINT "servers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_invites" ADD CONSTRAINT "server_invites_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_invites" ADD CONSTRAINT "server_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

