-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "notificationPreferences" JSONB NOT NULL DEFAULT '{}';
