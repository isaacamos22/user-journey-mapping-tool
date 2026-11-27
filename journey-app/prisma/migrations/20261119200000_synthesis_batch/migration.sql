-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN "synthesisBatchId" TEXT;

-- CreateIndex
CREATE INDEX "Requirement_journeyId_synthesisBatchId_idx" ON "Requirement"("journeyId", "synthesisBatchId");