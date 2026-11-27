import Dagre from "@dagrejs/dagre";
import {
  JOURNEY_MAP_ACTION_H_GAP_PX,
  JOURNEY_MAP_CARD_GAP_PX,
  JOURNEY_MAP_NODE_WIDTH_PX,
} from "@/lib/journey/journeyFlowSpacing";
import type { FlowLink } from "@/lib/journey/flowLinks";

const NODE_W = JOURNEY_MAP_NODE_WIDTH_PX;
const ACTION_H_GAP = JOURNEY_MAP_ACTION_H_GAP_PX;
const CARD_GAP = JOURNEY_MAP_CARD_GAP_PX;

export type HeightResolver = (stepId: string) => number;

/**
 * Layered left-to-right layout for actions under one step (Dagre / Sugiyama family).
 * Merge feeders and trunk chains resolve in flow direction; orphans stack below.
 */
export function layoutActionSubgraphDagre(
  children: { id: string; order: number }[],
  flowLinks: FlowLink[],
  heightFor: HeightResolver,
  anchorX: number,
  anchorY: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (children.length === 0) return positions;

  const ids = new Set(children.map((c) => c.id));
  const childLinks = flowLinks.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );

  const touched = new Set<string>();
  for (const l of childLinks) {
    touched.add(l.fromStepId);
    touched.add(l.toStepId);
  }

  const linked = children.filter((c) => touched.has(c.id));
  const orphans = children
    .filter((c) => !touched.has(c.id))
    .sort((a, b) => a.order - b.order);

  if (linked.length > 0) {
    const g = new Dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "LR",
      nodesep: Math.max(ACTION_H_GAP, 36),
      ranksep: CARD_GAP,
      edgesep: 24,
      align: "UL",
      ranker: "network-simplex",
      marginx: 8,
      marginy: 8,
    });

    for (const c of linked) {
      const h = Math.max(heightFor(c.id), 56);
      g.setNode(c.id, { width: NODE_W, height: h });
    }

    for (const l of childLinks) {
      g.setEdge(l.fromStepId, l.toStepId, { weight: 2, minlen: 2 });
    }

    Dagre.layout(g);

    let minLeft = Infinity;
    for (const c of linked) {
      const n = g.node(c.id);
      const h = heightFor(c.id);
      const x = anchorX + n.x - NODE_W / 2;
      const y = anchorY + n.y - h / 2;
      positions.set(c.id, { x, y });
      minLeft = Math.min(minLeft, x);
    }

    if (minLeft > anchorX + 0.5) {
      const shift = minLeft - anchorX;
      for (const c of linked) {
        const p = positions.get(c.id)!;
        positions.set(c.id, { x: p.x - shift, y: p.y });
      }
    }
  }

  let orphanY = anchorY;
  if (linked.length > 0) {
    let maxBottom = anchorY;
    for (const c of linked) {
      const p = positions.get(c.id)!;
      maxBottom = Math.max(maxBottom, p.y + heightFor(c.id));
    }
    orphanY = maxBottom + CARD_GAP;
  }

  for (const o of orphans) {
    positions.set(o.id, { x: anchorX, y: orphanY });
    orphanY += heightFor(o.id) + CARD_GAP;
  }

  return positions;
}

export function subgraphWidthPx(
  positions: Map<string, { x: number; y: number }>,
  childIds: string[],
  heightFor: HeightResolver
): number {
  let maxRight = NODE_W;
  for (const id of childIds) {
    const p = positions.get(id);
    if (!p) continue;
    maxRight = Math.max(maxRight, p.x + NODE_W);
  }
  return maxRight;
}