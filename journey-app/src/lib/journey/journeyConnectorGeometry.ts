import { JOURNEY_FLOW_STACK_GAP_PX } from "@/lib/journey/journeyFlowSpacing";

export type ConnectorPoint = { x: number; y: number };

const ALIGN_PX = 8;

export const JOURNEY_CONNECTOR_STROKE = "var(--color-brand, #0014dc)";
export const JOURNEY_CONNECTOR_DASH = "6 5";
/** Connector spine sits in this gutter left of action cards (overlay only; cards stay flush with step). */
export const TREE_SPINE_GUTTER_PX = 12;
/** @deprecated Layout no longer indents actions; use TREE_SPINE_GUTTER_PX for connectors. */
export const TREE_SPINE_INSET_PX = TREE_SPINE_GUTTER_PX;

/** Vertical gap between step card bottom and first action lane (layout + connector stem). */
export const STEP_ACTION_TREE_GAP_PX = JOURNEY_FLOW_STACK_GAP_PX;

function scopeScale(scope: HTMLElement) {
  const rect = scope.getBoundingClientRect();
  const sx = scope.offsetWidth > 0 ? rect.width / scope.offsetWidth : 1;
  const sy = scope.offsetHeight > 0 ? rect.height / scope.offsetHeight : 1;
  return { sx, sy, rect };
}

export function localPointInScope(
  el: HTMLElement,
  scope: HTMLElement,
  edge: "top" | "bottom" | "left" | "right" | "center"
): ConnectorPoint {
  const r = el.getBoundingClientRect();
  const { sx, sy, rect } = scopeScale(scope);
  const x =
    edge === "left"
      ? (r.left - rect.left) / sx
      : edge === "right"
        ? (r.right - rect.left) / sx
        : (r.left - rect.left) / sx + r.width / sx / 2;
  const y =
    edge === "top"
      ? (r.top - rect.top) / sy
      : edge === "bottom"
        ? (r.bottom - rect.top) / sy
        : (r.top - rect.top) / sy + r.height / sy / 2;
  return { x, y };
}

export function linePath(from: ConnectorPoint, to: ConnectorPoint): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

export function journeyConnectorPath(
  from: ConnectorPoint,
  to: ConnectorPoint,
  mode: "direct" | "elbow" = "direct"
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dy) <= ALIGN_PX && Math.abs(dx) > ALIGN_PX) {
    return linePath(from, to);
  }
  if (Math.abs(dx) <= ALIGN_PX && Math.abs(dy) > ALIGN_PX) {
    return linePath(from, to);
  }

  if (mode === "elbow" && Math.abs(dy) > ALIGN_PX) {
    if (Math.abs(dx) <= ALIGN_PX) {
      return linePath(from, to);
    }
    const railY = to.y;
    return `M ${from.x} ${from.y} L ${from.x} ${railY} L ${to.x} ${railY}`;
  }

  const c1x = from.x + dx * 0.42;
  const c1y = from.y;
  const c2x = to.x - dx * 0.42;
  const c2y = to.y;
  return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
}

export function rootStepCard(scope: HTMLElement, stepId: string): HTMLElement | null {
  return (
    scope.querySelector<HTMLElement>(
      `[data-journey-column-id="${CSS.escape(stepId)}"] [data-journey-root-drag] [data-journey-step-id="${CSS.escape(stepId)}"]`
    ) ?? scope.querySelector<HTMLElement>(`[data-journey-step-id="${CSS.escape(stepId)}"]`)
  );
}

export function actionStepCard(scope: HTMLElement, stepId: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(
    `[data-journey-sortable="action"] [data-journey-step-id="${CSS.escape(stepId)}"]`
  );
}

export function treeSpineX(treeEl: HTMLElement, scope: HTMLElement): number {
  return localPointInScope(treeEl, scope, "left").x - TREE_SPINE_GUTTER_PX;
}

/**
 * Standard org-chart tree under one step:
 * parent ↓, spine ‖, horizontal branches → each row’s first card; siblings linked in-row.
 */
export function buildClassicActionTreePaths(
  parentCenterX: number,
  parentBottomY: number,
  spineX: number,
  branches: { rowY: number; cardLeftX: number }[]
): string[] {
  if (branches.length === 0) return [];

  const rows = [...branches].sort((a, b) => a.rowY - b.rowY);
  const topY = rows[0]!.rowY;
  const bottomY = rows[rows.length - 1]!.rowY;
  const paths: string[] = [];

  const stemEndY = Math.min(
    topY - 6,
    parentBottomY + STEP_ACTION_TREE_GAP_PX
  );
  paths.push(`M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${stemEndY}`);

  const busY = Math.max(stemEndY, topY - 6);

  if (Math.abs(parentCenterX - spineX) > 2) {
    paths.push(`M ${parentCenterX} ${busY} L ${spineX} ${busY}`);
  } else if (stemEndY < busY) {
    paths.push(`M ${parentCenterX} ${stemEndY} L ${parentCenterX} ${busY}`);
  }

  if (rows.length === 1) {
    const { rowY, cardLeftX } = rows[0]!;
    const useSpine = Math.abs(parentCenterX - spineX) > 2;
    const joinX = useSpine ? spineX : parentCenterX;
    if (useSpine) {
      paths.push(`M ${spineX} ${busY} L ${spineX} ${rowY}`);
    } else if (stemEndY < rowY) {
      paths.push(`M ${parentCenterX} ${stemEndY} L ${parentCenterX} ${rowY}`);
    }
    if (cardLeftX > joinX + 2) {
      paths.push(`M ${joinX} ${rowY} L ${cardLeftX} ${rowY}`);
    }
    return paths;
  }

  paths.push(`M ${spineX} ${busY} L ${spineX} ${bottomY}`);

  for (const { rowY, cardLeftX } of rows) {
    if (cardLeftX > spineX + 2) {
      paths.push(`M ${spineX} ${rowY} L ${cardLeftX} ${rowY}`);
    }
  }

  return paths;
}