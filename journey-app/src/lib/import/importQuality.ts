import { stepHasParallelActions } from "@/lib/import/expandImportActions";
import { isIncompleteWorkshopStep } from "@/lib/import/incompleteImportPhase";
import { screenIdInUserAction } from "@/lib/import/inferActionTouchpoint";
import {
  formatFacilitatorGaps,
  missingFacilitatorRows,
  stepHasWorkshopBehavior,
} from "@/lib/import/workshopFacilitatorRows";
import type { ImportDraft, ImportQualityDraftHint } from "@/lib/import/types";

export type ImportSourceKind = "figjam" | "figjam-pdf" | "pdf" | "cursor-json" | "unknown";

export type ImportQualityReport = {
  /** 0–100 — structural fidelity vs workshop grid (not content completeness). */
  cleanlinessScore: number;
  /** True when sticky layout/connectors should be cleaned in FigJam before trusting the map. */
  needsFigjamCleaning: boolean;
  sourceKind: ImportSourceKind;
  structureScore: number;
  redundancyCount: number;
  assumedFieldCount: number;
  orderingIssues: string[];
  recommendations: string[];
};

function normAction(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s[\]/]/g, "")
    .trim()
    .slice(0, 120);
}

function detectSourceKind(draft: ImportDraft): ImportSourceKind {
  const notes = draft.sourceNotes?.toLowerCase() ?? "";
  if (notes.includes("figjam") && notes.includes("pdf")) return "figjam-pdf";
  if (notes.includes("figjam")) return "figjam";
  if (notes.includes("pdf")) return "pdf";
  return "cursor-json";
}

