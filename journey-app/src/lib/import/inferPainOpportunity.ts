import type { ImportDraftPain } from "@/lib/import/types";

export function parseOpportunityList(sourceNotes?: string | null): string[] {
  if (!sourceNotes?.trim()) return [];
  const m = sourceNotes.match(/Opportunities:\s*([^\n.]+)/i);
  if (!m) return [];
  return m[1]!
    .split(/[;•|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function opportunityForPhase(phaseTitle: string, list: string[], phaseIndex: number): string | undefined {
  if (!list.length) return undefined;
  const phase = phaseTitle.toLowerCase();
  const pick = (re: RegExp) => list.find((o) => re.test(o));

  if (/prerequisite|context/.test(phase)) return pick(/context|validation|well/i) ?? list[0];
  if (/plan.*screen|orient/.test(phase)) return pick(/variant|routing|activity|hint/i) ?? list[1] ?? list[0];
  if (/open|bind|daily/.test(phase)) return pick(/daily|guard|bind/i) ?? list[2] ?? list[0];
  if (/execute|validate|capture/.test(phase)) return pick(/automate|link|screen|chain|test/i) ?? list[3] ?? list[0];
  if (/close|reuse|improve|carry/.test(phase)) return pick(/next|workflow|standard|carry/i) ?? list[4] ?? list[0];

  return list[phaseIndex % list.length];
}

function synthesizeFromPain(description: string, experienceGoal?: string | null): string | undefined {
  const d = description.toLowerCase();
  if (/wrong well|operation|day|context|prerequisite/.test(d)) {
    return "Clearer context validation before menus and reporting.";
  }
  if (/variant|uncertain|which grid|eleven activity/.test(d)) {
    return "Activity variant routing hints from Daily and operation context.";
  }
  if (/blocked without daily|leak across days|records/.test(d)) {
    return "Daily-first guardrails and day-boundary checks on save.";
  }
  if (/duplicate|chain|link|cross.?screen|blocked save|validation/.test(d)) {
    return "Automated cross-screen link checks and save validation.";
  }
  if (/carry.?forward|batch|permission|scope/.test(d)) {
    return "Standardize next-day carry-forward and batch-update scope.";
  }
  if (experienceGoal?.trim()) {
    return `Design toward: ${experienceGoal.trim().slice(0, 120)}`;
  }
  const lead = description.split(/[;•\n]/)[0]?.trim();
  if (lead.length > 12) {
    return `Reduce friction around ${lead.charAt(0).toLowerCase()}${lead.slice(1, 100)}`;
  }
  return undefined;
}

export function resolvePainOpportunity(
  pain:
    | { description?: string | null; opportunity?: string | null; severity?: number }
    | undefined
    | null,
  ctx: { phaseTitle?: string; phaseIndex?: number; sourceNotes?: string | null; experienceGoal?: string | null }
): string | null {
  if (pain?.opportunity?.trim()) return pain.opportunity.trim().slice(0, 220);
  if (!pain?.description?.trim()) return null;
  const list = parseOpportunityList(ctx.sourceNotes);
  const fromPhase =
    ctx.phaseTitle != null
      ? opportunityForPhase(ctx.phaseTitle, list, ctx.phaseIndex ?? 0)
      : undefined;
  const synthesized = synthesizeFromPain(pain.description, ctx.experienceGoal);
  return (fromPhase ?? synthesized ?? null)?.slice(0, 220) ?? null;
}

export function withInferredPainOpportunity(
  pain: ImportDraftPain | undefined,
  ctx: {
    phaseTitle?: string;
    phaseIndex?: number;
    sourceNotes?: string;
    experienceGoal?: string;
  }
): ImportDraftPain | undefined {
  if (!pain) return undefined;
  if (pain.opportunity?.trim()) return pain;
  const opp = resolvePainOpportunity(pain, {
    phaseTitle: ctx.phaseTitle,
    phaseIndex: ctx.phaseIndex,
    sourceNotes: ctx.sourceNotes,
    experienceGoal: ctx.experienceGoal,
  });
  if (!opp) return pain;
  return { ...pain, opportunity: opp };
}