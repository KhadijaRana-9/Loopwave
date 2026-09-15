-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_inviteToken_key" ON "Membership"("inviteToken");
