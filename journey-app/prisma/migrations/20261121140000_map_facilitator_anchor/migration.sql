-- CreateTable
CREATE TABLE "MapFacilitatorAnchor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journeyId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL DEFAULT '',
    "facilitatorHeart" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MapFacilitatorAnchor_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MapFacilitatorAnchor_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MapFacilitatorAnchor_journeyId_stepId_kind_labelKey_key" ON "MapFacilitatorAnchor"("journeyId", "stepId", "kind", "labelKey");
CREATE INDEX "MapFacilitatorAnchor_journeyId_idx" ON "MapFacilitatorAnchor"("journeyId");

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "facilitatorAnchorId" TEXT REFERENCES "MapFacilitatorAnchor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Comment_facilitatorAnchorId_idx" ON "Comment"("facilitatorAnchorId");