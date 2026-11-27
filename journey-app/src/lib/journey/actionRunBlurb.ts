import type { ImportDraftStep } from "@/lib/import/types";
import { previewExperienceGoal } from "@/lib/journey/mapExperienceGoalPreview";
import {
  actionLineFromStep,
  stripActionLaneTag,
  type ActionLineSource,
} from "@/lib/journey/actionRunSummary";

export type ActionRunBlurbTier = "compact" | "overview";

export const MAP_ACTION_STACK_FEELING_TITLE = "Map action blurb";

/** Fits ~2 lines at map card width without scroll (chars are conservative). */
export const MAP_ACTION_STACK_BLURB_MAX: Record<ActionRunBlurbTier, number> = {
  compact: 128,
  overview: 88,
};

/** Layout: fixed description rows per tier (no scroll). */
export const MAP_ACTION_STACK_BLURB_LINES: Record<ActionRunBlurbTier, number> = {
  compact: 2,
  overview: 2,
};

const VERB_ACTIVITY: Record<string, string> = {
  install: "installation",
  configure: "configuration",
  create: "creation",
  set: "setup",
  update: "updates",
  add: "additions",
  open: "access",
  review: "review",
  publish: "publishing",
  run: "run",
  complete: "completion",
  enable: "enabling",
  bind: "binding",
  link: "linking",
  register: "registration",
  verify: "verification",
  validate: "validation",
  select: "selection",
  enter: "entry",
  navigate: "navigation",
  apply: "application",
  save: "saving",
  delete: "removal",
  remove: "removal",
  upload: "upload",
  download: "download",
  search: "search",
  filter: "filtering",
  submit: "submission",
  confirm: "confirmation",
};

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function capFirst(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const HANGING_END =
  /\b(from|to|through|and|or|with|for|in|on|at|by|of|:|,|-)\s*\.?$/i;

function polishSentence(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  t = t.replace(HANGING_END, ".");
  t = t.replace(/,\s*\./g, ".");
  t = t.replace(/\s+\./g, ".");
  return ensurePeriod(t.replace(/\.+$/, "."));
}

function fitCompleteSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return polishSentence(text);

  const words = polishSentence(text).replace(/\.$/, "").split(/\s+/);
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length + 1 > maxChars) break;
    out = next;
  }
  if (!out) return polishSentence(text.slice(0, Math.max(8, maxChars - 1)));
  return polishSentence(out);
}

function stripNoise(line: string): string {
  return stripActionLaneTag(line)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
}

function trimWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

/**
 * Turn one action line into a short phrase that keeps its meaning (object + activity).
 */
function meaningPhrase(line: string, maxWords = 7): string {
  const raw = stripNoise(line);
  if (!raw) return "";

  if (/^users?\s+/i.test(raw)) {
    return trimWords(raw.replace(/^users?\s+/i, ""), maxWords).toLowerCase();
  }

  const m = raw.match(
    /^([A-Za-z][\w-]*(?:\s+\w+)?)\s+([\s\S]+)$/
  );
  if (m) {
    const head = m[1]!.toLowerCase();
    let tail = m[2]!.trim();
    const headWord = head.split(/\s+/)[0]!;

    if (headWord === "set" && head.split(/\s+/)[1]?.toLowerCase() === "up") {
      return trimWords(`setup for ${tail}`, maxWords).toLowerCase();
    }

    const activity = VERB_ACTIVITY[headWord];
    if (activity) {
      tail = tail.replace(/^(a|an|the)\s+/i, "");
      return trimWords(`${tail} ${activity}`, maxWords).toLowerCase();
    }

    return trimWords(`${head} ${tail}`, maxWords).toLowerCase();
  }

  return trimWords(raw, maxWords).toLowerCase();
}

