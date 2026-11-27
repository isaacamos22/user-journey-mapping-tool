import type { ImportDraft, ImportDraftAction, ImportDraftStep } from "@/lib/import/types";
import { splitWorkshopBullets } from "@/lib/import/splitWorkshopBullets";

const USER_ACTION_VERB =
  /^(user\s+)?(\[[\w/]+\]\s*)?(open|select|review|create|edit|enter|confirm|navigate|choose|bind|switch|update|record|validate|carry|work|pick|set|link|run|save|publish|batch|recognize|orient|capture|close|reuse|import|apply|start|complete|ensure|add|remove|delete|filter|search|view|log|sign|click|submit|upload|download|fill|cancel|check|verify|ensure|index|flag|follow|re-?index|cross[\s-]?check|refer|troubleshoot|use)\b/i;

const BRACKETED_TASK = /^\[[\w/]+\]\s+\w+/;

/** Sticky / JSON text that belongs on the workshop frustrations row, not user actions. */
export function looksLikeFrictionBullet(text: string): boolean {
  const s = text.trim();
  if (!s || s.length < 6) return false;
  if (/^(pain|friction|frustration|problem|issue)\b/i.test(s)) return true;
  if (/\b(showstopper|got frustrated|reverting to manual|relies heavily|not everyone able|unable to provide)\b/i.test(s)) {
    return true;
  }
  if (/^when\s+the\s+/i.test(s)) return true;
  if (
    /\b(too (many|much|slow|long)|hard to|difficult to|confus|unclear|missing|lack of|don'?t know|cannot find|can'?t find|duplicate|error[- ]prone|frustrat|bottleneck|handoff|re-?key|rekey|stale data|out of sync)\b/i.test(
      s
    )
  ) {
    if (USER_ACTION_VERB.test(s) && s.length < 88) return false;
    return true;
  }
  if (/\btoo many manual\b/i.test(s)) return true;
  if (!USER_ACTION_VERB.test(s) && !BRACKETED_TASK.test(s) && /\b(wish|would be nice|pain point|negative|complaint)\b/i.test(s)) {
    return true;
  }
  return false;
}

/** Sticky / JSON text that belongs on the opportunities row, not user actions. */
export function looksLikeOpportunityBullet(text: string): boolean {
  const s = text.trim();
  if (!s || s.length < 6) return false;
  if (/^opportunit/i.test(s)) return true;
  if (
    /^(if we|we could|we should|could |should |enable |allow users|reduce |eliminate |streamline |provide |auto[\s-]|simplify |consolidate |surface |highlight |prevent |default |pre-?filled|guided setup|standardize )/i.test(
      s
    )
  ) {
    return true;
  }
  if (/\b(auto[\s-]?translat|color[\s-]?coded|notification when|auto[\s-]?flag|playbook for|automate tests|automate well)\b/i.test(s)) {
    return true;
  }
  if (/^guide to (check|verify|ensure|restart)/i.test(s) && !BRACKETED_TASK.test(s)) return true;
  if (
    /\b(future state|to improve|improvement|idea:|hypothesis|value prop|north star|workshop:\s*prioritize)\b/i.test(s) &&
    !USER_ACTION_VERB.test(s)
  ) {
    return true;
  }
  return false;
}

export type DemotedUserAction = {
  userAction?: string;
  friction: string[];
  opportunity: string[];
};

/** Split mixed stickies into as-is user action vs frustration/opportunity clauses. */
export function demoteMixedUserAction(text: string): DemotedUserAction {
  const s = text.trim();
  const friction: string[] = [];
  const opportunity: string[] = [];
  if (!s) return { friction, opportunity };

  if (looksLikeOpportunityBullet(s)) return { opportunity: [s], friction };
  if (looksLikeFrictionBullet(s)) return { friction: [s], opportunity };

  const asMatch = s.match(/^([\s\S]+?)\s+as\s+([\s\S]+)$/i);
  if (asMatch) {
    const task = asMatch[1]!.trim();
    const clause = asMatch[2]!.trim();
    if (/\bnot everyone|unable to|frustrat|relies heavily\b/i.test(clause)) {
      if (/^troubleshooting guide/i.test(task)) {
        return {
          userAction: "Follow troubleshooting guide; open engineering ticket when steps exhausted",
          friction: [clause.replace(/\s*[—–-]\s*engineering ticket.*/i, "").trim() || clause],
          opportunity,
        };
      }
      if (USER_ACTION_VERB.test(task) || BRACKETED_TASK.test(task)) {
        return { userAction: task, friction: [clause], opportunity };
      }
      return { friction: [s], opportunity };
    }
  }

  const dashParts = s.split(/\s+[—–]\s+|\s+-\s+(?=[A-Za-z])/);
  if (dashParts.length >= 2) {
    const head = dashParts[0]!.trim();
    const tail = dashParts.slice(1).join(" — ").trim();
    const tailIsInsight =
      looksLikeFrictionBullet(tail) ||
      looksLikeOpportunityBullet(tail) ||
      /\bengineering ticket when guide\b/i.test(tail);
  if (tailIsInsight && (USER_ACTION_VERB.test(head) || BRACKETED_TASK.test(head))) {
      if (looksLikeOpportunityBullet(tail)) opportunity.push(tail);
      else friction.push(tail);
      return { userAction: head, friction, opportunity };
    }
  }

  if (/\bengineering ticket when guide steps exhausted\b/i.test(s) && /^troubleshooting guide/i.test(s)) {
    return {
      userAction: "Follow troubleshooting guide; open engineering ticket when steps exhausted",
      friction: ["Not everyone able to figure out what steps are needed"],
      opportunity,
    };
  }

  return { userAction: s, friction, opportunity };
}

