import type { FlowLink } from "@/lib/journey/flowLinks";

type ActionLike = {
  id: string;
  order: number;
  actionFlowBranchId?: string | null;
};

export function isIsolatedActionFlowLane(branchId: string | null | undefined): boolean {
  return Boolean(branchId?.startsWith("lane:"));
}

/** @deprecated Do not assign in new writes — each row gets its own `lane:uuid`. */
export function defaultSiblingLaneId(parentStepId: string) {
  return `default:${parentStepId}`;
}

function headOfSiblingChain(
  actionId: string,
  links: FlowLink[],
  ids: Set<string>
): string {
  const prev = new Map<string, string>();
  for (const link of links) {
    if (!ids.has(link.fromStepId) || !ids.has(link.toStepId)) continue;
    prev.set(link.toStepId, link.fromStepId);
  }
  let cur = actionId;
  const guard = new Set<string>();
  while (prev.has(cur) && !guard.has(cur)) {
    guard.add(cur);
    cur = prev.get(cur)!;
  }
  return cur;
}

function linksTouchingAction(actionId: string, links: FlowLink[], ids: Set<string>): boolean {
  return links.some(
    (l) =>
      ids.has(l.fromStepId) &&
      ids.has(l.toStepId) &&
      (l.fromStepId === actionId || l.toStepId === actionId)
  );
}

/**
 * One horizontal row = one lane id.
 * Persisted `lane:uuid` from the DB is authoritative; flow links only order within a row.
 */
function rowLaneKeyForAction<T extends ActionLike>(
  action: T,
  actions: T[],
  childLinks: FlowLink[]
): string {
  const branch = action.actionFlowBranchId?.trim() || null;

  if (branch?.startsWith("lane:")) {
    return branch;
  }

  const unlanedIds = new Set(
    actions.filter((a) => !a.actionFlowBranchId?.startsWith("lane:")).map((a) => a.id)
  );
  const unlanedLinks = childLinks.filter(
    (l) => unlanedIds.has(l.fromStepId) && unlanedIds.has(l.toStepId)
  );

  if (linksTouchingAction(action.id, unlanedLinks, unlanedIds)) {
    return `row:chain:${headOfSiblingChain(action.id, unlanedLinks, unlanedIds)}`;
  }

  return `row:solo:${action.id}`;
}

function mergeAwareRowKey<T extends ActionLike>(
  action: T,
  actions: T[],
  childLinks: FlowLink[]
): string | null {
  const ids = new Set(actions.map((a) => a.id));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const id of ids) {
    indegree.set(id, 0);
    outgoing.set(id, []);
  }
  for (const link of childLinks) {
    if (!ids.has(link.fromStepId) || !ids.has(link.toStepId)) continue;
    indegree.set(link.toStepId, (indegree.get(link.toStepId) ?? 0) + 1);
    outgoing.get(link.fromStepId)!.push(link.toStepId);
  }

  const mergeNodes = new Set(
    [...ids].filter((id) => (indegree.get(id) ?? 0) > 1)
  );
  if (mergeNodes.size === 0) return null;

  const trunkIds = new Set<string>();
  const queue = [...mergeNodes];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (trunkIds.has(id)) continue;
    trunkIds.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (!trunkIds.has(next)) queue.push(next);
    }
  }

  const branchFeeders = new Set<string>();
  for (const link of childLinks) {
    if (mergeNodes.has(link.toStepId)) branchFeeders.add(link.fromStepId);
  }

  if (trunkIds.has(action.id)) return "row:merge:trunk";
  if (branchFeeders.has(action.id) && !trunkIds.has(action.id)) {
    return `row:merge:branch:${action.id}`;
  }
  return null;
}

/** Merge head plus every action reachable forward via in-parent continues links. */
export function mergeTrunkActionIds<T extends { id: string }>(
  actions: T[],
  links: FlowLink[]
): Set<string> {
  const ids = new Set(actions.map((a) => a.id));
  const childLinks = links.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );
  const indegree = new Map<string, number>();
  for (const id of ids) indegree.set(id, 0);
  for (const link of childLinks) {
    indegree.set(link.toStepId, (indegree.get(link.toStepId) ?? 0) + 1);
  }
  const mergeTargets = [...ids].filter((id) => (indegree.get(id) ?? 0) > 1);
  if (mergeTargets.length === 0) return new Set();

  const trunk = new Set<string>();
  for (const head of mergeTargets) {
    const queue = [head];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (trunk.has(id)) continue;
      trunk.add(id);
      for (const link of childLinks) {
        if (link.fromStepId === id) queue.push(link.toStepId);
      }
    }
  }
  return trunk;
}

