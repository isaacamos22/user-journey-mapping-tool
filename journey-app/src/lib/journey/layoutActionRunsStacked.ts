import { blurbForLayout } from "@/lib/journey/actionRunBlurb";
import type { ActionLineSource } from "@/lib/journey/actionRunSummary";
import { JOURNEY_MAP_CARD_GAP_PX } from "@/lib/journey/journeyFlowSpacing";
import {
  mapActionStackNodeId,
  mapActionStackRunGapPx,
  resolveActionStackLayoutHeightPx,
  resolveRootFootprintPx,
  type MapDetailLevel,
} from "@/lib/journey/mapDetailLevel";

export type StackLayoutChild = {
  id: string;
  order: number;
  title?: string;
  userAction?: string | null;
  touchpoint?: string | null;
};

export type ChildRunForLayout<T extends StackLayoutChild> = T[];

export type MapStackLayoutOptions = {
  layoutZoom?: number;
  measuredStackHeights?: Record<string, number>;
  parentTitle?: string;
  parentExperienceGoal?: string | null;
  phaseActionRunBlurb?: string | null;
  runCountUnderPhase?: number;
};

function stackRunLayoutHeightPx<T extends StackLayoutChild>(
  run: ChildRunForLayout<T>,
  level: MapDetailLevel,
  opts?: MapStackLayoutOptions,
): number {
  const stackId = mapActionStackNodeId(run[0]!.id);
  const runSources = run as ActionLineSource[];
  const description = blurbForLayout(
    runSources,
    opts?.parentTitle,
    level,
    opts?.parentExperienceGoal,
    opts?.phaseActionRunBlurb,
    opts?.runCountUnderPhase ?? 1
  );
  return resolveActionStackLayoutHeightPx(
    level,
    run.length,
    description,
    opts?.measuredStackHeights?.[stackId],
    opts?.layoutZoom
  );
}

/**
 * One vertical stack of numbered action cards per sibling run (compact / overview layout).
 * Keeps step columns tight instead of reserving full Dagre action subgraph height/width.
 */
export function layoutActionRunsStacked<T extends StackLayoutChild>(
  runs: ChildRunForLayout<T>[],
  anchorX: number,
  anchorY: number,
  level: MapDetailLevel,
  opts?: MapStackLayoutOptions
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const runGap = mapActionStackRunGapPx(level);
  let y = anchorY;

  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const run = runs[runIndex]!;
    const stackH = stackRunLayoutHeightPx(run, level, opts);
    const stackId = mapActionStackNodeId(run[0]!.id);
    positions.set(stackId, { x: anchorX, y });
    for (const child of run) {
      positions.set(child.id, { x: anchorX, y });
    }
    y += stackH;
    if (runIndex < runs.length - 1) y += runGap;
  }

  return positions;
}

/** Bottom Y of the action area under a step when runs are stacked (exclusive of trailing card gap). */
export function stackedActionAreaBottom<T extends StackLayoutChild>(
  anchorY: number,
  runs: ChildRunForLayout<T>[],
  level: MapDetailLevel,
  opts?: MapStackLayoutOptions
): number {
  if (runs.length <= 0) return anchorY;
  const runGap = mapActionStackRunGapPx(level);
  let bottom = anchorY;
  for (let i = 0; i < runs.length; i++) {
    bottom += stackRunLayoutHeightPx(runs[i]!, level, opts);
    if (i < runs.length - 1) bottom += runGap;
  }
  return bottom;
}

/** Gap from step card to first action stack when in stacked layout. */
export function actionStackRootGapPx(): number {
  return JOURNEY_MAP_CARD_GAP_PX;
}

export function stackedActionAnchorY(
  columnY: number,
  rootLayoutH: number,
  level: MapDetailLevel,
  measuredRootPx?: number,
  layoutZoom?: number
): number {
  return (
    columnY +
    resolveRootFootprintPx(rootLayoutH, level, measuredRootPx, layoutZoom) +
    actionStackRootGapPx()
  );
}