function rowHintIsFriction(meta: string): boolean {
  return /friction|frustrat|pain\s*point|problems?\b/i.test(meta);
}

function rowHintIsOpportunity(meta: string): boolean {
  return /opportunit|improvement|ideas?\b/i.test(meta);
}

function appendBullets(existing: string[] | undefined, items: string[]): string[] {
  const out = [...(existing ?? [])];
  const seen = new Set(out.map((x) => x.toLowerCase()));
  for (const item of items) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergePainDescription(step: ImportDraftStep, bullets: string[]): ImportDraftStep {
  if (!bullets.length) return step;
  const joined = bullets.join("; ");
  if (step.pain?.description?.trim()) {
    const parts = new Set([...splitWorkshopBullets(step.pain.description), ...bullets]);
    return {
      ...step,
      frictions: appendBullets(step.frictions, bullets),
      pain: { ...step.pain, description: [...parts].join("; ") },
    };
  }
  return {
    ...step,
    frictions: appendBullets(step.frictions, bullets),
    pain: { description: joined, severity: step.pain?.severity ?? 3, assumed: step.pain?.assumed },
  };
}

function mergeOpportunityCell(step: ImportDraftStep, bullets: string[]): ImportDraftStep {
  if (!bullets.length) return step;
  const joined = bullets.join("; ");
  const prior = step.opportunity?.trim();
  return {
    ...step,
    opportunities: appendBullets(step.opportunities, bullets),
    opportunity: prior ? `${prior}; ${joined}` : joined,
  };
}

/** Move mis-labeled frustrations / opportunities out of `actions[]`; strip non-action fields from nested actions. */
export function separateWorkshopRowsOnStep(step: ImportDraftStep): ImportDraftStep {
  let next: ImportDraftStep = { ...step };
  const frictionMoved: string[] = [];
  const opportunityMoved: string[] = [];
  const kept: ImportDraftAction[] = [];

  for (const a of step.actions ?? []) {
    const ua = a.userAction?.trim();
    if (!ua) continue;
    const meta = `${a.actionLane ?? ""} ${a.title ?? ""}`.toLowerCase();
    if (rowHintIsFriction(meta)) {
      frictionMoved.push(ua);
      continue;
    }
    if (rowHintIsOpportunity(meta)) {
      opportunityMoved.push(ua);
      continue;
    }

    const demoted = demoteMixedUserAction(ua);
    frictionMoved.push(...demoted.friction);
    opportunityMoved.push(...demoted.opportunity);

    const clean = demoted.userAction?.trim();
    if (!clean || looksLikeOpportunityBullet(clean) || looksLikeFrictionBullet(clean)) {
      if (clean) {
        if (looksLikeOpportunityBullet(clean)) opportunityMoved.push(clean);
        else frictionMoved.push(clean);
      }
      continue;
    }

    const { pain: _p, feelings: _f, ...actionOnly } = a;
    kept.push({ ...actionOnly, userAction: clean });
  }

  next = mergePainDescription(next, frictionMoved);
  next = mergeOpportunityCell(next, opportunityMoved);
  next.actions = kept.length ? kept : undefined;

  const rootUa = next.userAction?.trim();
  if (rootUa) {
    const demoted = demoteMixedUserAction(rootUa);
    if (demoted.friction.length || demoted.opportunity.length) {
      next = mergePainDescription(next, demoted.friction);
      next = mergeOpportunityCell(next, demoted.opportunity);
      next.userAction = demoted.userAction;
    }
    if (next.userAction && (next.actions?.length ?? 0) > 0) {
      if (looksLikeFrictionBullet(next.userAction) || looksLikeOpportunityBullet(next.userAction)) {
        next = { ...next, userAction: undefined };
      }
    } else if (next.userAction && looksLikeFrictionBullet(next.userAction)) {
      next = mergePainDescription({ ...next, userAction: undefined }, [rootUa]);
    } else if (next.userAction && looksLikeOpportunityBullet(next.userAction)) {
      next = mergeOpportunityCell({ ...next, userAction: undefined }, [rootUa]);
    }
  }

  return next;
}

export function sanitizeImportDraftWorkshopRows(draft: ImportDraft): ImportDraft {
  if (draft.exportPackV1) return draft;
  return {
    ...draft,
    steps: draft.steps.map(separateWorkshopRowsOnStep),
  };
}