/** One horizontal trunk row (Overview → …) instead of stacked single-card “trunk” lanes. */
export function unifyMergeTrunkRuns<T extends ActionLike>(
  runs: T[][],
  links: FlowLink[],
  allInParent: T[]
): T[][] {
  const trunkIds = mergeTrunkActionIds(allInParent, links);
  if (trunkIds.size < 2) return runs;

  const childLinks = links.filter((l) => {
    const ids = new Set(allInParent.map((a) => a.id));
    return ids.has(l.fromStepId) && ids.has(l.toStepId);
  });

  const withoutTrunk: T[][] = [];
  for (const run of runs) {
    const kept = run.filter((a) => !trunkIds.has(a.id));
    if (kept.length > 0) withoutTrunk.push(kept);
  }

  const trunkRun = orderActionsForFlowTree(
    allInParent.filter((a) => trunkIds.has(a.id)),
    childLinks
  );
  if (trunkRun.length === 0) return runs;

  return [...withoutTrunk, trunkRun];
}

/**
 * Each inner array is one horizontal lane (siblings side by side); lanes stack vertically.
 */
export function groupActionsIntoSiblingRuns<T extends ActionLike>(
  actions: T[],
  links: FlowLink[],
  _parentStepId: string
): T[][] {
  if (actions.length === 0) return [];

  const ids = new Set(actions.map((a) => a.id));
  const childLinks = links.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );

  const byLane = new Map<string, T[]>();
  for (const a of actions) {
    const mergeKey = mergeAwareRowKey(a, actions, childLinks);
    const key = mergeKey ?? rowLaneKeyForAction(a, actions, childLinks);
    const list = byLane.get(key) ?? [];
    list.push(a);
    byLane.set(key, list);
  }

  const laneKeyForSort = (lane: T[]) =>
    rowLaneKeyForAction(lane[0]!, actions, childLinks);

  const isTrunk = (lane: T[]) =>
    mergeAwareRowKey(lane[0]!, actions, childLinks) === "row:merge:trunk";

  return [...byLane.values()]
    .map((lane) => orderActionsInLane(lane, childLinks))
    .sort((ga, gb) => {
      const trunkA = isTrunk(ga);
      const trunkB = isTrunk(gb);
      if (trunkA !== trunkB) return trunkA ? 1 : -1;
      const oa = ga[0]?.order ?? 0;
      const ob = gb[0]?.order ?? 0;
      if (oa !== ob) return oa - ob;
      return laneKeyForSort(ga).localeCompare(laneKeyForSort(gb));
    });
}

/** Left-to-right order within one horizontal lane. */
function orderActionsInLane<T extends { id: string; order: number }>(
  lane: T[],
  links: FlowLink[]
): T[] {
  if (lane.length < 2) {
    return [...lane].sort((a, b) => a.order - b.order);
  }

  const ids = new Set(lane.map((a) => a.id));
  const laneLinks = links.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );

  if (laneLinks.length === 0) {
    return [...lane].sort((a, b) => a.order - b.order);
  }

  return orderActionsForFlowTree(lane, laneLinks);
}

/** Layered topo order for actions under one parent when flow links exist. */
export function orderActionsForFlowTree<T extends { id: string; order: number }>(
  actions: T[],
  links: FlowLink[]
): T[] {
  if (actions.length < 2 || links.length === 0) {
    return [...actions].sort((a, b) => a.order - b.order);
  }

  const ids = new Set(actions.map((a) => a.id));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const a of actions) {
    indegree.set(a.id, 0);
    outgoing.set(a.id, []);
  }

  for (const link of links) {
    if (!ids.has(link.fromStepId) || !ids.has(link.toStepId)) continue;
    if (link.fromStepId === link.toStepId) continue;
    outgoing.get(link.fromStepId)!.push(link.toStepId);
    indegree.set(link.toStepId, (indegree.get(link.toStepId) ?? 0) + 1);
  }

  const byId = new Map(actions.map((a) => [a.id, a]));
  const layers: T[][] = [];
  const queue = actions
    .filter((a) => (indegree.get(a.id) ?? 0) === 0)
    .sort((a, b) => a.order - b.order);

  const visited = new Set<string>();
  while (queue.length > 0) {
    const layer = [...queue].sort((a, b) => a.order - b.order);
    layers.push(layer);
    queue.length = 0;
    for (const node of layer) {
      visited.add(node.id);
      for (const nextId of outgoing.get(node.id) ?? []) {
        const deg = (indegree.get(nextId) ?? 0) - 1;
        indegree.set(nextId, deg);
        if (deg === 0) {
          const next = byId.get(nextId);
          if (next) queue.push(next);
        }
      }
    }
  }

  const ordered = layers.flat();
  for (const a of actions.sort((x, y) => x.order - y.order)) {
    if (!visited.has(a.id)) ordered.push(a);
  }
  return ordered;
}

