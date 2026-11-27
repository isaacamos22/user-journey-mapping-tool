import type { ImportDraft, ImportDraftStep } from "@/lib/import/types";
import { hasFacilitatorOpportunity, hasFacilitatorPain } from "@/lib/import/workshopFacilitatorRows";

/** Workshop-shaped JSON from Cursor / FigJam — keep verbatim copy; avoid server rewrites that Discovery treats as evidence. */
export function isCuratedWorkshopImport(draft: ImportDraft): boolean {
  if (draft.exportPackV1) return true;
  const kind = draft.importQuality?.sourceKind;
  if (kind === "cursor-json" || kind === "figjam" || kind === "figjam-pdf") return true;
  if (draft.steps.some((s) => hasWorkshopFacilitatorRowSignal(s))) return true;
  if (
    draft.phases.length >= 2 &&
    draft.steps.length >= 2 &&
    draft.steps.length >= Math.min(draft.phases.length, draft.steps.length)
  ) {
    return true;
  }
  return false;
}

function hasWorkshopFacilitatorRowSignal(step: ImportDraftStep): boolean {
  return (
    (step.frictions?.length ?? 0) > 0 ||
    (step.opportunities?.length ?? 0) > 0 ||
    (step.actions?.length ?? 0) > 0 ||
    Boolean(step.experienceGoal?.trim()) ||
    hasFacilitatorPain(step) ||
    hasFacilitatorOpportunity(step)
  );
}

/** Do not synthesize or attach inferred opportunity text when the map already has workshop copy. */
export function shouldPreserveWorkshopOpportunities(step: ImportDraftStep, draft: ImportDraft): boolean {
  if (hasFacilitatorOpportunity(step)) return true;
  if (step.frictions?.length) return true;
  if (isCuratedWorkshopImport(draft) && hasFacilitatorPain(step) && !step.pain?.assumed) return true;
  return false;
}