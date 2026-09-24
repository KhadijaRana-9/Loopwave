-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "metaSyncedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);
