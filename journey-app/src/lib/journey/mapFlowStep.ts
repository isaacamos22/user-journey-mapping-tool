import type { FlowStep } from "@/components/journey/JourneyStepFlow";

export type StepLike = {
  id: string;
  title: string;
  userAction: string | null;
  order: number;
  parentStepId?: string | null;
  actionFlowBranchId?: string | null;
  touchpoints: {
    id: string;
    module: string | null;
    screen: string | null;
    panel: string | null;
    dialog: string | null;
  }[];
  painPoints: {
    id: string;
    description: string;
    severity: number;
    evidence: string | null;
    opportunity: string | null;
  }[];
  feelings: {
    id: string;
    title: string;
    confidence: number;
    frustration: number;
    delight: number;
    freeText: string | null;
  }[];
  children?: StepLike[];
};

export function mapFlowStep(s: StepLike): FlowStep {
  return {
    id: s.id,
    title: s.title,
    userAction: s.userAction,
    order: s.order,
    parentStepId: s.parentStepId ?? null,
    actionFlowBranchId: s.actionFlowBranchId ?? null,
    touchpoints: s.touchpoints,
    painPoints: s.painPoints,
    feelings: s.feelings,
    children: (s.children ?? []).map(mapFlowStep),
  };
}

/** Top-level steps only, with nested child actions from Prisma `children`. */
export function mapPhaseRootSteps(steps: StepLike[]): FlowStep[] {
  const roots = steps.filter((s) => !s.parentStepId);
  return roots
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const fromRelation = r.children?.length
        ? r.children
        : steps.filter((c) => c.parentStepId === r.id);
      return mapFlowStep({
        ...r,
        children: fromRelation.sort((a, b) => a.order - b.order),
      });
    });
}