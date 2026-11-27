-- AlterTable
ALTER TABLE "PainPoint" ADD COLUMN "facilitatorHeart" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "painPointId" TEXT;

-- CreateIndex
CREATE INDEX "Comment_painPointId_idx" ON "Comment"("painPointId");