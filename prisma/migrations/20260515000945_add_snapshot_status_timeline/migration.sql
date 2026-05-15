-- AlterTable
ALTER TABLE "snapshot_builds" ADD COLUMN     "statusTimeline" JSONB NOT NULL DEFAULT '{}';
