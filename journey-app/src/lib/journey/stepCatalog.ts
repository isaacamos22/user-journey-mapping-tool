import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import type { JourneyCoachField, JourneyCoachTab } from "@/lib/completeness/journeyCoach";

type DbTouchpoint = {
  id: string;
  module: string | null;
  screen: string | null;
  panel: string | null;
  dialog: string | null;
};
type DbPain = {
  id: string;
  description: string;
  severity: number;
  evidence: string | null;
  opportunity: string | null;
};
type DbFeeling = {
  id: string;
  title: string;
  confidence: number;
  frustration: number;
  delight: number;
  freeText: string | null;
};

type DbStep = {
  id: string;
  title: string;
  userAction: string | null;
  order: number;
  parentStepId?: string | null;
  touchpoints: DbTouchpoint[];
  painPoints: DbPain[];
  feelings: DbFeeling[];
  children?: DbStep[];
};

export type JourneyPhaseCatalog = {
  id: string;
  title: string;
  steps: DbStep[];
};

export function mapDbStepToFlowStep(s: DbStep): FlowStep {
  return {
    id: s.id,
    title: s.title,
    userAction: s.userAction,
    order: s.order,
    parentStepId: s.parentStepId,
    touchpoints: s.touchpoints,
    painPoints: s.painPoints,
    feelings: s.feelings,
    children: s.children?.map(mapDbStepToFlowStep),
  };
}

export function findFlowStepInJourney(
  phases: JourneyPhaseCatalog[],
  stepId: string
): { step: FlowStep; phaseId: string; isAction: boolean } | null {
  for (const phase of phases) {
    for (const root of phase.steps) {
      if (root.id === stepId) {
        return { step: mapDbStepToFlowStep(root), phaseId: phase.id, isAction: false };
      }
      for (const child of root.children ?? []) {
        if (child.id === stepId) {
          return { step: mapDbStepToFlowStep(child), phaseId: phase.id, isAction: true };
        }
      }
    }
  }
  return null;
}

export type SummaryStepOpenRequest = {
  stepId: string;
  tab?: JourneyCoachTab;
  field?: JourneyCoachField;
};