import type { ImportDraft, ImportDraftFeeling, ImportDraftStep } from "@/lib/import/types";
import { inferUserAction } from "@/lib/import/heuristicEnrich";
import { withInferredPainOpportunity } from "@/lib/import/inferPainOpportunity";
import { meaningfulAssumedTitle } from "@/lib/import/importAssumptions";
import { isIncompleteWorkshopStep, stepCoverage } from "@/lib/import/incompleteImportPhase";
import {
  hasFacilitatorPain,
  hasFacilitatorFeelings,
} from "@/lib/import/workshopFacilitatorRows";
import { shouldPreserveWorkshopOpportunities } from "@/lib/import/workshopDraftFidelity";

function shortContext(label: string): string {
  return label.trim().slice(0, 80);
}

function defaultAssumedPain(
  stepTitle: string,
  ctx?: { phaseTitle?: string; phaseIndex?: number; sourceNotes?: string; experienceGoal?: string }
): ImportDraftStep["pain"] {
  const label = shortContext(stepTitle);
  const base = {
    description: `Possible friction during “${label}” — confirm with workshop material.`,
    severity: 2,
    assumed: true,
  };
  return withInferredPainOpportunity(base, ctx ?? {}) ?? base;
}

function defaultAssumedFeeling(stepTitle: string, painSeverity?: number): ImportDraftFeeling {
  const frustration = painSeverity != null ? Math.min(7, Math.max(3, painSeverity + 1)) : 4;
  const ctx = shortContext(stepTitle);
  return {
    title: meaningfulAssumedTitle(`Sentiment during ${ctx}`),
    confidence: 4,
    frustration,
    delight: 4,
    freeText: `Inferred from step context — adjust after product owner review.`,
    assumed: true,
  };
}

type AssumptionCounts = { actions: number; pains: number; feelings: number };

function enrichStep(
  step: ImportDraftStep,
  draftCtx: { phaseIndex?: number; sourceNotes?: string },
  draft: ImportDraft
): { step: ImportDraftStep; counts: AssumptionCounts } {
  if (isIncompleteWorkshopStep(step, draft)) {
    return { step, counts: { actions: 0, pains: 0, feelings: 0 } };
  }
  if (stepCoverage(step, draft) === "partial") {
    return { step, counts: { actions: 0, pains: 0, feelings: 0 } };
  }
  const painCtx = {
    phaseTitle: step.phaseTitle,
    phaseIndex: draftCtx.phaseIndex,
    sourceNotes: draftCtx.sourceNotes,
    experienceGoal: step.experienceGoal,
  };
  const counts: AssumptionCounts = { actions: 0, pains: 0, feelings: 0 };
  const next: ImportDraftStep = { ...step };

  let userAction = next.userAction?.trim();
  let userActionAssumed = next.userActionAssumed ?? false;
  if (!userAction && !next.actions?.length && next.actionAssumed === true) {
    userAction = inferUserAction(next.title, undefined);
    if (userAction) {
      userActionAssumed = true;
      counts.actions += 1;
      next.confidence = "low";
    }
  }
  next.userAction = userAction;
  next.userActionAssumed = userActionAssumed;

  const hasNestedAction = Boolean(userAction) || (next.actions?.length ?? 0) > 0;
  if (!hasNestedAction) {
    return { step: next, counts };
  }

  if (next.actions?.length) {
    if (next.painAssumed === true && !hasFacilitatorPain(next)) {
      next.pain = defaultAssumedPain(next.title, painCtx);
      counts.pains += 1;
    }
    if (
      (next.feelingAssumed === true || next.feelings?.some((f) => f.assumed)) &&
      !hasFacilitatorFeelings(next)
    ) {
      next.feelings = [defaultAssumedFeeling(next.title, next.pain?.severity)];
      counts.feelings += 1;
    }
    return { step: next, counts };
  }

  if (next.painAssumed === true && !hasFacilitatorPain(next)) {
    next.pain = defaultAssumedPain(next.title, painCtx);
    counts.pains += 1;
  }

  if (
    (next.feelingAssumed === true || next.feelings?.some((f) => f.assumed)) &&
    !hasFacilitatorFeelings(next)
  ) {
    const sev = next.pain?.severity;
    next.feelings = [defaultAssumedFeeling(next.title, sev)];
    counts.feelings += 1;
  }

  if (next.pain && !shouldPreserveWorkshopOpportunities(next, draft)) {
    next.pain = withInferredPainOpportunity(next.pain, painCtx);
  }

  return { step: next, counts };
}

export function enrichImportDraftAssumptions(draft: ImportDraft): ImportDraft {
  let actions = 0;
  let pains = 0;
  let feelings = 0;
  const phaseIndex = new Map<string, number>();
  for (const ph of draft.phases) {
    if (!phaseIndex.has(ph.title)) phaseIndex.set(ph.title, phaseIndex.size);
  }

  const steps = draft.steps.map((s) => {
    const { step, counts } = enrichStep(
      s,
      {
        phaseIndex: phaseIndex.get(s.phaseTitle ?? "") ?? 0,
        sourceNotes: draft.sourceNotes,
      },
      draft
    );
    actions += counts.actions;
    pains += counts.pains;
    feelings += counts.feelings;
    return step;
  });

  let sourceNotes = draft.sourceNotes?.trim() ?? "";
  if (actions + pains + feelings > 0) {
    const line = `Import assumptions: ${actions} user action(s), ${pains} pain(s), ${feelings} feeling(s) labeled with “(Assumed)” on the map (review on Map).`;
    sourceNotes = sourceNotes ? `${sourceNotes}\n${line}` : line;
  }

  return { ...draft, steps, sourceNotes };
}