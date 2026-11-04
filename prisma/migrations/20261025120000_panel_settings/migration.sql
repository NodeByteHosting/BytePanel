-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('panel', 'whmcs', 'blesta', 'paymenter');

-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "panel_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "panelName" TEXT NOT NULL DEFAULT 'NodeByte',
    "logoUrl" TEXT,
    "logoImage" BYTEA,
    "logoMime" TEXT,
    "websiteUrl" TEXT,
    "supportUrl" TEXT,
    "landingPage" BOOLEAN NOT NULL DEFAULT true,
    "billingMode" "BillingMode" NOT NULL DEFAULT 'panel',
    "storeUrl" TEXT,
    "billingApiKeyHash" TEXT,
    "billingApiKeyHint" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servers_externalId_key" ON "servers"("externalId");
