import { prisma } from "@/lib/db";

/** Lane ids on `Step`; raw SQL avoids stale Prisma client on `actionFlowBranchId`. */
export async function loadStepBranchIdsForJourney(
  journeyId: string
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  try {
    const rows = await prisma.$queryRaw<{ id: string; actionFlowBranchId: string | null }[]>`
      SELECT s.id, s."actionFlowBranchId"
      FROM "Step" s
      INNER JOIN "Phase" p ON p.id = s."phaseId"
      WHERE p."journeyId" = ${journeyId}
    `;
    for (const row of rows) {
      map.set(row.id, row.actionFlowBranchId);
    }
  } catch (err) {
    console.warn("[loadStepBranchIdsForJourney]", err);
  }
  return map;
}