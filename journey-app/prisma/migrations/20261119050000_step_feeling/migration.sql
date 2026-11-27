-- CreateTable
CREATE TABLE "StepFeeling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "confidence" INTEGER NOT NULL DEFAULT 4,
    "frustration" INTEGER NOT NULL DEFAULT 4,
    "delight" INTEGER NOT NULL DEFAULT 4,
    "freeText" TEXT,
    CONSTRAINT "StepFeeling_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StepFeeling_stepId_idx" ON "StepFeeling"("stepId");

-- Migrate legacy single thoughts/feelings rows
INSERT INTO "StepFeeling" ("id", "stepId", "title", "confidence", "frustration", "delight", "freeText")
SELECT
    'migrated_' || "stepId",
    "stepId",
    CASE
        WHEN "freeText" IS NOT NULL AND TRIM("freeText") != '' THEN TRIM("freeText")
        ELSE 'Feeling'
    END,
    "confidence",
    "frustration",
    "delight",
    "freeText"
FROM "ThoughtsFeelings";