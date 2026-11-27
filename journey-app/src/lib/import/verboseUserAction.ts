import type { ImportDraft, ImportDraftAction, ImportDraftStep } from "@/lib/import/types";

export type UserActionVerbosityCtx = {
  actionTitle?: string;
  stepTitle?: string;
  phaseTitle?: string;
  experienceGoal?: string;
  module?: string;
  screen?: string;
};

const WORKFLOW_VERB =
  /^(user\s+)?(open|select|review|create|edit|enter|confirm|navigate|choose|bind|switch|update|record|validate|carry|work|pick|set|link|run|save|publish|batch|recognize|orient|capture|close|reuse|improve|bulk|import|apply|start|complete|ensure)\b/i;

/** True when copy reads like a menu/screen label rather than what the user is doing. */
export function looksTerseScreenLabel(text: string): boolean {
  const t = text.trim();
  if (!t || t.length >= 56) return false;
  if (/\b(so that|in order to|because|while|when|before|after|without|ensure that|confirm that)\b/i.test(t)) {
    return false;
  }
  if (/→|->|=>/.test(t)) return false;

  const hasVerb = WORKFLOW_VERB.test(t);
  if (hasVerb && t.length >= 36) return false;
  if (hasVerb && /\b(the|for|on|in|from|into|with|today'?s|selected|reporting|operation|screen)\b/i.test(t)) {
    return false;
  }

  if (/\.html$/i.test(t) || /^menu\./i.test(t)) return true;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && !/\b(and|or|then|variants?|folder)\b/i.test(t)) return true;

  return !hasVerb;
}

function humanizeScreen(screen: string): string {
  const s = screen.trim();
  if (!s) return "";
  const base = s.replace(/\.html?$/i, "").replace(/^\/+/, "");
  if (/^reportdaily$/i.test(base) || /reportdaily/i.test(base)) return "Daily report";
  if (/menu\./i.test(base)) return `main menu (${s})`;
  if (base.includes("/") || base.includes("›")) return base;
  return `${base} (${s})`;
}

function verbFromLaneHint(actionTitle?: string, stepTitle?: string, label?: string): string {
  const blob = `${actionTitle ?? ""} ${stepTitle ?? ""}`.toLowerCase();
  const l = (label ?? "").toLowerCase();
  if (/context\s*chain|well|wellbore|operation|reporting\s*day/.test(blob + l)) return "Select";
  if (/switch|carry|new\s*day/.test(l)) return "Switch to";
  if (/batch|bulk|rsd|coding/.test(blob + l)) return "Run";
  if (/confirm|validate|check/.test(l)) return "Confirm";
  if (/menu|navigate|open/.test(blob + l)) return "Open";
  if (/review|orient|plan|pick|choose/.test(blob + l)) return "Review";
  if (/create|bind|select/.test(l)) return "Create or select";
  return "Open or update";
}

function expandOpenPhrase(label: string, ctx: UserActionVerbosityCtx): string {
  const rest = label.replace(/^open\s+/i, "").trim();
  const mod = ctx.module?.trim() || "DrillNet";
  const screenHint = ctx.screen ? humanizeScreen(ctx.screen) : undefined;
  if (rest.length < 24) {
    const target = screenHint && !rest.toLowerCase().includes(screenHint.split(" ")[0]!.toLowerCase())
      ? `${rest} — ${screenHint}`
      : rest;
    return `Open the ${target} screen in ${mod}`;
  }
  return label;
}

/**
 * Turn inventory / screen-traversal labels into stakeholder-readable user actions.
 * Keeps already-verbose workshop copy unchanged.
 */
export function verbosifyUserAction(raw: string, ctx: UserActionVerbosityCtx = {}): string {
  const label = raw.trim();
  if (!label) return label;
  if (!looksTerseScreenLabel(label)) return label;

  if (/^open\s+/i.test(label)) {
    return expandOpenPhrase(label, ctx).slice(0, 500);
  }

  const mod = ctx.module?.trim() || "the application";
  const screenHint = ctx.screen?.trim() ? humanizeScreen(ctx.screen) : undefined;
  const verb = verbFromLaneHint(ctx.actionTitle, ctx.stepTitle, label);

  let phrase = label;
  if (/^menu\./i.test(label)) {
    phrase = `the ${mod} main menu (${label})`;
    return `Open ${phrase} to reach the reporting screens you need`.slice(0, 500);
  }

  if (ctx.actionTitle && ctx.actionTitle !== label && label.length < 28) {
    const lane = ctx.actionTitle.toLowerCase();
    if (lane.includes("context")) {
      return `${verb} the ${label} for today's reporting context`.slice(0, 500);
    }
  }

  let out = `${verb} ${phrase}`;
  if (screenHint && !out.toLowerCase().includes(screenHint.slice(0, 6).toLowerCase())) {
    out += ` on ${screenHint}`;
  } else if (mod && mod !== "the application" && out.length < 40) {
    out += ` in ${mod}`;
  }

  return out.slice(0, 500);
}

function touch(ctx: ImportDraftAction | ImportDraftStep) {
  const tp = ctx.touchpoint;
  return { module: tp?.module, screen: tp?.screen };
}

function enrichAction(
  a: ImportDraftAction,
  step: ImportDraftStep
): ImportDraftAction {
  const baseCtx: UserActionVerbosityCtx = {
    actionTitle: a.title,
    stepTitle: step.title,
    phaseTitle: step.phaseTitle,
    experienceGoal: step.experienceGoal,
    ...touch(a),
  };
  const ua = a.userAction?.trim();
  if (!ua) return a;
  return {
    ...a,
    userAction: verbosifyUserAction(ua, baseCtx),
  };
}

function enrichStep(step: ImportDraftStep): ImportDraftStep {
  const stepCtx: UserActionVerbosityCtx = {
    stepTitle: step.title,
    phaseTitle: step.phaseTitle,
    experienceGoal: step.experienceGoal,
    ...touch(step),
  };

  let next = step;
  if (step.actions?.length) {
    next = {
      ...next,
      actions: step.actions.map((a) => enrichAction(a, step)),
    };
  }
  if (step.userAction?.trim()) {
    next = {
      ...next,
      userAction: verbosifyUserAction(step.userAction.trim(), stepCtx),
    };
  }
  return next;
}

/** Run on every import draft before apply (workshop JSON, zip inventories, CSV). */
export function enrichImportDraftUserActionCopy(draft: ImportDraft): ImportDraft {
  if (draft.exportPackV1) return draft;
  return {
    ...draft,
    steps: draft.steps.map(enrichStep),
  };
}