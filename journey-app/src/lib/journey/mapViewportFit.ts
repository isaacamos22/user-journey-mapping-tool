import type { Node } from "reactflow";
import { JOURNEY_MAP_NODE_WIDTH_PX } from "@/lib/journey/journeyFlowSpacing";
import { isMapActionStackNodeId } from "@/lib/journey/mapDetailLevel";
import {
  MAP_MAX_VIEWPORT_ZOOM,
  MAP_MIN_VIEWPORT_ZOOM,
} from "@/lib/journey/mapDetailLevel";

export type MapContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function mapNodeLayoutHeight(n: Node): number {
  const mh = n.style?.minHeight;
  if (typeof mh === "number" && mh > 0) return mh;
  const measured = (n as Node & { measured?: { height?: number } }).measured;
  if (typeof measured?.height === "number" && measured.height > 0) {
    return measured.height;
  }
  if (typeof n.height === "number" && n.height > 0) return n.height;
  return 120;
}

const NODE_W = JOURNEY_MAP_NODE_WIDTH_PX;

/** Root phase step whose column band best matches a horizontal pan position (flow coords). */
export function pickRootPhaseStepIdAtFlowX(
  nodes: Node[],
  rootStepIds: ReadonlySet<string>,
  flowCenterX: number
): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    if (!rootStepIds.has(n.id) || isMapActionStackNodeId(n.id)) continue;
    const w = typeof n.width === "number" && n.width > 0 ? n.width : NODE_W;
    const cx = n.position.x + w / 2;
    const d = Math.abs(cx - flowCenterX);
    if (d < bestDist) {
      bestDist = d;
      bestId = n.id;
    }
  }
  return bestId;
}

export function pickMapNodeAtFlow(nodes: Node[], fx: number, fy: number): Node | null {
  for (const n of nodes) {
    const w = typeof n.width === "number" && n.width > 0 ? n.width : NODE_W;
    const h = mapNodeLayoutHeight(n);
    if (fx >= n.position.x && fx <= n.position.x + w && fy >= n.position.y && fy <= n.position.y + h) {
      return n;
    }
  }
  let best: Node | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const w = typeof n.width === "number" && n.width > 0 ? n.width : NODE_W;
    const h = mapNodeLayoutHeight(n);
    const cx = n.position.x + w / 2;
    const cy = n.position.y + h / 2;
    const d = (cx - fx) ** 2 + (cy - fy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best && bestDist < 280 * 280 ? best : null;
}

export function resolveMapAnchorNodeId(preferredId: string, nodes: Node[]): string | null {
  if (nodes.some((n) => n.id === preferredId)) return preferredId;
  if (isMapActionStackNodeId(preferredId)) {
    const childHead = preferredId.slice("stack:".length);
    if (nodes.some((n) => n.id === childHead)) return childHead;
  }
  return null;
}

export function mapContentBounds(nodes: Node[]): MapContentBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const w =
      typeof n.width === "number" && n.width > 0 ? n.width : JOURNEY_MAP_NODE_WIDTH_PX;
    const h = mapNodeLayoutHeight(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }

  if (!Number.isFinite(minX)) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/** Zoom level that fits all nodes in the viewport with symmetric padding. */
export function mapFitZoomForBounds(
  bounds: MapContentBounds,
  viewportW: number,
  viewportH: number,
  paddingRatio: number
): number {
  const padX = viewportW * paddingRatio;
  const padY = viewportH * paddingRatio;
  const innerW = Math.max(1, viewportW - 2 * padX);
  const innerH = Math.max(1, viewportH - 2 * padY);
  const zoomW = innerW / bounds.width;
  const zoomH = innerH / bounds.height;
  return Math.min(zoomW, zoomH, MAP_MAX_VIEWPORT_ZOOM);
}

const MAP_MIN_ZOOM_FLOOR = 0.28;

export function clampMapMinZoom(fitZoom: number): number {
  if (!Number.isFinite(fitZoom) || fitZoom <= 0) return MAP_MIN_VIEWPORT_ZOOM;
  // Small journeys: min zoom = fit zoom. Large journeys: can go slightly below the LOD rail (0.35).
  return Math.min(Math.max(fitZoom, MAP_MIN_ZOOM_FLOOR), MAP_MAX_VIEWPORT_ZOOM);
}

/** True when the graph is smaller than the padded viewport (letterboxing / empty margins). */
export function mapIsLooserThanFit(
  zoom: number,
  fitZoom: number,
  slack = 0.035
): boolean {
  return zoom < fitZoom - slack;
}

/** Soft pan limits so the viewport stays near content (flow coordinates). */
export function mapTranslateExtent(
  bounds: MapContentBounds,
  marginPx = 64
): [[number, number], [number, number]] {
  return [
    [bounds.x - marginPx, bounds.y - marginPx],
    [bounds.x + bounds.width + marginPx, bounds.y + bounds.height + marginPx],
  ];
}

export function mapShouldRefitView(
  bounds: MapContentBounds,
  viewportX: number,
  viewportY: number,
  zoom: number,
  paneW: number,
  paneH: number,
  fitZoom: number,
  paddingRatio: number
): boolean {
  if (mapIsLooserThanFit(zoom, fitZoom, 0.02)) return true;

  const left = bounds.x * zoom + viewportX;
  const top = bounds.y * zoom + viewportY;
  const right = (bounds.x + bounds.width) * zoom + viewportX;
  const bottom = (bounds.y + bounds.height) * zoom + viewportY;

  const visW = Math.min(right, paneW) - Math.max(left, 0);
  const visH = Math.min(bottom, paneH) - Math.max(top, 0);
  if (visW < 12 || visH < 12) return true;

  const graphScreenW = bounds.width * zoom;
  const graphScreenH = bounds.height * zoom;
  const visibleArea = Math.max(0, visW) * Math.max(0, visH);
  const graphArea = Math.max(1, graphScreenW * graphScreenH);
  if (visibleArea / graphArea < 0.38) return true;

  return false;
}