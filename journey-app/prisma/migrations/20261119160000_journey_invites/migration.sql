-- AlterTable
ALTER TABLE "Journey" ADD COLUMN "createdByUserId" TEXT;

-- CreateTable
CREATE TABLE "JourneyInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journeyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JourneyInvite_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JourneyInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneyInvite_token_key" ON "JourneyInvite"("token");
CREATE INDEX "JourneyInvite_journeyId_idx" ON "JourneyInvite"("journeyId");
CREATE INDEX "JourneyInvite_email_idx" ON "JourneyInvite"("email");