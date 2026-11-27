import type { ImportDraft, ImportDraftStep } from "@/lib/import/types";
import { applyPartialCoverageHints } from "@/lib/import/workshopFacilitatorRows";

export type WorkshopColumnCoverage = "full" | "partial" | "sparse";

function normPhase(name: string): string {
  return name.trim().toLowerCase();
}

/** Phases called out as empty / not covered in `sourceNotes`. */
export function sparsePhasesFromSourceNotes(sourceNotes?: string | null): Set<string> {
  const out = new Set<string>();
  const notes = sourceNotes?.trim();
  if (!notes) return out;
  const lower = notes.toLowerCase();

  for (const m of notes.matchAll(
    /([A-Za-z][\w\s/&-]{2,48})\s+columns?\s+(?:were\s+)?(?:not covered|sparse|empty|omitted|missing)/gi
  )) {
    const chunk = m[1]!;
    for (const part of chunk.split(/\s+and\s+|,\s*/i)) {
      const t = part.trim();
      if (t.length > 2) out.add(normPhase(t));
    }
  }

  for (const m of notes.matchAll(
    /([A-Za-z][\w\s/&-]{2,48})\s+column\s+sparse/gi
  )) {
    out.add(normPhase(m[1]!));
  }

  if (/\b(passdown|troubleshoot\w*)\b/.test(lower) && /\b(not covered|sparse|empty column|omitted|not in workshop)\b/.test(lower)) {
    if (lower.includes("passdown")) out.add("passdown");
    if (lower.includes("troubleshoot")) {
      out.add("troubleshooting wwo");
      out.add("troubleshooting");
    }
  }

  return out;
}

function stepPhaseKey(step: ImportDraftStep): string {
  return normPhase(step.phaseTitle ?? step.title);
}

function phaseMatchesSparseSet(phaseTitle: string, sparse: Set<string>): boolean {
  const key = normPhase(phaseTitle);
  if (sparse.has(key)) return true;
  for (const s of sparse) {
    if (key.includes(s) || s.includes(key)) return true;
    const keyHead = key.split(/\s+/)[0] ?? "";
    const sHead = s.split(/\s+/)[0] ?? "";
    if (keyHead.length >= 5 && keyHead === sHead) return true;
  }
  return false;
}

export function stepCoverage(
  step: ImportDraftStep,
  draft: ImportDraft
): WorkshopColumnCoverage {
  const explicit = (step as ImportDraftStep & { coverage?: WorkshopColumnCoverage }).coverage;
  if (explicit === "sparse" || explicit === "partial" || explicit === "full") return explicit;

  const sparseNotes = sparsePhasesFromSourceNotes(draft.sourceNotes);
  const phase = step.phaseTitle ?? step.title;
  if (phase && phaseMatchesSparseSet(phase, sparseNotes)) return "sparse";

  return "full";
}

export function isIncompleteWorkshopStep(step: ImportDraftStep, draft: ImportDraft): boolean {
  return stepCoverage(step, draft) === "sparse";
}

/** Leave phase column on the map with title only — no invented actions, pain, or goals. */
export function softenIncompleteImportStep(
  step: ImportDraftStep,
  draft: ImportDraft
): ImportDraftStep {
  if (!isIncompleteWorkshopStep(step, draft)) return step;
  return {
    title: step.title,
    phaseTitle: step.phaseTitle,
    confidence: "low",
    coverage: "sparse",
  };
}

export function softenIncompleteImportDraft(draft: ImportDraft): ImportDraft {
  if (draft.exportPackV1) return draft;

  const steps = draft.steps.map((s) => softenIncompleteImportStep(s, draft));
  const gapPhases = [
    ...new Set(
      steps
        .filter((s) => isIncompleteWorkshopStep(s, draft))
        .map((s) => s.phaseTitle ?? s.title)
    ),
  ];

  let sourceNotes = draft.sourceNotes?.trim() ?? "";
  if (gapPhases.length) {
    const line = `Workshop columns not covered in source (map left empty): ${gapPhases.join("; ")}.`;
    if (!sourceNotes.toLowerCase().includes("not covered in source")) {
      sourceNotes = sourceNotes ? `${sourceNotes}\n${line}` : line;
    }
  }

  return applyPartialCoverageHints({
    ...draft,
    steps,
    sourceNotes,
  });
}