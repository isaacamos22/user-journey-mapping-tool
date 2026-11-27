import type { ImportDraft, ImportDraftStep } from "@/lib/import/types";
import {
  looksLikeFrictionBullet,
  looksLikeOpportunityBullet,
} from "@/lib/import/workshopRowSemantics";
import { isCuratedWorkshopImport } from "@/lib/import/workshopDraftFidelity";

const PHASE_KEYWORDS: { pattern: RegExp; phase: string }[] = [
  { pattern: /\b(aware|discover|learn|hear about)\b/i, phase: "Awareness" },
  { pattern: /\b(consider|research|compare|evaluate)\b/i, phase: "Consideration" },
  { pattern: /\b(onboard|sign[- ]?up|register|first|welcome)\b/i, phase: "Onboarding" },
  { pattern: /\b(purchase|buy|checkout|order|pay)\b/i, phase: "Purchase" },
  { pattern: /\b(use|configure|run|execute|operate|day[- ]?to[- ]?day)\b/i, phase: "Usage" },
  { pattern: /\b(support|help|ticket|resolve|escalat)\b/i, phase: "Support" },
  { pattern: /\b(renew|expand|upgrade|churn|leave)\b/i, phase: "Retention" },
];

export function inferUserAction(title: string, existing?: string): string | undefined {
  if (existing?.trim()) return existing.trim();
  const t = title.trim();
  if (t.length < 3) return undefined;
  if (/^user\s+/i.test(t)) return t;
  if (
    /^(click|select|enter|submit|review|confirm|open|navigate|choose|fill|upload|download|search|filter|create|edit|delete|save|cancel|sign|log)\b/i.test(
      t
    )
  ) {
    const lower = t.charAt(0).toLowerCase() + t.slice(1);
    const prefixed = lower.startsWith("user ") ? lower : `User ${lower}`;
    return prefixed;
  }
  if (t.length > 12 && /\b(to|so that|in order to)\b/i.test(t)) return t;
  return undefined;
}

function inferPhaseTitle(step: ImportDraftStep): string | undefined {
  if (step.phaseTitle?.trim()) return step.phaseTitle.trim();
  const blob = `${step.title} ${step.userAction ?? ""}`;
  for (const { pattern, phase } of PHASE_KEYWORDS) {
    if (pattern.test(blob)) return phase;
  }
  return undefined;
}

function extractPersonasFromText(text: string): ImportDraft["personas"] {
  const personas: ImportDraft["personas"] = [];
  const seen = new Set<string>();

  const add = (name: string, goals?: string, frustrations?: string) => {
    const key = name.trim().toLowerCase();
    if (!key || key.length < 2 || seen.has(key)) return;
    seen.add(key);
    personas.push({
      name: name.trim().slice(0, 80),
      goals: goals?.trim().slice(0, 500),
      frustrations: frustrations?.trim().slice(0, 500),
      confidence: goals || frustrations ? "medium" : "low",
    });
  };

  for (const m of text.matchAll(/persona[s]?\s*[:\-]\s*([^\n]+)/gi)) {
    add(m[1]!);
  }
  for (const m of text.matchAll(/\bas a[n]?\s+([^,.\n]{2,60})/gi)) {
    add(m[1]!);
  }
  for (const m of text.matchAll(/(?:primary|target)\s+user[s]?\s*[:\-]\s*([^\n]+)/gi)) {
    add(m[1]!);
  }
  for (const m of text.matchAll(/^#+\s*persona[s]?\s*[:\-]?\s*([^\n]+)/gim)) {
    add(m[1]!);
  }

  return personas;
}

function dedupeSteps(steps: ImportDraftStep[]): ImportDraftStep[] {
  const out: ImportDraftStep[] = [];
  const seen = new Set<string>();
  for (const s of steps) {
    const key = `${s.phaseTitle ?? ""}|${s.title}`.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function inferJourneyTitle(draft: ImportDraft): string | undefined {
  if (draft.title?.trim()) return draft.title.trim();
  const notes = draft.sourceNotes ?? "";
  const m = notes.match(/^(?:journey|title|project)\s*[:\-]\s*(.+)$/im);
  if (m?.[1]) return m[1].trim().slice(0, 120);
  const firstPhase = draft.phases[0]?.title;
  if (firstPhase && firstPhase !== "General" && firstPhase !== "Imported") {
    return `${firstPhase} journey`;
  }
  return undefined;
}

export function enrichImportDraftHeuristic(draft: ImportDraft): ImportDraft {
  if (draft.exportPackV1) return draft;

  const curated = isCuratedWorkshopImport(draft);
  const source = draft.sourceNotes ?? "";
  const personas = [...draft.personas];
  for (const p of extractPersonasFromText(source)) {
    if (!personas.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) {
      personas.push(p);
    }
  }

  if (!curated && personas.length === 0 && draft.steps.length > 0) {
    personas.push({
      name: "Primary user",
      goals: "Complete the journey successfully with minimal friction",
      frustrations: "Unclear steps, missing guidance, or handoffs between teams",
      confidence: "low",
    });
  }

  const steps = (curated ? draft.steps : dedupeSteps(draft.steps))
    .map((s) => {
      const phaseTitle = s.phaseTitle?.trim() || inferPhaseTitle(s);
      const titleIsInsight =
        looksLikeFrictionBullet(s.title) || looksLikeOpportunityBullet(s.title);
      const hasNestedActions = (s.actions?.length ?? 0) > 0;
      const userAction = curated
        ? s.userAction?.trim()
        : titleIsInsight || hasNestedActions
          ? s.userAction?.trim()
          : inferUserAction(s.title, s.userAction);
      const title = s.title.trim();
      if (!title) return null;
      return {
        ...s,
        title: title.slice(0, 2000),
        phaseTitle,
        userAction,
        confidence:
          userAction && s.touchpoint ? "high" : userAction || s.pain ? "medium" : s.confidence,
      };
    })
    .filter((s) => s !== null) as ImportDraftStep[];

  const phaseTitles = new Map<string, ImportDraft["phases"][0]["confidence"]>();
  for (const p of draft.phases) {
    phaseTitles.set(p.title.trim(), p.confidence);
  }
  for (const s of steps) {
    const pt = s.phaseTitle?.trim() || "Main flow";
    if (!phaseTitles.has(pt)) {
      phaseTitles.set(pt, "medium");
    }
  }

  const phases = [...phaseTitles.entries()].map(([title, confidence]) => ({
    title,
    confidence,
  }));

  const title = inferJourneyTitle({ ...draft, phases }) ?? draft.title ?? "Imported user journey";

  return {
    ...draft,
    title,
    personas,
    phases,
    steps,
    sourceNotes: draft.sourceNotes,
  };
}