function dedupePhrases(phrases: string[]): string[] {
  const out: string[] = [];
  for (const p of phrases) {
    const key = p.toLowerCase();
    if (!key) continue;
    if (out.some((x) => x.toLowerCase() === key)) continue;
  if (out.some((x) => key.includes(x.toLowerCase()) || x.toLowerCase().includes(key))) {
      const idx = out.findIndex((x) => key.includes(x.toLowerCase()) || x.toLowerCase().includes(key));
      if (idx >= 0 && key.length > out[idx]!.length) out[idx] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

function oxfordJoin(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function phaseLabel(parentTitle?: string): string | null {
  const t = parentTitle?.trim();
  if (t && t.length >= 3 && t.length <= 48 && !/^step\s*\d+/i.test(t)) {
    return t;
  }
  return null;
}

function summarizeSingleAction(line: string): string {
  const t = stripNoise(line);
  if (!t) return "";
  if (/^users?\b/i.test(t)) return capFirst(ensurePeriod(t));
  return capFirst(ensurePeriod(`Users ${t.charAt(0).toLowerCase()}${t.slice(1)}`));
}

function actionVerbStem(line: string): string {
  const raw = stripNoise(line).toLowerCase();
  if (raw.startsWith("set up ")) return "set up";
  const w = raw.split(/\s+/)[0];
  return w && VERB_ACTIVITY[w] ? w : w ?? raw.slice(0, 16);
}

function buildMultiActionSentence(
  lines: string[],
  parentTitle: string | undefined,
  tier: ActionRunBlurbTier,
  maxWordsPer?: number
): string {
  const per =
    maxWordsPer ?? (tier === "overview" ? 4 : 7);
  const phrases = dedupePhrases(
    lines.map((l) => meaningPhrase(l, per)).filter(Boolean)
  );
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return summarizeSingleAction(lines[0]!);

  const label = phaseLabel(parentTitle);
  const scope = oxfordJoin(phrases);

  if (tier === "overview" && lines.length >= 3) {
    const verbs = dedupePhrases(lines.map(actionVerbStem).filter(Boolean));
    const verbScope = oxfordJoin(verbs);
    if (label) return `${label}: users ${verbScope} in sequence.`;
    return `Users ${verbScope} in sequence.`;
  }

  const variants = [
    label
      ? `In ${label}, users complete ${scope}.`
      : `Users complete ${scope}.`,
    label ? `${label} covers ${scope}.` : `This flow covers ${scope}.`,
    `Users work through ${scope}.`,
  ];

  return variants.find(Boolean)?.trim() ?? "";
}

/**
 * One readable sentence that reflects every action (no dangling bookends).
 */
export function synthesizeActionRunSummary(
  actionLines: string[],
  parentTitle?: string,
  tier: ActionRunBlurbTier = "compact",
  maxWordsPer?: number
): string {
  const lines = actionLines.map(stripNoise).filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return summarizeSingleAction(lines[0]!);
  return capFirst(
    polishSentence(buildMultiActionSentence(lines, parentTitle, tier, maxWordsPer))
  );
}

function actionLinesFromSteps(
  steps: ActionLineSource[],
  tier: ActionRunBlurbTier
): string[] {
  return steps
    .map((s) => stripNoise(actionLineFromStep(s)))
    .filter(Boolean);
}

function fitSummary(
  summary: string,
  lines: string[],
  parentTitle: string | undefined,
  tier: ActionRunBlurbTier,
  maxChars: number
): string {
  if (summary.length <= maxChars) return polishSentence(summary);

  for (const words of [6, 5, 4, 3]) {
    const tighter = synthesizeActionRunSummary(lines, parentTitle, tier, words);
    if (tighter.length <= maxChars) return polishSentence(tighter);
  }

  for (let keep = lines.length - 1; keep >= 2; keep--) {
    const subset = lines.slice(0, keep);
    const rest = lines.length - keep;
    const base = buildMultiActionSentence(subset, parentTitle, tier).replace(/\.$/, "");
    const extended = `${base}, plus ${rest} related ${rest === 1 ? "step" : "steps"}.`;
    const candidate = capFirst(polishSentence(extended));
    if (candidate.length <= maxChars) return candidate;
    const trimmed = fitCompleteSentence(candidate, maxChars);
    if (trimmed.length <= maxChars && !HANGING_END.test(trimmed)) return trimmed;
  }

  const fallback = capFirst(summarizeSingleAction(lines[0]!));
  if (fallback.length <= maxChars) return polishSentence(fallback);
  const label = phaseLabel(parentTitle);
  const wrap = label
    ? `In ${label}, ${fallback.replace(/\.$/, "").charAt(0).toLowerCase()}${fallback.replace(/\.$/, "").slice(1)}.`
    : fallback;
  if (wrap.length <= maxChars) return polishSentence(wrap);
  return fitCompleteSentence(wrap, maxChars);
}

/**
 * Generated map stack summary (override when import provides `actionRunBlurb`).
 */
export function buildActionRunBlurb(
  steps: ActionLineSource[],
  parentTitle?: string,
  tier: ActionRunBlurbTier = "compact",
  overrideBlurb?: string | null,
  parentExperienceGoal?: string | null
): string {
  const maxChars = MAP_ACTION_STACK_BLURB_MAX[tier];
  const manual = overrideBlurb?.trim();
  if (manual) {
    return manual.length <= maxChars
      ? polishSentence(manual)
      : fitCompleteSentence(manual, maxChars);
  }

  const lines = actionLinesFromSteps(steps, tier);
  let summary = synthesizeActionRunSummary(lines, parentTitle, tier);
  if (!summary && parentExperienceGoal?.trim()) {
    summary = capFirst(ensurePeriod(previewExperienceGoal(parentExperienceGoal)));
  }
  if (!summary) return "";
  return fitSummary(summary, lines, parentTitle, tier, maxChars);
}

export function generateActionRunBlurbFromDraftStep(
  step: ImportDraftStep,
  tier: ActionRunBlurbTier = "compact"
): string {
  const sources: ActionLineSource[] = [];
  if (step.actions?.length) {
    for (const a of step.actions) {
      const ua = a.userAction?.trim();
      if (!ua) continue;
      const tp =
        a.touchpoint?.module || a.touchpoint?.screen
          ? [a.touchpoint.module, a.touchpoint.screen].filter(Boolean).join(" · ")
          : null;
      sources.push({
        title: a.title?.trim() || ua,
        userAction: ua,
        touchpoint: tp,
      });
    }
  } else if (step.userAction?.trim()) {
    sources.push({
      title: step.title,
      userAction: step.userAction.trim(),
      touchpoint: null,
    });
  }

  return buildActionRunBlurb(
    sources,
    step.title,
    tier,
    step.actionRunBlurb,
    step.experienceGoal
  );
}

/** @deprecated Use buildActionRunBlurb with tier "overview". */
export function buildActionRunOverviewBlurb(
  steps: ActionLineSource[],
  parentTitle?: string,
  overrideBlurb?: string | null,
  parentExperienceGoal?: string | null
): string {
  return buildActionRunBlurb(steps, parentTitle, "overview", overrideBlurb, parentExperienceGoal);
}

/** Import blurbs on the phase step apply to a single combined stack only. */
export function phaseBlurbOverrideForRuns(
  overrideBlurb: string | null | undefined,
  runCountUnderPhase: number
): string | null | undefined {
  if (!overrideBlurb?.trim()) return null;
  if (runCountUnderPhase > 1) return null;
  return overrideBlurb;
}

/** Prefer a run-specific import blurb on any stack member, else phase override when one stack. */
export function resolveActionRunStackBlurbOverride(
  runSteps: Array<{ actionRunBlurb?: string | null }>,
  phaseBlurb: string | null | undefined,
  runCountUnderPhase: number
): string | null | undefined {
  for (const s of runSteps) {
    const line = s.actionRunBlurb?.trim();
    if (line) return line;
  }
  return phaseBlurbOverrideForRuns(phaseBlurb, runCountUnderPhase);
}

export function blurbForLayout(
  steps: ActionLineSource[],
  parentTitle: string | undefined,
  level: "compact" | "overview" | "detail",
  parentExperienceGoal?: string | null,
  overrideBlurb?: string | null,
  runCountUnderPhase = 1
): string {
  if (level === "detail") return "";
  const tier: ActionRunBlurbTier = level === "overview" ? "overview" : "compact";
  const runOverride = resolveActionRunStackBlurbOverride(
    steps as Array<{ actionRunBlurb?: string | null }>,
    overrideBlurb,
    runCountUnderPhase
  );
  return buildActionRunBlurb(
    steps,
    parentTitle,
    tier,
    runOverride,
    parentExperienceGoal
  );
}