/** Stored on pain evidence when import guessed the value. */
export const IMPORT_ASSUMED_EVIDENCE = "Assumed at import — not stated in workshop source";

export const ASSUMED_TITLE_SUFFIX = " (Assumed)";

/** @deprecated Prefer meaningfulAssumedTitle; kept for legacy JSON cleanup. */
export const IMPORT_ASSUMED_PREFIX = "[Assumed] ";

export function meaningfulAssumedTitle(label: string): string {
  let t = label
    .trim()
    .replace(/^\[Assumed\]\s*/i, "")
    .replace(/\s*\(Assumed\)\s*$/i, "");
  if (!t) t = "Needs review";
  if (t.length > 140) t = `${t.slice(0, 137)}…`;
  return `${t}${ASSUMED_TITLE_SUFFIX}`;
}

/** Body copy for assumed fields — no bracket prefix; use title suffix + pain evidence instead. */
export function assumedBodyCopy(text: string, fallback: string): string {
  const t = text.trim().replace(/^\[Assumed\]\s*/i, "");
  return t || fallback;
}

export function markAssumedDescription(text: string): string {
  return assumedBodyCopy(text, "Needs validation on the map.");
}