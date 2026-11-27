import { randomUUID } from "crypto";
import {
  coalesceSingleCardChainRuns,
  groupActionsIntoSiblingRuns,
  orderChildRunsForLayout,
  unifyMergeTrunkRuns,
} from "@/lib/journey/actionFlowLayout";
import { writeActionFlowBranchId } from "@/lib/journey/actionFlowBranch";
import type { FlowLink } from "@/lib/journey/flowLinks";

type ChildStep = {
  id: string;
  order: number;
  parentStepId?: string | null;
  actionFlowBranchId?: string | null;
};

/**
 * Ensures every horizontal row under a parent has a shared `lane:uuid` persisted in DB.
 * Fixes legacy rows and silent write failures so the canvas can split rows reliably.
 */
export async function backfillActionLanesForParents(
  parents: { id: string; children: ChildStep[] }[],
  flowLinks: FlowLink[]
): Promise<void> {
  for (const parent of parents) {
    const children = [...parent.children].sort((a, b) => a.order - b.order);
    if (children.length === 0) continue;

    const childIds = new Set(children.map((c) => c.id));
    const childLinks = flowLinks.filter(
      (l) => childIds.has(l.fromStepId) && childIds.has(l.toStepId)
    );

    const runs = groupActionsIntoSiblingRuns(children, childLinks, parent.id);

    for (const run of runs) {
      const existingLane = run
        .map((a) => a.actionFlowBranchId)
        .find((b) => b?.startsWith("lane:"));
      const laneId = existingLane ?? `lane:${randomUUID()}`;

      for (const action of run) {
        if (action.actionFlowBranchId === laneId) continue;
        await writeActionFlowBranchId(action.id, laneId);
        action.actionFlowBranchId = laneId;
      }
    }
  }
}