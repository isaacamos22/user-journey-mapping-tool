import type { ImportDraftStep } from "@/lib/import/types";

const HTML_SCREEN = /\b([\w][\w.-]*\.html)\b/i;
const MENU_SCREEN = /\b(menu\.[\w.-]+)\b/i;

/** Screen / menu id embedded in workshop action copy (e.g. reportdaily.html, menu.drillnet). */
export function screenIdInUserAction(userAction: string): string | undefined {
  const t = userAction.trim();
  return t.match(HTML_SCREEN)?.[1] ?? t.match(MENU_SCREEN)?.[1];
}

/**
 * Touchpoint for one map action card. Prefer explicit import fields; else parse ids from text.
 * When a chain is split, only reuse parent `screen` on hops that name a screen (avoid wrong screen on "Bit Run").
 */
export function resolveActionTouchpoint(
  userAction: string,
  base: ImportDraftStep["touchpoint"],
  chainIndex: number,
  chainLength: number
): ImportDraftStep["touchpoint"] | undefined {
  const parsed = screenIdInUserAction(userAction);
  if (parsed) {
    return { module: base?.module, screen: parsed };
  }
  if (chainLength === 1 && base && (base.module || base.screen)) {
    return { module: base.module, screen: base.screen };
  }
  if (base?.module && chainLength > 1) {
    return { module: base.module };
  }
  if (base && (base.module || base.screen)) {
    return chainIndex === 0 ? { module: base.module, screen: base.screen } : undefined;
  }
  return undefined;
}