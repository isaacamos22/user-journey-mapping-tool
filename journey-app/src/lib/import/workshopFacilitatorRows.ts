import type { ImportDraft, ImportDraftStep } from "@/lib/import/types";
import { isIncompleteWorkshopStep } from "@/lib/import/incompleteImportPhase";

/** Goals, feelings, frustrations, opportunities rows on the workshop grid (not user actions). */
export type FacilitatorRow = "goals" | "feelings" | "frustrations" | "opportunities";

export function stepHasWorkshopBehavior(step: ImportDraftStep): boolean {
  return Boolean(step.actions?.length) || Boolean(step.userAction?.trim());
}

export function hasFacilitatorPain(step: ImportDraftStep): boolean {
  return Boolean(step.pain?.description?.trim()) || (step.frictions?.length ?? 0) > 0;
}

export function hasFacilitatorOpportunity(step: ImportDraftStep): boolean {
  return Boolean(step.opportunity?.trim()) || (step.opportunities?.length ?? 0) > 0;
}

export function hasFacilitatorFeelings(step: ImportDraftStep): boolean {
  return (step.feelings?.length ?? 0) > 0;
}

export function hasFacilitatorGoals(step: ImportDraftStep): boolean {
  return Boolean(step.experienceGoal?.trim());
}

/** Which facilitator rows are still empty on this column. */
export function missingFacilitatorRows(step: ImportDraftStep): FacilitatorRow[] {
  const gaps: FacilitatorRow[] = [];
  if (!hasFacilitatorGoals(step)) gaps.push("goals");
  if (!hasFacilitatorFeelings(step)) gaps.push("feelings");
  if (!hasFacilitatorPain(step)) gaps.push("frustrations");
  if (!hasFacilitatorOpportunity(step)) gaps.push("opportunities");
  return gaps;
}

const ROW_LABEL: Record<FacilitatorRow, string> = {
  goals: "goals",
  feelings: "feelings",
  frustrations: "frustrations",
  opportunities: "suggestions",
};

export function formatFacilitatorGaps(gaps: FacilitatorRow[]): string {
  return gaps.map((g) => ROW_LABEL[g]).join(", ");
}

/**
 * Column has user step / actions but facilitator rows not done yet — keep map behavior-only;
 * do not invent goals, pain, or opportunities on apply.
 */
export function applyPartialCoverageHints(draft: ImportDraft): ImportDraft {
  if (draft.exportPackV1) return draft;

  const steps = draft.steps.map((step) => {
    if (isIncompleteWorkshopStep(step, draft)) return step;
    if (step.coverage === "sparse") return step;
    if (!stepHasWorkshopBehavior(step)) return step;

    const gaps = missingFacilitatorRows(step);
    if (gaps.length === 0) {
      return step.coverage ? step : { ...step, coverage: "full" };
    }

    const explicit = step.coverage;
    const coverage = explicit === "full" ? "full" : explicit ?? "partial";
    const confidence =
      coverage === "partial" && step.confidence === "high" ? "medium" : step.confidence;

    return { ...step, coverage, confidence };
  });

  const partialNotes: string[] = [];
  for (const s of steps) {
    if (s.coverage !== "partial") continue;
    const gaps = missingFacilitatorRows(s);
    if (!gaps.length) continue;
    const ph = s.phaseTitle ?? s.title;
    partialNotes.push(`${ph} (${formatFacilitatorGaps(gaps)})`);
  }

  let sourceNotes = draft.sourceNotes?.trim() ?? "";
  if (partialNotes.length) {
    const line = `Facilitator rows not filled yet (map shows user actions only where applicable): ${partialNotes.join("; ")}.`;
    if (!sourceNotes.toLowerCase().includes("facilitator rows not filled")) {
      sourceNotes = sourceNotes ? `${sourceNotes}\n${line}` : line;
    }
  }

  return { ...draft, steps, sourceNotes };
}