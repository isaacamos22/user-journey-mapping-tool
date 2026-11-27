-- CreateTable
CREATE TABLE "StepFlowLink" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "fromStepId" TEXT NOT NULL,
    "toStepId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'continues',
    CONSTRAINT "StepFlowLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StepFlowLink_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StepFlowLink_fromStepId_fkey" FOREIGN KEY ("fromStepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StepFlowLink_toStepId_fkey" FOREIGN KEY ("toStepId") REFERENCES "Step"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StepFlowLink_fromStepId_toStepId_key" ON "StepFlowLink"("fromStepId", "toStepId");

-- CreateIndex
CREATE INDEX "StepFlowLink_journeyId_idx" ON "StepFlowLink"("journeyId");