export function formatActionFlowRunLabel(
  run: { userAction: string | null; title: string }[]
): string {
  return run
    .map((a) => (a.userAction || a.title || "Action").trim())
    .filter(Boolean)
    .join(" > ");
}

export type ChildRunLaneKind = "trunk" | "branch" | "isolated" | "default";

export function classifyChildRun<T extends ActionLike>(
  run: T[],
  allInParent: T[],
  links: FlowLink[]
): ChildRunLaneKind {
  if (run.length === 0) return "default";
  const childLinks = links.filter((l) => {
    const ids = new Set(allInParent.map((a) => a.id));
    return ids.has(l.fromStepId) && ids.has(l.toStepId);
  });
  const trunkIds = mergeTrunkActionIds(allInParent, childLinks);
  if (trunkIds.has(run[0]!.id)) return "trunk";
  const mergeKey = mergeAwareRowKey(run[0]!, allInParent, childLinks);
  if (mergeKey === "row:merge:trunk") return "trunk";
  if (mergeKey?.startsWith("row:merge:branch")) return "branch";
  if (run.length === 1 && run[0]!.actionFlowBranchId?.startsWith("lane:")) return "isolated";
  return "default";
}

/**
 * Stack lanes under one parent. Merge trunks go to the **front** (first row under the
 * step) so the horizontal chain is left-aligned at column X and can extend right
 * like FigJam; feeders and dead-ends stack below.
 */
export function orderChildRunsForLayout<T extends ActionLike>(
  runs: T[][],
  links: FlowLink[]
): T[][] {
  if (runs.length < 2) return runs;

  const allInParent = runs.flat();
  const ids = new Set(allInParent.map((a) => a.id));
  const childLinks = links.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );

  const byKind = (kind: ChildRunLaneKind) =>
    runs.filter((r) => classifyChildRun(r, allInParent, childLinks) === kind);

  const sortByOrder = (list: T[][]) =>
    [...list].sort((a, b) => {
      const oa = a[0]?.order ?? 0;
      const ob = b[0]?.order ?? 0;
      if (oa !== ob) return oa - ob;
      return (a[0]?.id ?? "").localeCompare(b[0]?.id ?? "");
    });

  const defaults = sortByOrder(byKind("default"));
  const branches = sortByOrder(byKind("branch"));
  const trunks = sortByOrder(byKind("trunk"));
  const isolated = sortByOrder(byKind("isolated"));

  return [...defaults, ...trunks, ...branches, ...isolated];
}

/**
 * When persisted lanes split a continues-chain into several single-card rows, merge
 * them back into one horizontal run for layout (left → right at column front).
 */
export function coalesceSingleCardChainRuns<T extends ActionLike>(
  runs: T[][],
  links: FlowLink[]
): T[][] {
  if (runs.length < 2) return runs;

  const flat = runs.flat();
  const byId = new Map(flat.map((a) => [a.id, a]));
  const ids = new Set(byId.keys());
  const childLinks = links.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );

  const runIndex = new Map<string, number>();
  runs.forEach((r, i) => r.forEach((a) => runIndex.set(a.id, i)));

  const nextCrossRun = new Map<string, string>();
  for (const l of childLinks) {
    const fromI = runIndex.get(l.fromStepId);
    const toI = runIndex.get(l.toStepId);
    if (fromI === undefined || toI === undefined || fromI === toI) continue;
    if (runs[fromI]!.length !== 1 || runs[toI]!.length !== 1) continue;
    nextCrossRun.set(l.fromStepId, l.toStepId);
  }

  const absorbedRun = new Set<number>();
  const replacement = new Map<number, T[]>();

  for (let i = 0; i < runs.length; i++) {
    if (absorbedRun.has(i) || runs[i]!.length !== 1) continue;
    const head = runs[i]![0]!.id;
    const hasIncomingCrossRun = childLinks.some(
      (l) => l.toStepId === head && runIndex.get(l.fromStepId) !== i
    );
    if (hasIncomingCrossRun) continue;

    const chain: T[] = [...runs[i]!];
    let cur = head;
    while (nextCrossRun.has(cur)) {
      const nxtId = nextCrossRun.get(cur)!;
      const ni = runIndex.get(nxtId);
      if (ni === undefined || absorbedRun.has(ni) || runs[ni]!.length !== 1) break;
      chain.push(byId.get(nxtId)!);
      absorbedRun.add(ni);
      cur = nxtId;
    }
    if (chain.length > 1) replacement.set(i, chain);
  }

  if (replacement.size === 0) return runs;

  const out: T[][] = [];
  for (let i = 0; i < runs.length; i++) {
    if (absorbedRun.has(i)) continue;
    out.push(replacement.get(i) ?? runs[i]!);
  }
  return out;
}