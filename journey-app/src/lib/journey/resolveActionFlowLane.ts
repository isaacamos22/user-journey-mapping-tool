import type { FlowStep } from "@/components/journey/JourneyStepFlow";

export type ActionFlowLaneMap = Record<string, string>;

export function resolveActionFlowBranchId(
  stepId: string,
  onStep: string | null | undefined,
  laneByActionId: ActionFlowLaneMap
): string | null {
  if (onStep?.startsWith("lane:")) return onStep;
  const fromMap = laneByActionId[stepId];
  if (fromMap?.startsWith("lane:")) return fromMap;
  return onStep ?? fromMap ?? null;
}

export function applyActionFlowLaneMap(
  roots: FlowStep[],
  laneByActionId: ActionFlowLaneMap
): FlowStep[] {
  if (Object.keys(laneByActionId).length === 0) return roots;
  return roots.map((root) => ({
    ...root,
    children: (root.children ?? []).map((child) => ({
      ...child,
      actionFlowBranchId: resolveActionFlowBranchId(
        child.id,
        child.actionFlowBranchId,
        laneByActionId
      ),
    })),
  }));
}