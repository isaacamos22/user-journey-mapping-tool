import { Position } from "reactflow";
import {
  JOURNEY_MAP_CARD_GAP_PX,
  JOURNEY_MAP_NODE_WIDTH_PX,
} from "@/lib/journey/journeyFlowSpacing";

export const MAP_EDGE_BUNDLE_GAP_PX = 10;

/** Parallel spines for merge feeders (avoid stacked strokes on one vertical). */
export const MAP_MERGE_SPINE_GAP_PX = 7;

/** Rounded elbows on org-chart / gutter / merge wires. */
export const MAP_EDGE_CORNER_RADIUS_PX = 24;

/** Phase column connectors — slightly more sweep. */
export const MAP_EDGE_PHASE_CORNER_RADIUS_PX = 32;

/** Tighter corners on merge joins — less bulge when many paths meet. */
export const MAP_MERGE_CORNER_RADIUS_PX = 14;

const EDGE_OFFSET_SPACING_PX = MAP_EDGE_BUNDLE_GAP_PX;

type PathPoint = { x: number; y: number };

function parseLineOnlyPath(d: string): PathPoint[] | null {
  const tokens = d.trim().split(/\s+/);
  if (tokens[0] !== "M" || tokens.length < 4) return null;
  const points: PathPoint[] = [
    { x: Number.parseFloat(tokens[1]!), y: Number.parseFloat(tokens[2]!) },
  ];
  for (let i = 3; i < tokens.length; ) {
    if (tokens[i] === "L" && i + 2 < tokens.length) {
      points.push({
        x: Number.parseFloat(tokens[i + 1]!),
        y: Number.parseFloat(tokens[i + 2]!),
      });
      i += 3;
    } else {
      i += 1;
    }
  }
  return points;
}

