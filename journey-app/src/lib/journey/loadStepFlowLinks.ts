import { prisma } from "@/lib/db";
import type { FlowLink } from "@/lib/journey/flowLinks";

/** Loads action flow edges; returns [] if table/client not ready yet. */
export async function loadStepFlowLinks(journeyId: string): Promise<FlowLink[]> {
  try {
    const rows = await prisma.$queryRaw<FlowLink[]>`
      SELECT "fromStepId", "toStepId", "kind"
      FROM "StepFlowLink"
      WHERE "journeyId" = ${journeyId}
    `;
    return rows;
  } catch {
    return [];
  }
}