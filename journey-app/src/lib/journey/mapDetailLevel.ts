import { mapActionStackHeightPx as stackHeightForCount } from "@/lib/journey/actionRunSummary";
import { JOURNEY_MAP_CARD_GAP_PX } from "@/lib/journey/journeyFlowSpacing";

export type MapDetailLevel = "detail" | "compact" | "overview";
export type MapTierTransition = "idle" | "collapsing" | "expanding";

const TIER_RANK: Record<MapDetailLevel, number> = {
  overview: 0,
  compact: 1,
  detail: 2,
};

/**
 * @deprecated View LOD is manual (View rail). Kept for tooling / legacy references.
 * Former zoom-linked hysteresis thresholds.
 */
const THRESH = {
  detailEnter: 0.97,
  detailExit: 0.92,
  compactEnter: 0.5,
  compactExit: 0.54,
} as const;

export const MAP_TIER_TRANSITION_MS = 260;

/** Matches `minZoom` readability cap for layout estimates. */
export const MAP_MIN_VIEWPORT_ZOOM = 0.35;
export const MAP_MAX_VIEWPORT_ZOOM = 1.2;

export type MapZoomTierStop = {
  level: MapDetailLevel;
  label: string;
  hint: string;
  targetZoom: number;
};

/** Top → bottom on the zoom rail (detail = zoomed in). */
export const MAP_ZOOM_TIER_STOPS: MapZoomTierStop[] = [
  {
    level: "detail",
    label: "Detail",
    hint: "Full steps and actions",
    targetZoom: 1,
  },
  {
    level: "compact",
    label: "Combined",
    hint: "Action stack blurbs per step",
    /** Layout estimate scale (not viewport zoom). */
    targetZoom: 0.78,
  },
  {
    level: "overview",
    label: "Overview",
    hint: "Minimal step + action counts",
    targetZoom: 0.45,
  },
];

export const MAP_ZOOM_VIEWPORT_ANIM_MS = 280;

export function mapLayoutReadabilityCap(): number {
  return 1 / MAP_MIN_VIEWPORT_ZOOM;
}

export function mapReadabilityScaleFromZoom(zoom: number): number {
  if (zoom >= 1) return 1;
  return Math.min(
    mapLayoutReadabilityCap(),
    Math.max(1, 1 / Math.max(zoom, MAP_MIN_VIEWPORT_ZOOM))
  );
}

/**
 * Layout slot scale at each LOD tier — tied to zoom-rail target zoom so
 * reserved height matches typographic counter-scale (even gaps between cards).
 */
/** Layout slot scale — matches live viewport readability when `layoutZoom` is passed. */
export function mapLayoutSlotScale(
  level: MapDetailLevel,
  layoutZoom?: number
): number {
  if (level === "detail") return 1;
  if (layoutZoom != null && layoutZoom > 0) {
    return mapReadabilityScaleFromZoom(layoutZoom);
  }
  const stop = MAP_ZOOM_TIER_STOPS.find((s) => s.level === level);
  return mapReadabilityScaleFromZoom(stop?.targetZoom ?? 0.78);
}

/** Typography counter-scale for Combined / Overview (fixed per view, not live zoom). */
export function mapViewTypographicScale(level: MapDetailLevel): number {
  return mapLayoutSlotScale(level);
}

/** @deprecated Layout no longer tracks viewport zoom. */
export function mapLayoutZoomBucket(zoom: number): number {
  if (zoom >= 1) return 1;
  const scale = mapReadabilityScaleFromZoom(zoom);
  const bucketedScale = Math.round(scale * 6) / 6;
  if (bucketedScale <= 1) return zoom;
  return Math.max(MAP_MIN_VIEWPORT_ZOOM, 1 / bucketedScale);
}

/** @deprecated Use mapLayoutSlotScale — kept for any external references. */
export function mapLayoutLodMultiplier(level: MapDetailLevel): number {
  return mapLayoutSlotScale(level);
}

/** Single combined action card per sibling run when zoomed below detail. */
export const MAP_ACTION_STACK_NODE_PREFIX = "stack:";

export function mapActionStackNodeId(runHeadStepId: string): string {
  return `${MAP_ACTION_STACK_NODE_PREFIX}${runHeadStepId}`;
}

export function isMapActionStackNodeId(id: string): boolean {
  return id.startsWith(MAP_ACTION_STACK_NODE_PREFIX);
}

export function mapStacksChildActions(level: MapDetailLevel): boolean {
  return level === "compact" || level === "overview";
}

/** Content height at zoom 1 (label + action lines + count row + padding). */
export function mapActionStackHeightPx(
  level: MapDetailLevel,
  actionCount = 1,
  description?: string
): number {
  return stackHeightForCount(level, actionCount, description);
}

/** Flow-layout slot — scales with max readability so transformed/type-scaled UI never overlaps neighbors. */
export function mapActionStackLayoutHeightPx(
  level: MapDetailLevel,
  actionCount = 1,
  description?: string,
  layoutZoom?: number
): number {
  const base = mapActionStackHeightPx(level, actionCount, description);
  if (level === "detail") return base;
  return Math.ceil(base * mapLayoutSlotScale(level, layoutZoom));
}

/** Uniform vertical gap between map cards at every LOD (step, stack, lane). */
export function mapActionStackRunGapPx(_level: MapDetailLevel): number {
  void _level;
  return JOURNEY_MAP_CARD_GAP_PX;
}

/** Vertical footprint of a counter-scaled root step card in flow coordinates. */
export function mapRootLayoutFootprintPx(
  rootLayoutH: number,
  level: MapDetailLevel,
  layoutZoom?: number
): number {
  if (level === "detail") return rootLayoutH;
  return Math.ceil(rootLayoutH * mapLayoutSlotScale(level, layoutZoom));
}

/** Prefer measured DOM height; otherwise estimate from tier + zoom readability scale. */
export function resolveRootFootprintPx(
  rootLayoutH: number,
  level: MapDetailLevel,
  measuredPx?: number,
  layoutZoom?: number
): number {
  if (measuredPx != null && measuredPx > 0) return measuredPx;
  return mapRootLayoutFootprintPx(rootLayoutH, level, layoutZoom);
}

export function resolveActionStackLayoutHeightPx(
  level: MapDetailLevel,
  actionCount: number,
  description: string | undefined,
  measuredPx?: number,
  layoutZoom?: number
): number {
  if (measuredPx != null && measuredPx > 0) return measuredPx;
  return mapActionStackLayoutHeightPx(level, actionCount, description, layoutZoom);
}

export function resolveDetailLevel(
  zoom: number,
  current: MapDetailLevel
): MapDetailLevel {
  if (current === "detail") {
    if (zoom < THRESH.detailExit) {
      return zoom < THRESH.compactEnter ? "overview" : "compact";
    }
    return "detail";
  }
  if (current === "compact") {
    if (zoom >= THRESH.detailEnter) return "detail";
    if (zoom < THRESH.compactEnter) return "overview";
    return "compact";
  }
  if (zoom >= THRESH.compactExit) {
    return zoom >= THRESH.detailEnter ? "detail" : "compact";
  }
  return "overview";
}

export function tierRank(level: MapDetailLevel): number {
  return TIER_RANK[level];
}

export function tierTransitionDirection(
  from: MapDetailLevel,
  to: MapDetailLevel
): "in" | "out" | null {
  if (from === to) return null;
  return tierRank(to) > tierRank(from) ? "in" : "out";
}