export function scoreImportDraftQuality(draft: ImportDraft): ImportQualityReport {
  const phaseTitles = draft.phases.map((p) => p.title);
  const steps = draft.steps;
  const orderingIssues: string[] = [];
  const recommendations: string[] = [];

  const stepsByPhase = new Map<string, typeof steps>();
  for (const s of steps) {
    const ph = s.phaseTitle ?? "";
    const list = stepsByPhase.get(ph) ?? [];
    list.push(s);
    stepsByPhase.set(ph, list);
  }

  for (const title of phaseTitles) {
    const inPhase = stepsByPhase.get(title) ?? [];
    if (inPhase.length === 0) {
      orderingIssues.push(`No map step for phase "${title}".`);
    } else if (inPhase.length > 1) {
      orderingIssues.push(
        `Phase "${title}" has ${inPhase.length} top-level steps — workshop grid expects one user-step headline per column.`
      );
    }
  }

  const orphanPhases = steps.filter((s) => s.phaseTitle && !phaseTitles.includes(s.phaseTitle));
  if (orphanPhases.length) {
    orderingIssues.push(`${orphanPhases.length} step(s) reference phases not in phases[].`);
  }

  if (steps.length > Math.max(phaseTitles.length, 1) * 1.25 && phaseTitles.length >= 3) {
    recommendations.push(
      "Too many top-level steps for the phase count — collapse bullets into nested actions[] under each column."
    );
  }

  let assumedFieldCount = 0;
  let lowConfidenceSteps = 0;
  let stepsWithoutActions = 0;

  const actionFingerprints: string[] = [];
  let actionsWithoutPlace = 0;

  for (const s of steps) {
    if (s.confidence === "low" && !isIncompleteWorkshopStep(s, draft)) lowConfidenceSteps += 1;
    if (s.pain?.assumed) assumedFieldCount += 1;
    const feelingAssumed = s.feelings?.some((f) => f.assumed);
    if (feelingAssumed) assumedFieldCount += 1;
    if (s.userActionAssumed) assumedFieldCount += 1;

    const seeds =
      s.actions?.map((a) => a.userAction?.trim()).filter(Boolean) ??
      (s.userAction?.trim() ? [s.userAction.trim()] : []);
    if (seeds.length === 0 && !isIncompleteWorkshopStep(s, draft)) stepsWithoutActions += 1;

    for (const a of s.actions ?? []) {
      if (a.userActionAssumed) assumedFieldCount += 1;
      const n = normAction(a.userAction);
      if (n.length > 8) actionFingerprints.push(n);
      if (!isIncompleteWorkshopStep(s, draft)) {
        const hasPlace =
          Boolean(a.touchpoint?.screen?.trim()) ||
          Boolean(a.touchpoint?.module?.trim()) ||
          Boolean(screenIdInUserAction(a.userAction));
        if (!hasPlace) actionsWithoutPlace += 1;
      }
    }
    if (!isIncompleteWorkshopStep(s, draft) && stepHasWorkshopBehavior(s)) {
      const gaps = missingFacilitatorRows(s);
      if (gaps.length > 0) {
        const ph = s.phaseTitle ?? s.title;
        recommendations.push(
          `Phase "${ph}": facilitator rows still open (${formatFacilitatorGaps(gaps)}) — import preserves empty cells on the map.`
        );
      }
    }
    if (stepHasParallelActions(s)) {
      const lanes = new Set(
        (s.actions ?? [])
          .filter((a) => a.actionLane !== undefined && a.actionLane !== null && a.actionLane !== "")
          .map((a) => String(a.actionLane))
      );
      if (lanes.size < 2) {
        orderingIssues.push(
          `Step "${s.title}" has parallel FigJam action rows — set actionLane on each nested action so the map shows branches.`
        );
      }
    }
  }

  const seen = new Set<string>();
  let redundancyCount = 0;
  for (const fp of actionFingerprints) {
    if (seen.has(fp)) redundancyCount += 1;
    else seen.add(fp);
  }
  if (redundancyCount > 0) {
    recommendations.push(
      `${redundancyCount} duplicate nested action(s) — dedupe stickies that repeat the same flow across rows.`
    );
  }
  if (actionsWithoutPlace > 0) {
    recommendations.push(
      `${actionsWithoutPlace} user action(s) missing module/screen — set place on each actions[] row from touchpoint stickies or screen inventory.`
    );
  }

  if (draft.personas.length === 0) {
    orderingIssues.push("No personas[] — add profile stickies from the board.");
  }

  for (const s of steps) {
    if (isIncompleteWorkshopStep(s, draft)) {
      const ph = s.phaseTitle ?? s.title;
      orderingIssues.push(
        `Workshop column not covered: "${ph}" — map phase left empty (no invented content).`
      );
    }
  }

  let structureScore = 100;
  structureScore -= Math.min(40, orderingIssues.length * 12);
  structureScore -= Math.min(25, stepsWithoutActions * 8);
  structureScore -= Math.min(20, lowConfidenceSteps * 5);
  structureScore -= Math.min(15, redundancyCount * 3);
  structureScore -= Math.min(20, actionsWithoutPlace * 4);
  structureScore = Math.max(0, structureScore);

  let cleanlinessScore = structureScore;
  cleanlinessScore -= Math.min(30, assumedFieldCount * 2);
  cleanlinessScore = Math.max(0, Math.min(100, cleanlinessScore));

  const needsFigjamCleaning =
    cleanlinessScore < 72 ||
    orderingIssues.length >= 2 ||
    redundancyCount >= 3 ||
    steps.length > phaseTitles.length + 2 ||
    (detectSourceKind(draft) !== "cursor-json" && redundancyCount >= 1 && cleanlinessScore < 85);

  if (needsFigjamCleaning && !recommendations.some((r) => r.includes("FigJam"))) {
    recommendations.unshift(
      "FigJam cleaning recommended: align stickies per column, wire connector chains for action order, move stray stickies off the grid into sourceNotes."
    );
  }

  const agent = draft.importQuality;
  const base: ImportQualityReport = {
    cleanlinessScore,
    needsFigjamCleaning,
    sourceKind: agent?.sourceKind ?? detectSourceKind(draft),
    structureScore,
    redundancyCount,
    assumedFieldCount,
    orderingIssues,
    recommendations: recommendations.slice(0, 8),
  };

  if (!agent) return base;

  return {
    ...base,
    cleanlinessScore: Math.min(base.cleanlinessScore, agent.cleanlinessScore ?? base.cleanlinessScore),
    needsFigjamCleaning: base.needsFigjamCleaning || Boolean(agent.needsFigjamCleaning),
    sourceKind: agent.sourceKind ?? base.sourceKind,
    orderingIssues: [...new Set([...base.orderingIssues, ...(agent.orderingIssues ?? [])])].slice(0, 12),
    recommendations: [...new Set([...base.recommendations, ...(agent.recommendations ?? [])])].slice(0, 10),
  };
}

export type JourneyBusinessContextMeta = {
  importQuality: ImportQualityReport | null;
  homeCoverImage: string | null;
};

export function serializeImportQualityMeta(
  quality: ImportQualityReport,
  homeCoverImage?: string | null
): string {
  const cover = homeCoverImage?.trim();
  return JSON.stringify({
    importQuality: quality,
    ...(cover ? { homeCoverImage: cover } : {}),
  });
}