export function roundOrthogonalPath(points: PathPoint[], radius: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [a, b] = points;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  const parts: string[] = [`M ${points[0]!.x} ${points[0]!.y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const corner = points[i]!;
    const next = points[i + 1]!;
    const v1x = corner.x - prev.x;
    const v1y = corner.y - prev.y;
    const v2x = next.x - corner.x;
    const v2y = next.y - corner.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 0.5 || len2 < 0.5) {
      parts.push(`L ${corner.x} ${corner.y}`);
      continue;
    }
    const r = Math.min(radius, len1 / 2, len2 / 2);
    const n1x = v1x / len1;
    const n1y = v1y / len1;
    const n2x = v2x / len2;
    const n2y = v2y / len2;
    const startX = corner.x - n1x * r;
    const startY = corner.y - n1y * r;
    const endX = corner.x + n2x * r;
    const endY = corner.y + n2y * r;
    parts.push(`L ${startX} ${startY}`);
    parts.push(`Q ${corner.x} ${corner.y} ${endX} ${endY}`);
  }

  const last = points[points.length - 1]!;
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(" ");
}

function withRoundedCorners(path: string, radius = MAP_EDGE_CORNER_RADIUS_PX): string {
  const pts = parseLineOnlyPath(path);
  if (!pts || pts.length < 3) return path;
  return roundOrthogonalPath(pts, radius);
}

export type MapFlowEdgeRoute =
  | "flow"
  | "chain"
  | "nest"
  | "phase"
  | "cross"
  | "crossLane"
  | "merge"
  | "crossPhase";

export const MAP_EDGE_HANDLE_PAD_PX = 12;
export const MAP_EDGE_GUTTER_INSET_PX = 22;

export type MapFlowEdgeGeometryInput = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  route: MapFlowEdgeRoute;
  /** Spread parallel edges that share a handle (0 = center). */
  bundleIndex?: number;
  bundleCount?: number;
  /** Shared bus Y for sibling nest branches under one parent. */
  busY?: number;
  gutterX?: number;
  gapX?: number;
  mergeJoinX?: number;
};

function bundleOffset(index: number, count: number): number {
  if (count <= 1) return 0;
  const centered = index - (count - 1) / 2;
  return centered * EDGE_OFFSET_SPACING_PX;
}

export function padFlowHandle(
  x: number,
  y: number,
  position: Position,
  pad = MAP_EDGE_HANDLE_PAD_PX
): { x: number; y: number } {
  switch (position) {
    case Position.Left:
      return { x: x - pad, y };
    case Position.Right:
      return { x: x + pad, y };
    case Position.Top:
      return { x, y: y - pad };
    case Position.Bottom:
      return { x, y: y + pad };
    default:
      return { x, y };
  }
}

function sameActionColumn(
  sourceHandleX: number,
  targetHandleX: number,
  nodeWidth = JOURNEY_MAP_NODE_WIDTH_PX
): boolean {
  const sourceCardLeft = sourceHandleX - nodeWidth;
  return Math.abs(sourceCardLeft - targetHandleX) < 36;
}

function targetCardRightOfSource(
  sourceHandleX: number,
  targetHandleX: number,
  nodeWidth = JOURNEY_MAP_NODE_WIDTH_PX
): boolean {
  const sourceCardLeft = sourceHandleX - nodeWidth;
  return targetHandleX > sourceCardLeft + nodeWidth * 0.55;
}

function mergeFeederViaSpine(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  spineX: number
): string {
  const pad = MAP_EDGE_HANDLE_PAD_PX;
  const ex = sx + pad;
  const ix = tx - pad;
  const path = `M ${sx} ${sy} L ${ex} ${sy} L ${spineX} ${sy} L ${spineX} ${ty} L ${ix} ${ty} L ${tx} ${ty}`;
  return withRoundedCorners(path, MAP_MERGE_CORNER_RADIUS_PX);
}

/** Merge wires follow feeder → target card positions (handles are L/R, not card X). */
export function mapMergeFeederPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  joinX?: number,
  bundleIndex = 0,
  bundleCount = 1
): string {
  const pad = MAP_EDGE_HANDLE_PAD_PX;
  const ex = sx + pad;
  const ix = tx - pad;

  if (joinX != null && bundleCount > 1) {
    const spineX = joinX + bundleOffset(bundleIndex, bundleCount) * MAP_MERGE_SPINE_GAP_PX;
    return mergeFeederViaSpine(sx, sy, tx, ty, spineX);
  }

  const dy = ty - sy;
  const sameCol = sameActionColumn(sx, tx);
  const targetRight = targetCardRightOfSource(sx, tx);

  if (joinX != null) {
    return mergeFeederViaSpine(sx, sy, tx, ty, joinX);
  }

  if (Math.abs(dy) < 8) {
    if (targetRight || sameCol) {
      return withRoundedCorners(`M ${sx} ${sy} L ${ix} ${sy} L ${tx} ${ty}`);
    }
    const spine = joinX ?? ix - 18;
    return withRoundedCorners(
      `M ${sx} ${sy} L ${ex} ${sy} L ${spine} ${sy} L ${spine} ${ty} L ${ix} ${ty} L ${tx} ${ty}`
    );
  }

  if (dy < -6) {
    if (sameCol) {
      const railX = tx + pad + 10;
      return withRoundedCorners(`M ${sx} ${sy} L ${railX} ${sy} L ${railX} ${ty} L ${ix} ${ty} L ${tx} ${ty}`);
    }
    if (targetRight) {
      const railX =
        joinX ?? Math.min(ix, Math.max(ex, tx + (sx - tx) * 0.15));
      return withRoundedCorners(`M ${sx} ${sy} L ${railX} ${sy} L ${railX} ${ty} L ${ix} ${ty} L ${tx} ${ty}`);
    }
    const spine = joinX ?? Math.min(ix - 14, sx - JOURNEY_MAP_NODE_WIDTH_PX * 0.5);
    return withRoundedCorners(
      `M ${sx} ${sy} L ${ex} ${sy} L ${spine} ${sy} L ${spine} ${ty} L ${ix} ${ty} L ${tx} ${ty}`
    );
  }

  if (dy > 6) {
    if (sameCol) {
      const railX = tx + pad + 10;
      return withRoundedCorners(`M ${sx} ${sy} L ${railX} ${sy} L ${railX} ${ty} L ${ix} ${ty} L ${tx} ${ty}`);
    }
    if (targetRight) {
      const railX = joinX ?? Math.max(ex, Math.min(ix, (sx + tx) / 2));
      return withRoundedCorners(`M ${sx} ${sy} L ${railX} ${sy} L ${railX} ${ty} L ${ix} ${ty} L ${tx} ${ty}`);
    }
    const spine = joinX ?? Math.min(ix - 14, ex - 8);
    return withRoundedCorners(`M ${sx} ${sy} L ${spine} ${sy} L ${spine} ${ty} L ${ix} ${ty} L ${tx} ${ty}`);
  }

  return withRoundedCorners(`M ${sx} ${sy} L ${tx} ${ty}`);
}

/** Route through the phase gutter (between columns), not along card edges. */
export function mapCrossPhaseCorridorPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  gapX: number,
  bundleIndex = 0,
  bundleCount = 1
): string {
  const spread = bundleOffset(bundleIndex, bundleCount);
  const gx = gapX + spread;
  const ix = tx - MAP_EDGE_HANDLE_PAD_PX;
  return withRoundedCorners(`M ${sx} ${sy} L ${gx} ${sy} L ${gx} ${ty} L ${ix} ${ty} L ${tx} ${ty}`);
}

/** Left-side spine so cross-lane wires do not cut through sibling cards (non-merge only). */
export function mapCrossLaneGutterPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  gutterX: number,
  bundleIndex = 0,
  bundleCount = 1
): string {
  const spread = bundleOffset(bundleIndex, bundleCount);
  const gx = gutterX + spread;
  const pad = MAP_EDGE_HANDLE_PAD_PX;
  const ex = sx + pad;
  const ix = tx - pad;

  if (Math.abs(sy - ty) < 8 && tx > sx) {
    return withRoundedCorners(`M ${sx} ${sy} L ${ex} ${sy} L ${ix} ${sy} L ${tx} ${ty}`);
  }

  return withRoundedCorners(
    `M ${sx} ${sy} L ${ex} ${sy} L ${gx} ${sy} L ${gx} ${ty} L ${ix} ${ty} L ${tx} ${ty}`
  );
}

/** Org-chart elbow: down → bus → across → down (shared busY keeps branches tidy). */
export function mapNestElbowPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  busY: number
): string {
  const y = Math.min(busY, ty - 10);
  const spread = Math.abs(tx - sx);
  if (spread < 24) {
    return withRoundedCorners(`M ${sx} ${sy} L ${sx} ${y} L ${tx} ${ty}`);
  }
  const midY = y + Math.min(12, (ty - y) * 0.35);
  if (tx > sx) {
    return withRoundedCorners(`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`);
  }
  return withRoundedCorners(`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`);
}

export function mapPhaseElbowPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  offset: number
): string {
  const midX = sx + (tx - sx) * 0.5 + offset;
  return withRoundedCorners(`M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`);
}

export function buildMapFlowEdgePath(input: MapFlowEdgeGeometryInput): string {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition = Position.Right,
    targetPosition = Position.Left,
    route,
    bundleIndex = 0,
    bundleCount = 1,
    busY,
    gutterX,
    gapX,
    mergeJoinX,
  } = input;

  const offset = bundleOffset(bundleIndex, bundleCount);

  if (route === "chain") {
    const ex = sourceX + MAP_EDGE_HANDLE_PAD_PX;
    const ix = targetX - MAP_EDGE_HANDLE_PAD_PX;
    if (Math.abs(sourceY - targetY) < 6) {
      return withRoundedCorners(
        `M ${sourceX} ${sourceY} L ${ex} ${sourceY} L ${ix} ${targetY} L ${targetX} ${targetY}`
      );
    }
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  if (route === "nest") {
    const drop =
      busY ??
      sourceY + Math.max(JOURNEY_MAP_CARD_GAP_PX * 0.55, Math.min(28, (targetY - sourceY) * 0.38));
    return mapNestElbowPath(
      sourceX,
      sourceY + MAP_EDGE_HANDLE_PAD_PX * 0.35,
      targetX,
      targetY - MAP_EDGE_HANDLE_PAD_PX * 0.35,
      drop + offset * 0.15
    );
  }

  if (route === "merge") {
    return mapMergeFeederPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      mergeJoinX,
      bundleIndex,
      bundleCount
    );
  }

  if (route === "crossPhase" && gapX != null) {
    return mapCrossPhaseCorridorPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      gapX,
      bundleIndex,
      bundleCount
    );
  }

  if (route === "crossLane" && gutterX != null) {
    return mapCrossLaneGutterPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      gutterX,
      bundleIndex,
      bundleCount
    );
  }

  // cross / phase paths are drawn via getSmoothStepPath in JourneyMapFlowEdge
  return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
}

export function busYForNestEdges(
  sourceY: number,
  targetYs: number[]
): number {
  if (targetYs.length === 0) {
    return sourceY + JOURNEY_MAP_CARD_GAP_PX * 0.55;
  }
  const topTarget = Math.min(...targetYs);
  return Math.min(
    topTarget - 12,
    sourceY + JOURNEY_MAP_CARD_GAP_PX * 0.55
  );
}

export function edgeBundleIndex(
  groups: Map<string, string[]>,
  edgeId: string,
  groupKey: string
): { index: number; count: number } {
  const list = groups.get(groupKey) ?? [];
  const index = list.indexOf(edgeId);
  return { index: index >= 0 ? index : 0, count: Math.max(1, list.length) };
}

export function registerEdgeBundle(
  groups: Map<string, string[]>,
  groupKey: string,
  edgeId: string
) {
  const list = groups.get(groupKey) ?? [];
  list.push(edgeId);
  groups.set(groupKey, list);
}

type MapFlowEdgeLike = {
  id: string;
  source: string;
  target: string;
  data?: { route?: string };
};

/** Multiple cross-lane links into one card → shared merge spine with parallel verticals. */
export function assignMergeFeederRoutes<T extends MapFlowEdgeLike>(
  edges: T[],
  cardLeftByStepId: Map<string, number>,
  sourceYByStepId: Map<string, number> = new Map()
): T[] {
  const feedersByTarget = new Map<string, T[]>();
  for (const e of edges) {
    if (!e.id.startsWith("e-flowlink-")) continue;
    if ((e.data?.route ?? "flow") !== "flow") continue;
    const list = feedersByTarget.get(e.target) ?? [];
    list.push(e);
    feedersByTarget.set(e.target, list);
  }

  const mergeSpineXByTarget = new Map<string, number>();
  for (const [targetId, group] of feedersByTarget) {
    if (group.length < 2) continue;
    const left = cardLeftByStepId.get(targetId);
    if (left == null) continue;
    mergeSpineXByTarget.set(
      targetId,
      left - MAP_EDGE_GUTTER_INSET_PX - MAP_EDGE_HANDLE_PAD_PX
    );
  }

  if (mergeSpineXByTarget.size === 0) return edges;

  return edges.map((e) => {
    const joinX = mergeSpineXByTarget.get(e.target);
    if (joinX == null) return e;
    const group = feedersByTarget.get(e.target)!;
    const sorted = [...group].sort(
      (a, b) =>
        (sourceYByStepId.get(a.source) ?? 0) - (sourceYByStepId.get(b.source) ?? 0)
    );
    const bundleIndex = sorted.findIndex((x) => x.id === e.id);
    return {
      ...e,
      data: {
        ...(e.data as object),
        route: "merge",
        mergeJoinX: joinX,
        bundleIndex: bundleIndex >= 0 ? bundleIndex : 0,
        bundleCount: group.length,
      },
    };
  });
}

export function phaseCorridorGapX(
  fromX: number,
  toX: number,
  nodeWidth: number
): number {
  const exitX = fromX + nodeWidth;
  const entryX = toX;
  if (entryX <= exitX + 12) {
    return exitX + 28;
  }
  return exitX + (entryX - exitX) * 0.42;
}