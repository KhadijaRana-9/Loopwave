-- CreateEnum
CREATE TYPE "OptInStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TemplateHeaderType" AS ENUM ('NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT');

-- AlterEnum
ALTER TYPE "TemplateStatus" ADD VALUE 'PAUSED';

-- AlterEnum
ALTER TYPE "WhatsAppNumberStatus" ADD VALUE 'REAUTHORIZATION_REQUIRED';

-- AlterTable: Contact — add the tri-state column, backfill it from the old
-- boolean (true -> OPTED_IN, false -> OPTED_OUT, this preserves every
-- explicit signal that already existed), then drop the boolean.
ALTER TABLE "Contact" ADD COLUMN "whatsappOptIn" "OptInStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Contact" ADD COLUMN "optInSource" TEXT;
ALTER TABLE "Contact" ADD COLUMN "optOutAt" TIMESTAMP(3);

UPDATE "Contact" SET "whatsappOptIn" = CASE
  WHEN "optedIn" = true THEN 'OPTED_IN'::"OptInStatus"
  WHEN "optedIn" = false THEN 'OPTED_OUT'::"OptInStatus"
  ELSE 'UNKNOWN'::"OptInStatus"
END;

ALTER TABLE "Contact" DROP COLUMN "optedIn";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "headerMediaMetaId" TEXT,
ADD COLUMN     "headerMediaMimeType" TEXT,
ADD COLUMN     "headerMediaUrl" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mediaFileName" TEXT,
ADD COLUMN     "mediaMimeType" TEXT,
ADD COLUMN     "mediaSizeBytes" INTEGER,
ADD COLUMN     "metaMediaId" TEXT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "buttons" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "footer" TEXT,
ADD COLUMN     "header" TEXT,
ADD COLUMN     "headerType" "TemplateHeaderType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "rejectedReason" TEXT;

-- AlterTable: WhatsAppAccount — appSecretCipher/verifyToken/isDemoMode were
-- dead columns (confirmed zero reads in application code: app secret and
-- webhook verify token are single app-level secrets already read from env
-- vars, not per-tenant; isDemoMode was superseded by the per-number status
-- enum). No backfill needed, nothing in the app ever read them.
ALTER TABLE "WhatsAppAccount" DROP COLUMN "appSecretCipher",
DROP COLUMN "isDemoMode",
DROP COLUMN "verifyToken",
ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WhatsAppPhoneNumber" ADD COLUMN     "verifiedName" TEXT;

-- CreateIndex
CREATE INDEX "WhatsAppAccount_wabaId_idx" ON "WhatsAppAccount"("wabaId");

-- CreateIndex
CREATE INDEX "WhatsAppPhoneNumber_metaPhoneNumberId_idx" ON "WhatsAppPhoneNumber"("metaPhoneNumberId");