export function parseJourneyBusinessContext(
  businessContext: string | null | undefined
): JourneyBusinessContextMeta {
  if (!businessContext?.trim()) {
    return { importQuality: null, homeCoverImage: null };
  }
  try {
    const parsed = JSON.parse(businessContext) as {
      importQuality?: ImportQualityReport;
      homeCoverImage?: string;
    };
    const importQuality =
      parsed?.importQuality && typeof parsed.importQuality.cleanlinessScore === "number"
        ? parsed.importQuality
        : null;
    const homeCoverImage =
      typeof parsed.homeCoverImage === "string" && parsed.homeCoverImage.trim()
        ? parsed.homeCoverImage.trim()
        : null;
    return { importQuality, homeCoverImage };
  } catch {
    return { importQuality: null, homeCoverImage: null };
  }
}

export function parseImportQualityMeta(
  businessContext: string | null | undefined
): ImportQualityReport | null {
  return parseJourneyBusinessContext(businessContext).importQuality;
}

export type ImportQualityCardCopy = {
  /** Plain headline for the home card section */
  headline: string;
  subline: string;
  tips: string[];
};

function humanizeImportTip(line: string): string {
  let t = line.trim();
  if (!t) return t;
  t = t.replace(/\bactions\[\]/gi, "user actions under each phase");
  t = t.replace(/\bactionLane\b/gi, "parallel rows in the workshop");
  t = t.replace(/\bexperienceGoal\b/gi, "goal for that phase");
  t = t.replace(/\bpersonas\[\]/gi, "persona profile");
  t = t.replace(/\bphases\[\]/gi, "phase columns");
  t = t.replace(/\bsourceNotes\b/gi, "import notes");
  if (/^No map step for phase/i.test(t)) {
    return t.replace(/^No map step for phase/, "Add a main step card for phase");
  }
  if (/top-level steps/i.test(t)) {
    return "Use one main step per workshop column; put extra bullets under User actions.";
  }
  if (/FigJam cleaning/i.test(t)) {
    return "Tidy the FigJam board: stickies in the right columns, arrows showing action order.";
  }
  if (/FigJam MCP/i.test(t)) {
    return "Re-import from the live FigJam board if you have it—more accurate than PDF alone.";
  }
  if (/facilitator rows still open/i.test(t)) {
    return "Some workshop rows (goals, feelings, pain, suggestions) are still empty—the map shows user actions only for those phases.";
  }
  if (t.length > 120) return `${t.slice(0, 117)}…`;
  return t;
}

/** Import review copy (e.g. post-import header). Not used on home — home uses map completeness gaps. */
export function buildImportQualityCardCopy(
  quality: ImportQualityReport
): ImportQualityCardCopy | null {
  if (quality.cleanlinessScore >= 95 && !quality.needsFigjamCleaning) return null;

  const score = quality.cleanlinessScore;
  const tips: string[] = [];

  if (quality.needsFigjamCleaning || score < 80) {
    tips.push("Open Map and check each phase column matches the workshop left-to-right.");
  } else if (score < 90) {
    tips.push("Skim the Map once—phases, action rows, and friction should match the workshop grid.");
  }

  if (quality.sourceKind === "pdf" || quality.sourceKind === "figjam-pdf") {
    tips.push("Imported from PDF: lanes and branches are estimates; FigJam gives a sharper map.");
  }

  if (quality.assumedFieldCount > 0) {
    tips.push(
      quality.assumedFieldCount === 1
        ? "One field was guessed at import—open the map and confirm or edit it."
        : `${quality.assumedFieldCount} fields were guessed at import—confirm them on the map.`
    );
  }

  if (quality.redundancyCount > 0) {
    tips.push("Delete or merge duplicate user actions that repeat the same step.");
  }

  for (const raw of [...quality.orderingIssues, ...quality.recommendations]) {
    tips.push(humanizeImportTip(raw));
  }

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const tip of tips) {
    const key = tip.toLowerCase().slice(0, 64);
    if (!tip || seen.has(key)) continue;
    seen.add(key);
    uniq.push(tip);
  }

  const headline =
    score >= 88 ? "Quick polish" : score >= 72 ? "Make the map match the workshop" : "Workshop layout needs attention";

  return {
    headline,
    subline: "Import match " + score + "% — how closely columns, actions, and lanes follow your workshop file.",
    tips: uniq.slice(0, 2),
  };
}

/** @deprecated Use buildImportQualityCardCopy */
export function summarizeImportQualityTips(quality: ImportQualityReport): string[] {
  return buildImportQualityCardCopy(quality)?.tips ?? [];
}