import type { MapDetailLevel } from "@/lib/journey/mapDetailLevel";
import { MAP_ACTION_STACK_BLURB_LINES } from "@/lib/journey/actionRunBlurb";

export type ActionLineSource = {
  userAction?: string | null;
  title: string;
  touchpoint?: string | null;
};

export function actionLineFromStep(step: ActionLineSource): string {
  const line = (step.userAction || step.title).trim();
  return line || step.title.trim();
}

function sentenceFragment(text: string): string {
  const t = text.trim().replace(/[.!?]+$/, "");
  if (!t) return "";
  if (t.length === 1) return t.toLowerCase();
  return `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

/** Strip workshop lane tags like `[D2/TNP]` for readable summaries. */
export function stripActionLaneTag(text: string): string {
  return text.replace(/^\[[^\]]+\]\s*/, "").trim();
}

/** One phrase per action — place included when we have a touchpoint. */
export function actionPhraseFromStep(step: ActionLineSource): string {
  const action = stripActionLaneTag(actionLineFromStep(step));
  const tp = step.touchpoint?.trim();
  if (!tp) return action;
  const shortTp = tp.replace(/^menu\./i, "").replace(/\.html$/i, "");
  return `${action} (${shortTp})`;
}

/**
 * @deprecated Prefer buildActionRunBlurb for map stacks; kept for tooling.
 */
export function buildActionRunDescription(steps: ActionLineSource[]): string {
  const phrases = steps.map(actionPhraseFromStep).map((s) => s.trim()).filter(Boolean);
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0]!;
  if (phrases.length === 2) {
    return `${phrases[0]}. Then ${sentenceFragment(phrases[1]!)}.`;
  }
  const last = phrases[phrases.length - 1]!;
  const body = phrases.slice(0, -1).join("; ");
  return `${body}; and ${sentenceFragment(last)}.`;
}

/** Full numbered text for tooltips / screen readers. */
export function formatActionRunFullSummary(steps: ActionLineSource[]): string {
  return steps
    .map(actionPhraseFromStep)
    .map((line, i) => `${i + 1}. ${line}`)
    .join(" · ");
}

const STACK_LABEL_PX = 22;
const STACK_PAD_PX = 32;
const STACK_GAP_PX = 8;
/** Matches ~0.8125rem × 1.4 line-height in flow coords at typical counter-scale. */
const STACK_LINE_PX = 23;
/** Extra slot padding so flow layout clears counter-scaled card boxes. */
export const MAP_ACTION_STACK_LAYOUT_BUFFER_PX = 6;

function descriptionLayoutLines(level: MapDetailLevel): number {
  if (level === "overview") return MAP_ACTION_STACK_BLURB_LINES.overview;
  if (level === "compact") return MAP_ACTION_STACK_BLURB_LINES.compact;
  return 2;
}

export function mapActionStackHeightPx(
  level: MapDetailLevel,
  actionCount = 1,
  description?: string
): number {
  void actionCount;
  const descLines = descriptionLayoutLines(level);
  return (
    STACK_PAD_PX +
    STACK_LABEL_PX +
    descLines * STACK_LINE_PX +
    STACK_GAP_PX +
    MAP_ACTION_STACK_LAYOUT_BUFFER_PX
  );
}