import type { ImportDraftAction, ImportDraftStep } from "@/lib/import/types";
import { resolveActionTouchpoint } from "@/lib/import/inferActionTouchpoint";

const CHAIN_SPLIT = /\s*(?:→|->|=>|—>)\s*/u;

export function splitUserActionChain(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(CHAIN_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [trimmed];
}

export type ExpandedActionSeed = {
  title: string;
  userAction: string;
  touchpoint?: ImportDraftStep["touchpoint"];
  userActionAssumed?: boolean;
  actionKey: string;
  actionLane: string;
  continuesAfter?: string | string[];
  actionRunBlurb?: string;
};

export type ActionFlowContinues = {
  fromKey: string;
  toKey: string;
};

function normalizeContinuesAfter(raw: string | string[] | undefined): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((k) => k.trim()).filter(Boolean);
  const one = raw.trim();
  return one ? [one] : [];
}

function laneKey(lane: string | number | undefined, fallback: string): string {
  if (lane === undefined || lane === null || lane === "") return fallback;
  return String(lane);
}

/**
 * Expands workshop actions into map rows: splits `→` chains, groups by `actionLane`,
 * and plans `continues` links within each lane.
 */
export function expandStepActions(step: ImportDraftStep): {
  seeds: ExpandedActionSeed[];
  continues: ActionFlowContinues[];
  usedExplicitLanes: boolean;
} {
  const continues: ActionFlowContinues[] = [];
  const seeds: ExpandedActionSeed[] = [];

  const source: ImportDraftAction[] = [];
  if (step.actions?.length) {
    for (const a of step.actions) {
      const ua = a.userAction?.trim();
      if (!ua) continue;
      source.push(a);
    }
  } else if (step.userAction?.trim()) {
    source.push({
      userAction: step.userAction.trim(),
      userActionAssumed: step.userActionAssumed,
      touchpoint: step.touchpoint,
    });
  }

  if (source.length === 0) {
    return { seeds: [], continues: [], usedExplicitLanes: false };
  }

  const usedExplicitLanes = source.some(
    (a) => a.actionLane !== undefined && a.actionLane !== null && a.actionLane !== ""
  );

  let flatIndex = 0;
  for (let i = 0; i < source.length; i++) {
    const a = source[i]!;
    const parts = splitUserActionChain(a.userAction);
    const lane = usedExplicitLanes
      ? laneKey(a.actionLane, `row-${i + 1}`)
      : parts.length > 1
        ? `chain-${i}`
        : `solo-${i}`;

    const baseKey = a.actionKey?.trim() || `a${i + 1}`;

    parts.forEach((part, pi) => {
      const key = parts.length > 1 ? `${baseKey}.${pi + 1}` : baseKey;
      const title = a.title?.trim() || part;
      const mergeAfter =
        pi === 0
          ? normalizeContinuesAfter(a.continuesAfter)
          : parts.length > 1
            ? [`${baseKey}.${pi}`]
            : undefined;
      seeds.push({
        title: parts.length > 1 ? title : a.title?.trim() || part,
        userAction: part,
        userActionAssumed: a.userActionAssumed,
        touchpoint: resolveActionTouchpoint(part, a.touchpoint, pi, parts.length),
        actionKey: key,
        actionLane: lane,
        continuesAfter: mergeAfter?.length ? mergeAfter : undefined,
        actionRunBlurb: pi === 0 ? a.actionRunBlurb?.trim() : undefined,
      });
      flatIndex += 1;
      void flatIndex;
    });
  }

  const byLane = new Map<string, ExpandedActionSeed[]>();
  for (const s of seeds) {
    const list = byLane.get(s.actionLane) ?? [];
    list.push(s);
    byLane.set(s.actionLane, list);
  }

  const keySet = new Set(seeds.map((s) => s.actionKey));
  for (const laneSeeds of byLane.values()) {
    for (let j = 0; j < laneSeeds.length; j++) {
      const cur = laneSeeds[j]!;
      const mergeKeys = normalizeContinuesAfter(cur.continuesAfter);
      if (mergeKeys.length) {
        let linked = false;
        for (const fromKey of mergeKeys) {
          if (keySet.has(fromKey)) {
            continues.push({ fromKey, toKey: cur.actionKey });
            linked = true;
          }
        }
        if (linked) continue;
      }
      if (j === 0) continue;
      const prev = laneSeeds[j - 1]!;
      continues.push({ fromKey: prev.actionKey, toKey: cur.actionKey });
    }
  }

  const uniqueLinks = new Map<string, ActionFlowContinues>();
  for (const link of continues) {
    uniqueLinks.set(`${link.fromKey}→${link.toKey}`, link);
  }

  return {
    seeds,
    continues: [...uniqueLinks.values()],
    usedExplicitLanes,
  };
}

export function stepHasParallelActions(step: ImportDraftStep): boolean {
  const actions = step.actions?.filter((a) => a.userAction?.trim()) ?? [];
  if (actions.length < 2) return false;
  const withLane = actions.filter(
    (a) => a.actionLane !== undefined && a.actionLane !== null && a.actionLane !== ""
  );
  if (withLane.length === 0) return true;
  const lanes = new Set(withLane.map((a) => String(a.actionLane)));
  return lanes.size >= 2 || withLane.length < actions.length;
}