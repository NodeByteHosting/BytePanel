-- AlterTable
ALTER TABLE "panel_settings" DROP COLUMN "landingPage";

-- CreateTable
CREATE TABLE "sftp_credentials" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sftp_credentials_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "sftp_credentials" ADD CONSTRAINT "sftp_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

