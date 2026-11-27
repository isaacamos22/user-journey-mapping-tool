import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

/** Normalize legacy rows where branch was mistaken for step id. */
export function normalizeActionFlowBranchId(
  stepId: string,
  branchId: string | null | undefined
): string | null {
  if (!branchId?.length) return null;
  if (branchId === stepId && !branchId.startsWith("lane:")) return null;
  return branchId;
}

/** Read lane/branch for sibling chain continuation (raw SQL — safe with stale Prisma client). */
export async function readActionFlowBranchId(stepId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ actionFlowBranchId: string | null }[]>`
      SELECT "actionFlowBranchId" FROM "Step" WHERE "id" = ${stepId} LIMIT 1
    `;
    const stored = normalizeActionFlowBranchId(stepId, rows[0]?.actionFlowBranchId);
    if (stored) return stored;
  } catch {
    /* column missing */
  }
  return null;
}

/** Row + only: inherit anchor’s `lane:` or create one and backfill the anchor. */
export async function inheritOrCreateSiblingLaneId(anchorStepId: string): Promise<string> {
  const existing = await readActionFlowBranchId(anchorStepId);
  if (existing?.startsWith("lane:")) return existing;

  const laneId = `lane:${randomUUID()}`;
  await writeActionFlowBranchId(anchorStepId, laneId);
  return laneId;
}

export async function writeActionFlowBranchId(stepId: string, branchId: string) {
  try {
    await prisma.$executeRaw`
      UPDATE "Step" SET "actionFlowBranchId" = ${branchId} WHERE "id" = ${stepId}
    `;
  } catch (err) {
    console.error(
      "[actionFlowBranch] Failed to write actionFlowBranchId — run prisma migrate deploy:",
      err
    );
  }
}

export async function loadActionFlowBranchIds(
  stepIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(stepIds)];
  await Promise.all(
    unique.map(async (id) => {
      const branch = await readActionFlowBranchId(id);
      if (branch) map.set(id, branch);
    })
  );
  return map;
}