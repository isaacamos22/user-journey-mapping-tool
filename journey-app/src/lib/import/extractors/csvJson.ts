import type { ImportDraft, ImportDraftFeeling } from "@/lib/import/types";

import type { ImportQualityDraftHint } from "@/lib/import/types";

type JsonImportShape = {
  title?: string;
  sourceNotes?: string;
  homeCoverImage?: string;
  importQuality?: ImportQualityDraftHint;
  personas?: {
    name: string;
    role?: string;
    tags?: string;
    goals?: string;
    frustrations?: string;
    confidence?: string;
  }[];
  phases?: ({ title: string; confidence?: string } | string)[];
  steps?: {
    phase?: string;
    phaseTitle?: string;
    title: string;
    experienceGoal?: string;
    action?: string;
    userAction?: string;
    module?: string;
    screen?: string;
    touchpoint?: { module?: string; screen?: string };
    pain?: string | { description: string; severity?: number; assumed?: boolean; opportunity?: string };
    opportunity?: string;
    coverage?: "full" | "partial" | "sparse";
    frictions?: string[];
    opportunities?: string[];
    severity?: number;
    painAssumed?: boolean;
    feelingAssumed?: boolean;
    actionAssumed?: boolean;
    confidence?: string;
    feelings?: ImportDraftFeeling[];
    feeling?: ImportDraftFeeling & { assumed?: boolean };
    actions?: {
      title?: string;
      action?: string;
      userAction?: string;
      module?: string;
      screen?: string;
      touchpoint?: { module?: string; screen?: string; panel?: string; dialog?: string };
      actionLane?: string | number;
      actionKey?: string;
      continuesAfter?: string | string[];
      continuesTo?: { phase: string; actionKey: string; kind?: "continues" | "alternate" }[];
      pain?: string | { description: string; severity?: number };
      severity?: number;
      feelings?: ImportDraftFeeling[];
      feeling?: ImportDraftFeeling;
    }[];
  }[];
};

function mapFeeling(raw?: ImportDraftFeeling & { assumed?: boolean }): ImportDraftFeeling | undefined {
  if (!raw) return undefined;
  return {
    title: raw.title,
    confidence: raw.confidence,
    frustration: raw.frustration,
    delight: raw.delight,
    freeText: raw.freeText,
    assumed: raw.assumed,
  };
}

function mapPain(
  painRaw: string | { description: string; severity?: number; assumed?: boolean; opportunity?: string } | undefined,
  severity?: number,
  painAssumed?: boolean,
  opportunity?: string
): ImportDraft["steps"][0]["pain"] {
  if (!painRaw) return undefined;
  if (typeof painRaw === "string") {
    return {
      description: painRaw,
      severity: severity ?? 3,
      assumed: painAssumed,
      opportunity: opportunity?.trim() || undefined,
    };
  }
  return {
    description: painRaw.description,
    severity: painRaw.severity ?? severity ?? 3,
    assumed: painRaw.assumed ?? painAssumed,
    opportunity: painRaw.opportunity ?? (opportunity?.trim() || undefined),
  };
}

function mapFeelings(
  feelings?: ImportDraftFeeling[],
  single?: ImportDraftFeeling
): ImportDraftFeeling[] | undefined {
  const list = [...(feelings ?? [])];
  const one = mapFeeling(single);
  if (one) list.push(one);
  return list.length ? list : undefined;
}

function mapStep(s: NonNullable<JsonImportShape["steps"]>[number]): ImportDraft["steps"][number] {
  const pain = mapPain(s.pain, s.severity, s.painAssumed, s.opportunity);
  const stepOpportunity =
    s.opportunity?.trim() ||
    (typeof s.pain === "object" && s.pain?.opportunity?.trim()) ||
    undefined;
  const conf = s.confidence === "low" || s.confidence === "medium" ? s.confidence : "high";
  const actions = s.actions?.map((a) => {
    const actionPain = mapPain(a.pain, a.severity);
    const ua = (a.userAction ?? a.action)?.trim();
    if (!ua) return null;
    return {
      title: a.title,
      userAction: ua,
      actionLane: a.actionLane,
      actionKey: a.actionKey,
      continuesAfter: a.continuesAfter,
      continuesTo: a.continuesTo,
      actionRunBlurb: a.actionRunBlurb,
      touchpoint:
        a.touchpoint ??
        (a.module || a.screen ? { module: a.module, screen: a.screen } : undefined),
      pain: actionPain,
      feelings: mapFeelings(a.feelings, a.feeling),
    };
  }).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return {
    title: s.title,
    experienceGoal: s.experienceGoal,
    actionRunBlurb: s.actionRunBlurb,
    userAction: s.userAction ?? s.action,
    userActionAssumed: s.actionAssumed,
    painAssumed: s.painAssumed,
    feelingAssumed: s.feelingAssumed,
    actionAssumed: s.actionAssumed,
    actions: actions?.length ? actions : undefined,
    phaseTitle: s.phaseTitle ?? s.phase,
    opportunity: stepOpportunity,
    coverage: s.coverage,
    frictions: s.frictions,
    opportunities: s.opportunities,
    touchpoint: s.touchpoint ?? (s.module || s.screen ? { module: s.module, screen: s.screen } : undefined),
    pain,
    feelings: mapFeelings(s.feelings, s.feeling),
    confidence: conf,
  };
}

export function parseJsonImport(text: string): ImportDraft {
  const raw = JSON.parse(text) as JsonImportShape;
  const steps = raw.steps?.map(mapStep) ?? [];

  const phases: ImportDraft["phases"] =
    raw.phases?.map((p) =>
      typeof p === "string"
        ? { title: p, confidence: "high" as const }
        : { title: p.title, confidence: (p.confidence === "low" ? "low" : p.confidence === "medium" ? "medium" : "high") as ImportDraft["phases"][0]["confidence"] }
    ) ?? [];

  if (phases.length === 0 && steps.length > 0) {
    const names = [...new Set(steps.map((s) => s.phaseTitle).filter(Boolean))] as string[];
    for (const t of names) phases.push({ title: t, confidence: "high" });
    if (phases.length === 0) phases.push({ title: "Main flow", confidence: "high" });
  }

  return {
    title: raw.title,
    sourceNotes: raw.sourceNotes,
    homeCoverImage: raw.homeCoverImage,
    importQuality: raw.importQuality,
    personas:
      raw.personas?.map((p) => ({
        name: p.name,
        role: p.role,
        tags: p.tags,
        goals: p.goals,
        frustrations: p.frustrations,
        confidence:
          p.confidence === "low" || p.confidence === "medium" ? p.confidence : ("high" as const),
      })) ?? [],
    phases,
    steps,
  };
}

export function parseCsvImport(text: string): ImportDraft {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]?.split(",").map((h) => h.trim().toLowerCase()) ?? [];
  const steps: ImportDraft["steps"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (!cols[0]) continue;
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    steps.push({
      title: row.step || row.title || cols[0],
      userAction: row.action || row.user_action,
      phaseTitle: row.phase,
      touchpoint:
        row.module || row.screen
          ? { module: row.module, screen: row.screen }
          : undefined,
      pain: row.pain ? { description: row.pain, severity: Number(row.severity) || 3 } : undefined,
      confidence: "high",
    });
  }
  return { personas: [], phases: [], steps };
}