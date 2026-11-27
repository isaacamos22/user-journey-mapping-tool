import type { ImportDraft, ImportDraftStep } from "@/lib/import/types";
import { withInferredPainOpportunity } from "@/lib/import/inferPainOpportunity";
import { isIncompleteWorkshopStep, stepCoverage } from "@/lib/import/incompleteImportPhase";
import { shouldPreserveWorkshopOpportunities } from "@/lib/import/workshopDraftFidelity";

function enrichStep(
  step: ImportDraftStep,
  ctx: { phaseTitle?: string; phaseIndex: number; sourceNotes?: string },
  draft: ImportDraft,
  opts: { verbatim?: boolean }
): ImportDraftStep {
  if (isIncompleteWorkshopStep(step, draft)) return step;
  if (stepCoverage(step, draft) === "partial") return step;
  if (opts.verbatim || shouldPreserveWorkshopOpportunities(step, draft)) {
    return step;
  }
  const painCtx = {
    phaseTitle: ctx.phaseTitle ?? step.phaseTitle,
    phaseIndex: ctx.phaseIndex,
    sourceNotes: ctx.sourceNotes,
    experienceGoal: step.experienceGoal,
  };

  const stepOpp = step.opportunity?.trim() || step.pain?.opportunity?.trim();
  const basePain = step.pain
    ? {
        ...step.pain,
        opportunity: stepOpp || step.pain.opportunity,
      }
    : undefined;
  const workshopOpp = Boolean(step.opportunity?.trim() || (step.opportunities?.length ?? 0) > 0);
  const pain = workshopOpp || basePain?.assumed
    ? basePain
    : withInferredPainOpportunity(basePain, painCtx);

  return { ...step, pain, actions: step.actions };
}

export function enrichImportDraftOpportunities(
  draft: ImportDraft,
  opts: { verbatim?: boolean } = {}
): ImportDraft {
  const phaseIndex = new Map<string, number>();
  for (const ph of draft.phases) {
    if (!phaseIndex.has(ph.title)) phaseIndex.set(ph.title, phaseIndex.size);
  }

  const steps = draft.steps.map((s) =>
    enrichStep(
      s,
      {
        phaseTitle: s.phaseTitle,
        phaseIndex: phaseIndex.get(s.phaseTitle ?? "") ?? 0,
        sourceNotes: draft.sourceNotes,
      },
      draft,
      opts
    )
  );

  return { ...draft, steps };
}