"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  Position,
  type NodeProps,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  coalesceSingleCardChainRuns,
  groupActionsIntoSiblingRuns,
  orderChildRunsForLayout,
  unifyMergeTrunkRuns,
} from "@/lib/journey/actionFlowLayout";
import {
  edgeBundleIndex,
  registerEdgeBundle,
} from "@/lib/journey/mapFlowEdgeGeometry";
import { JourneyMapFlowEdge } from "@/components/journey/JourneyMapFlowEdge";
import { mapFlowEdgeStyle } from "@/lib/journey/mapFlowEdgeStyles";
import {
  layoutActionSubgraphDagre,
  subgraphWidthPx,
} from "@/lib/journey/mapDagreLayout";
import {
  type MapNodeRect,
  resolveFlowHandlePositions,
} from "@/lib/journey/mapEdgeHandles";
import {
  sourceFlowHandleId,
  targetFlowHandleId,
} from "@/lib/journey/mapFlowHandleIds";
import type { FlowLink } from "@/lib/journey/flowLinks";
import {
  JOURNEY_MAP_ACTION_H_GAP_PX,
  JOURNEY_MAP_CARD_GAP_PX,
  JOURNEY_MAP_NODE_WIDTH_PX,
} from "@/lib/journey/journeyFlowSpacing";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";
import { JourneyMapNodeBody } from "@/components/journey/JourneyMapNodeBody";
import type { MapFrictionBullet } from "@/components/journey/MapFrictionBulletList";
import {
  experienceGoalHasMore,
  previewExperienceGoal,
} from "@/lib/journey/mapExperienceGoalPreview";
import { MapCanvasProvider, useMapCanvas } from "@/components/journey/mapCanvasContext";
import { useMapNodeHeights } from "@/components/journey/useMapNodeHeights";
import { useMapDetailLevel } from "@/components/journey/useMapDetailLevel";
import {
  isMapActionStackNodeId,
  mapActionStackNodeId,
  mapStacksChildActions,
  resolveActionStackLayoutHeightPx,
  resolveRootFootprintPx,
  MAP_MIN_VIEWPORT_ZOOM,
  MAP_ZOOM_VIEWPORT_ANIM_MS,
  type MapDetailLevel,
} from "@/lib/journey/mapDetailLevel";
import { MapActionRunStack } from "@/components/journey/MapActionRunStack";
import { blurbForLayout, resolveActionRunStackBlurbOverride } from "@/lib/journey/actionRunBlurb";
import { useMapViewReadabilityScale } from "@/components/journey/useMapViewReadabilityScale";
import { useMapWheelDestinationAnchor } from "@/components/journey/useMapWheelDestinationAnchor";
import { MapZoomLodRail } from "@/components/journey/MapZoomLodRail";
import {
  layoutActionRunsStacked,
  stackedActionAnchorY,
  stackedActionAreaBottom,
  type MapStackLayoutOptions,
} from "@/lib/journey/layoutActionRunsStacked";
import { pickRootPhaseStepIdAtFlowX } from "@/lib/journey/mapViewportFit";

export type CanvasStep = {
  id: string;
  title: string;
  userAction?: string | null;
  parentStepId?: string | null;
  actionFlowBranchId?: string | null;
  order: number;
  phaseTitle: string;
  painSeverity?: number;
  painFrictionItems?: string[];
  painFrictionBullets?: MapFrictionBullet[];
  painOpportunityItems?: string[];
  touchpoint?: string | null;
  experienceGoal?: string | null;
  /** Optional import-authored stack summary for this phase step. */
  actionRunBlurb?: string | null;
};

export type MapCanvasEngagement = {
  journeyId: string;
  state: MapEngagement;
  onChange: (next: MapEngagement) => void;
};

const NODE_W = JOURNEY_MAP_NODE_WIDTH_PX;
/** Horizontal gutter between phase columns. */
const PHASE_GAP_PX = 96;
const COL_MIN_W = NODE_W + PHASE_GAP_PX;
const CARD_GAP_PX = JOURNEY_MAP_CARD_GAP_PX;
const ACTION_H_GAP = JOURNEY_MAP_ACTION_H_GAP_PX;
/** Inner content width ≈ node width − horizontal padding. */
const TITLE_CHARS_PER_LINE = 38;
const BODY_CHARS_PER_LINE = 42;
const TITLE_LINE_PX = 18;
const BODY_LINE_PX = 16;
const NODE_PAD_Y = 20;
const PHASE_PILL_PX = 30;
const STEP_ICON_PX = 44;
const HEIGHT_FUDGE_PX = 4;
const CANVAS_MIN_H = 480;
const CANVAS_MAX_H = 880;
const FIT_PADDING = 0.14;

const handleClass =
  "!h-1.5 !w-1.5 !border-0 !bg-slate-400 opacity-0 group-hover:opacity-100";

/** Same anchor on every phase card so inter-phase connectors stay horizontal. */
const PHASE_FLOW_HANDLE_TOP_PX = 52;
const phaseFlowHandleStyle = { top: PHASE_FLOW_HANDLE_TOP_PX };
/** Same anchor on sibling action cards in one lane (icon + label band). */
const ACTION_FLOW_HANDLE_TOP_PX = 44;
const actionFlowHandleStyle = { top: ACTION_FLOW_HANDLE_TOP_PX };

const wrapText = "min-w-0 max-w-full whitespace-normal break-words";

function linesForText(text: string, charsPerLine: number): number {
  const t = text.trim();
  if (!t) return 0;
  return Math.max(1, Math.ceil(t.length / charsPerLine));
}

const PAIN_SUMMARY_CHARS_PER_LINE = 34;
const FACILITATOR_TOGGLE_ROW_PX = 22;

/** Facilitator lists default collapsed on the map — estimate header row only unless expanded in UI. */
function estimateBulletBlockHeight(labelPresent: boolean, items?: string[], listExpanded = false): number {
  const bullets = items?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (!labelPresent && bullets.length === 0) return 0;
  let block = 10 + FACILITATOR_TOGGLE_ROW_PX + 6;
  if (listExpanded && bullets.length) {
    block += 6;
    for (const item of bullets) {
      block += linesForText(item, PAIN_SUMMARY_CHARS_PER_LINE) * BODY_LINE_PX + 4;
    }
  }
  return block;
}

function estimateNodeHeight(step: CanvasStep, isChild: boolean, hasChildActions: boolean): number {
  const primary = (isChild ? step.userAction || step.title : step.title) || "";
  const secondary =
    isChild && step.userAction && step.title !== step.userAction
      ? step.title
      : !isChild && !hasChildActions && step.userAction && step.userAction !== step.title
        ? step.userAction
        : "";

  let h = NODE_PAD_Y;

  if (isChild) {
    h += 28 + 8;
    h += 14 + 4;
    h += linesForText(primary, TITLE_CHARS_PER_LINE) * TITLE_LINE_PX;
    if (secondary) h += linesForText(secondary, BODY_CHARS_PER_LINE) * BODY_LINE_PX;
    if (step.touchpoint) h += 4 + BODY_LINE_PX;
  } else {
    h += STEP_ICON_PX + PHASE_PILL_PX;
    h += linesForText(primary, TITLE_CHARS_PER_LINE) * TITLE_LINE_PX;
    if (secondary) h += 6 + linesForText(secondary, BODY_CHARS_PER_LINE) * BODY_LINE_PX;
    if (step.touchpoint) h += 4 + BODY_LINE_PX;
    if (step.experienceGoal) {
      const preview = previewExperienceGoal(step.experienceGoal);
      h += 6 + linesForText(preview, BODY_CHARS_PER_LINE) * BODY_LINE_PX;
      if (experienceGoalHasMore(step.experienceGoal)) h += 18;
    }

    const severity = step.painSeverity ?? 0;
    const frictions =
      step.painFrictionBullets?.map((b) => b.description).filter(Boolean) ??
      step.painFrictionItems?.filter(Boolean) ??
      [];
    const opportunities = step.painOpportunityItems?.filter(Boolean) ?? [];
    if (severity >= 2 && frictions.length) {
      h += estimateBulletBlockHeight(true, frictions, false);
    }
    if (opportunities.length) {
      if (severity >= 2 && frictions.length) h += 8;
      h += estimateBulletBlockHeight(true, opportunities, false);
    }
  }

  return Math.max(56, h + HEIGHT_FUDGE_PX);
}

function estimateNodeHeightForLevel(
  step: CanvasStep,
  isChild: boolean,
  hasChildActions: boolean,
  level: MapDetailLevel,
  layoutZoom?: number
): number {
  if (level === "detail") {
    return estimateNodeHeight(step, isChild, hasChildActions);
  }

  const primary = (isChild ? step.userAction || step.title : step.title) || "";
  let h = NODE_PAD_Y;

  if (level === "overview") {
    if (isChild) {
      return resolveActionStackLayoutHeightPx(level, 1, undefined, undefined, layoutZoom) + HEIGHT_FUDGE_PX;
    }
    h += STEP_ICON_PX;
    h += Math.min(linesForText(primary, TITLE_CHARS_PER_LINE), 2) * TITLE_LINE_PX;
    return Math.max(56, h + HEIGHT_FUDGE_PX);
  }

  if (isChild) {
    return resolveActionStackLayoutHeightPx(level, 1, undefined, undefined, layoutZoom) + HEIGHT_FUDGE_PX;
  }

  h += STEP_ICON_PX + PHASE_PILL_PX;
  h += Math.min(linesForText(primary, TITLE_CHARS_PER_LINE), 3) * TITLE_LINE_PX;
  const severity = step.painSeverity ?? 0;
  const frictions =
    step.painFrictionBullets?.map((b) => b.description).filter(Boolean) ??
    step.painFrictionItems?.filter(Boolean) ??
    [];
  const opportunities = step.painOpportunityItems?.filter(Boolean) ?? [];
  const compactFacilitatorChipPx = 10 + FACILITATOR_TOGGLE_ROW_PX + 6;
  if (severity >= 2 && frictions.length) {
    h += compactFacilitatorChipPx;
  }
  if (opportunities.length) {
    if (severity >= 2 && frictions.length) h += 8;
    h += compactFacilitatorChipPx;
  }
  return Math.max(56, h + HEIGHT_FUDGE_PX);
}

function resolveNodeHeight(
  step: CanvasStep,
  isChild: boolean,
  hasChildActions: boolean,
  measured: number | undefined,
  layoutLevel: MapDetailLevel,
  layoutZoom?: number
): number {
  const estimated = estimateNodeHeightForLevel(
    step,
    isChild,
    hasChildActions,
    layoutLevel,
    layoutZoom
  );
  if (measured && measured > 0) {
    if (layoutLevel === "detail") return measured;
    if (!isChild) return measured;
  }
  return estimated;
}

type StackLayoutMeta = {
  actionCount: number;
  description: string;
};

function makeHeightResolver(
  stepById: Map<string, CanvasStep>,
  childrenByParent: Map<string, CanvasStep[]>,
  measuredHeights: Record<string, number>,
  layoutDetailLevel: MapDetailLevel,
  stackMetaById: Map<string, StackLayoutMeta>,
  layoutZoom?: number
) {
  return (id: string) => {
    if (isMapActionStackNodeId(id)) {
      const meta = stackMetaById.get(id);
      return resolveActionStackLayoutHeightPx(
        layoutDetailLevel,
        meta?.actionCount ?? 1,
        meta?.description,
        measuredHeights[id],
        layoutZoom
      );
    }
    const s = stepById.get(id);
    if (!s) return 56;
    const isChild = Boolean(s.parentStepId);
    const hasChildActions = (childrenByParent.get(id)?.length ?? 0) > 0;
    return resolveNodeHeight(
      s,
      isChild,
      isChild ? false : hasChildActions,
      measuredHeights[id],
      layoutDetailLevel,
      layoutZoom
    );
  };
}

function mapTextMatchesHighlight(item: string, highlight: string): boolean {
  const a = item.trim().toLowerCase();
  const b = highlight.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const n = Math.min(24, a.length, b.length);
  return n >= 10 && a.slice(0, n) === b.slice(0, n);
}

function MapBulletList({
  items,
  className,
  highlightText,
  stepId,
  onPickItem,
}: {
  items: string[];
  className?: string;
  highlightText?: string | null;
  stepId?: string;
  onPickItem?: (text: string) => void;
}) {
  const bullets = items.map((s) => s.trim()).filter(Boolean);
  if (!bullets.length) return null;
  return (
    <ul className={cn("journey-map-bullet-list journey-map-body", wrapText, className)}>
      {bullets.map((item) => {
        const emphasized = highlightText && mapTextMatchesHighlight(item, highlightText);
        const body = emphasized ? (
          <mark className="journey-map-text-highlight">{item}</mark>
        ) : (
          item
        );
        return (
          <li key={item.slice(0, 48)} className="journey-map-bullet-item">
            {onPickItem && stepId ? (
              <button
                type="button"
                className="nopan nodrag nowheel w-full cursor-pointer rounded-md px-0.5 text-left transition-colors hover:bg-black/5"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPickItem(item);
                }}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type DiscoveryScopePickHandlers = {
  onPickPain: (stepId: string, text: string) => void;
  onPickOpportunity: (stepId: string, text: string) => void;
};

function JourneyCanvasNode({
  data,
}: NodeProps<{
  stepId: string;
  engageTick: number;
  isChild: boolean;
  isActionRunStack?: boolean;
  runStepIds?: string[];
  parentStepId?: string;
  stackBlurbOverride?: string | null;
  focused: boolean;
  showNestIn?: boolean;
  showFlowIn?: boolean;
  showFlowOut?: boolean;
}>) {
  void data.engageTick;
  const ctx = useMapCanvas();
  if (data.isActionRunStack && data.runStepIds?.length) {
    return (
      <div className="group relative min-w-0 max-w-full">
        {data.showFlowIn ? (
          <>
            <Handle
              type="target"
              position={Position.Left}
              id="flow-in"
              className={`${handleClass} !bg-brand`}
              style={actionFlowHandleStyle}
            />
            <Handle
              type="target"
              position={Position.Top}
              id="flow-in-top"
              className={`${handleClass} !bg-brand`}
              style={actionFlowHandleStyle}
            />
          </>
        ) : null}
        {data.showFlowOut ? (
          <>
            <Handle
              type="source"
              position={Position.Right}
              id="flow-out"
              className={`${handleClass} !bg-brand`}
              style={actionFlowHandleStyle}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="flow-out-bottom"
              className={`${handleClass} !bg-brand`}
              style={actionFlowHandleStyle}
            />
          </>
        ) : null}
        <div className="journey-map-readability-scale journey-map-readability-scale--action-stack">
          <MapActionRunStack
            stepIds={data.runStepIds}
            parentStepId={data.parentStepId}
            stackBlurbOverride={data.stackBlurbOverride}
            focused={data.focused}
            onSelectStep={ctx?.onSelectStep}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative min-w-0 max-w-full">
      {!data.isChild ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="flow-in"
            className={`${handleClass} !bg-brand`}
            style={phaseFlowHandleStyle}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="flow-out"
            className={`${handleClass} !bg-brand`}
            style={phaseFlowHandleStyle}
          />
          <Handle type="source" position={Position.Bottom} id="nest-out" className={handleClass} />
        </>
      ) : (
        <>
          {data.showNestIn ? (
            <Handle type="target" position={Position.Top} id="nest-in" className={handleClass} />
          ) : null}
          {data.showFlowIn ? (
            <>
              <Handle
                type="target"
                position={Position.Left}
                id="flow-in"
                className={`${handleClass} !bg-brand`}
                style={actionFlowHandleStyle}
              />
              <Handle
                type="target"
                position={Position.Top}
                id="flow-in-top"
                className={`${handleClass} !bg-brand`}
                style={actionFlowHandleStyle}
              />
            </>
          ) : null}
          {data.showFlowOut ? (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="flow-out"
                className={`${handleClass} !bg-brand`}
                style={actionFlowHandleStyle}
              />
              <Handle
                type="source"
                position={Position.Bottom}
                id="flow-out-bottom"
                className={`${handleClass} !bg-brand`}
                style={actionFlowHandleStyle}
              />
            </>
          ) : null}
        </>
      )}
      {data.isChild ? (
        <JourneyMapNodeBody stepId={data.stepId} isChild={data.isChild} focused={data.focused} />
      ) : (
        <div className="journey-map-readability-scale">
          <JourneyMapNodeBody stepId={data.stepId} isChild={data.isChild} focused={data.focused} />
        </div>
      )}
    </div>
  );
}

const nodeTypes = { journeyStep: JourneyCanvasNode };
const edgeTypes = { journeyMapFlow: JourneyMapFlowEdge };

function applyMapEdgeBundles(edges: Edge[]): Edge[] {
  const groups = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "journeyMapFlow" || !e.data?.route) continue;
    const route = e.data.route as string;
    let key = "";
    if (route === "nest") key = `nest:${e.source}`;
    else if (
      route === "flow" ||
      route === "cross" ||
      route === "crossLane" ||
      route === "crossPhase"
    )
      key = `cross:${e.source}`;
    else if (route === "phase") key = `phase:${e.source}`;
    if (key) registerEdgeBundle(groups, key, e.id);
  }
  return edges.map((e) => {
    if (e.type !== "journeyMapFlow" || !e.data?.route) return e;
    const route = e.data.route as string;
    let key = "";
    if (route === "nest") key = `nest:${e.source}`;
    else if (
      route === "flow" ||
      route === "cross" ||
      route === "crossLane" ||
      route === "crossPhase"
    )
      key = `cross:${e.source}`;
    else if (route === "phase") key = `phase:${e.source}`;
    if (!key) return e;
    const { index, count } = edgeBundleIndex(groups, e.id, key);
    return {
      ...e,
      data: { ...e.data, bundleIndex: index, bundleCount: count },
    };
  });
}

function buildChildrenByParent(steps: CanvasStep[]) {
  const childrenByParent = new Map<string, CanvasStep[]>();
  for (const s of steps) {
    if (!s.parentStepId) continue;
    const list = childrenByParent.get(s.parentStepId) ?? [];
    list.push(s);
    childrenByParent.set(s.parentStepId, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  return childrenByParent;
}

function childRunsForParent(
  parentId: string,
  children: CanvasStep[],
  flowLinks: FlowLink[]
): CanvasStep[][] {
  if (children.length === 0) return [];
  const ids = new Set(children.map((c) => c.id));
  const childLinks = flowLinks.filter(
    (l) => ids.has(l.fromStepId) && ids.has(l.toStepId)
  );
  const runs = groupActionsIntoSiblingRuns(
    children.map((c) => ({
      ...c,
      actionFlowBranchId: c.actionFlowBranchId ?? null,
    })),
    childLinks,
    parentId
  );
  const unified = unifyMergeTrunkRuns(runs, childLinks, children);
  const coalesced = coalesceSingleCardChainRuns(unified, childLinks);
  return orderChildRunsForLayout(coalesced, childLinks);
}

function phaseColumnWidths(
  roots: CanvasStep[],
  phases: string[],
  childrenByParent: Map<string, CanvasStep[]>,
  flowLinks: FlowLink[],
  heightFor: (stepId: string) => number,
  layoutDetailLevel: MapDetailLevel
): Map<string, number> {
  const widths = new Map<string, number>();
  const stackLayout = mapStacksChildActions(layoutDetailLevel);
  for (const phaseTitle of phases) {
    let maxContent = NODE_W;
    for (const root of roots.filter((r) => r.phaseTitle === phaseTitle)) {
      const children = childrenByParent.get(root.id) ?? [];
      if (children.length === 0) continue;
      if (stackLayout) {
        maxContent = Math.max(maxContent, NODE_W);
        continue;
      }
      const sub = layoutActionSubgraphDagre(
        children,
        flowLinks,
        heightFor,
        0,
        0
      );
      maxContent = Math.max(
        maxContent,
        subgraphWidthPx(
          sub,
          children.map((c) => c.id),
          heightFor
        )
      );
    }
    widths.set(phaseTitle, maxContent + PHASE_GAP_PX);
  }
  return widths;
}

function buildStackMetaById(
  roots: CanvasStep[],
  childrenByParent: Map<string, CanvasStep[]>,
  flowLinks: FlowLink[],
  layoutDetailLevel: MapDetailLevel
): Map<string, StackLayoutMeta> {
  const meta = new Map<string, StackLayoutMeta>();
  for (const root of roots) {
    const runs = childRunsForParent(root.id, childrenByParent.get(root.id) ?? [], flowLinks);
    const runCount = runs.length;
    for (const run of runs) {
      const stackId = mapActionStackNodeId(run[0]!.id);
      meta.set(stackId, {
        actionCount: run.length,
        description: blurbForLayout(
          run,
          root.title,
          layoutDetailLevel,
          root.experienceGoal,
          root.actionRunBlurb,
          runCount
        ),
      });
    }
  }
  return meta;
}

function layoutColumnPositions(
  steps: CanvasStep[],
  phaseTitles: string[] | undefined,
  childrenByParent: Map<string, CanvasStep[]>,
  heightFor: (stepId: string) => number,
  flowLinks: FlowLink[],
  layoutDetailLevel: MapDetailLevel,
  measuredHeights: Record<string, number>,
  layoutZoom?: number
): Map<string, { x: number; y: number }> {
  const roots = steps.filter((s) => !s.parentStepId).sort((a, b) => a.order - b.order);
  const phases = phaseColumnOrder(steps, phaseTitles);
  const positions = new Map<string, { x: number; y: number }>();
  const stackLayout = mapStacksChildActions(layoutDetailLevel);
  const colWidths = phaseColumnWidths(
    roots,
    phases,
    childrenByParent,
    flowLinks,
    heightFor,
    layoutDetailLevel
  );

  let phaseX = 0;
  for (const phaseTitle of phases) {
    const colW = colWidths.get(phaseTitle) ?? COL_MIN_W;
    let columnY = 0;

    for (const root of roots.filter((r) => r.phaseTitle === phaseTitle)) {
      const rootH = heightFor(root.id);
      positions.set(root.id, { x: phaseX, y: columnY });

      const children = childrenByParent.get(root.id) ?? [];
      if (children.length > 0) {
        const rootMeasured = measuredHeights[root.id];
        const runsForLayout = stackLayout
          ? childRunsForParent(root.id, children, flowLinks)
          : [];
        const stackOpts: MapStackLayoutOptions = {
          layoutZoom,
          measuredStackHeights: measuredHeights,
          parentTitle: root.title,
          parentExperienceGoal: root.experienceGoal,
          phaseActionRunBlurb: root.actionRunBlurb,
          runCountUnderPhase: runsForLayout.length,
        };
        const childY = stackLayout
          ? stackedActionAnchorY(
              columnY,
              rootH,
              layoutDetailLevel,
              rootMeasured,
              layoutZoom
            )
          : columnY + rootH + CARD_GAP_PX;
        if (stackLayout) {
          const runs = runsForLayout;
          const childPos = layoutActionRunsStacked(
            runs,
            phaseX,
            childY,
            layoutDetailLevel,
            stackOpts
          );
          for (const [id, p] of childPos) positions.set(id, p);
          columnY =
            stackedActionAreaBottom(childY, runs, layoutDetailLevel, stackOpts) + CARD_GAP_PX;
        } else {
          const childPos = layoutActionSubgraphDagre(
            children,
            flowLinks,
            heightFor,
            phaseX,
            childY
          );
          for (const [id, p] of childPos) positions.set(id, p);

          let maxBottom = childY;
          for (const c of children) {
            const p = childPos.get(c.id);
            if (!p) continue;
            maxBottom = Math.max(maxBottom, p.y + heightFor(c.id));
          }
          columnY = maxBottom + CARD_GAP_PX;
        }
      } else {
        const rootFoot = stackLayout
          ? resolveRootFootprintPx(
              rootH,
              layoutDetailLevel,
              measuredHeights[root.id],
              layoutZoom
            )
          : rootH;
        columnY = columnY + rootFoot + CARD_GAP_PX;
      }
    }

    phaseX += colW;
  }

  return positions;
}

function nodeRect(
  id: string,
  positions: Map<string, { x: number; y: number }>,
  heightFor: (stepId: string) => number
): MapNodeRect {
  const p = positions.get(id);
  return {
    x: p?.x ?? 0,
    y: p?.y ?? 0,
    width: NODE_W,
    height: heightFor(id),
  };
}

function wireFlowEdge(
  edge: Edge,
  positions: Map<string, { x: number; y: number }>,
  heightFor: (stepId: string) => number
): Edge {
  const handles = resolveFlowHandlePositions(
    nodeRect(edge.source, positions, heightFor),
    nodeRect(edge.target, positions, heightFor)
  );
  const route =
    (edge.data as { route?: string } | undefined)?.route ?? "flow";
  return {
    ...edge,
    sourceHandle: sourceFlowHandleId(handles.sourcePosition),
    targetHandle: targetFlowHandleId(handles.targetPosition),
    sourcePosition: handles.sourcePosition,
    targetPosition: handles.targetPosition,
    data: {
      ...(edge.data as object),
      route,
      sourcePosition: handles.sourcePosition,
      targetPosition: handles.targetPosition,
    },
  } as Edge;
}

function isAdjacentInRun(
  fromId: string,
  toId: string,
  runs: CanvasStep[][]
): boolean {
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      if (run[i]!.id === fromId && run[i + 1]!.id === toId) return true;
    }
  }
  return false;
}

function crossRunFlowHints(
  steps: CanvasStep[],
  roots: CanvasStep[],
  childrenByParent: Map<string, CanvasStep[]>,
  flowLinks: FlowLink[]
): {
  needsFlowIn: Set<string>;
  needsFlowOut: Set<string>;
  crossEdges: FlowLink[];
} {
  const needsFlowIn = new Set<string>();
  const needsFlowOut = new Set<string>();
  const crossEdges: FlowLink[] = [];
  const stepById = new Map(steps.map((s) => [s.id, s]));

  const isCrossPhase = (link: FlowLink): boolean => {
    const from = stepById.get(link.fromStepId);
    const to = stepById.get(link.toStepId);
    if (!from?.parentStepId || !to?.parentStepId) return false;
    return from.parentStepId !== to.parentStepId;
  };

  for (const link of flowLinks) {
    const from = stepById.get(link.fromStepId);
    const to = stepById.get(link.toStepId);
    if (!from || !to) continue;

    if (isCrossPhase(link)) {
      needsFlowIn.add(link.toStepId);
      needsFlowOut.add(link.fromStepId);
      crossEdges.push(link);
      continue;
    }

    const parentId = from.parentStepId;
    if (!parentId || parentId !== to.parentStepId) continue;
    const children = childrenByParent.get(parentId) ?? [];
    const childIds = new Set(children.map((c) => c.id));
    if (!childIds.has(link.fromStepId) || !childIds.has(link.toStepId)) continue;
    const runs = childRunsForParent(parentId, children, flowLinks);
    if (isAdjacentInRun(link.fromStepId, link.toStepId, runs)) continue;
    needsFlowIn.add(link.toStepId);
    needsFlowOut.add(link.fromStepId);
    crossEdges.push(link);
  }

  return { needsFlowIn, needsFlowOut, crossEdges };
}

function buildRunMeta(
  roots: CanvasStep[],
  childrenByParent: Map<string, CanvasStep[]>,
  flowLinks: FlowLink[]
): Map<string, { index: number; length: number }> {
  const meta = new Map<string, { index: number; length: number }>();
  for (const root of roots) {
    const runs = childRunsForParent(root.id, childrenByParent.get(root.id) ?? [], flowLinks);
    for (const run of runs) {
      run.forEach((child, index) => {
        meta.set(child.id, { index, length: run.length });
      });
    }
  }
  return meta;
}

function phaseColumnOrder(steps: CanvasStep[], phaseTitles?: string[]): string[] {
  if (phaseTitles?.length) return phaseTitles;
  const seen = new Set<string>();
  const order: string[] = [];
  for (const s of steps.filter((x) => !x.parentStepId).sort((a, b) => a.order - b.order)) {
    if (seen.has(s.phaseTitle)) continue;
    seen.add(s.phaseTitle);
    order.push(s.phaseTitle);
  }
  return order;
}

function buildGraph(
  steps: CanvasStep[],
  focusStepId?: string | null,
  phaseTitles?: string[],
  flowLinks: FlowLink[] = [],
  measuredHeights: Record<string, number> = {},
  layoutDetailLevel: MapDetailLevel = "detail",
  layoutZoom?: number
) {
  const roots = steps.filter((s) => !s.parentStepId).sort((a, b) => a.order - b.order);
  const childrenByParent = buildChildrenByParent(steps);
  const stepById = new Map(steps.map((s) => [s.id, s]));
  const stackMetaById = buildStackMetaById(
    roots,
    childrenByParent,
    flowLinks,
    layoutDetailLevel
  );
  const runMeta = buildRunMeta(roots, childrenByParent, flowLinks);
  const { needsFlowIn, needsFlowOut, crossEdges } = crossRunFlowHints(
    steps,
    roots,
    childrenByParent,
    flowLinks
  );

  const heightFor = makeHeightResolver(
    stepById,
    childrenByParent,
    measuredHeights,
    layoutDetailLevel,
    stackMetaById,
    layoutZoom
  );

  const positions = layoutColumnPositions(
    steps,
    phaseTitles,
    childrenByParent,
    heightFor,
    flowLinks,
    layoutDetailLevel,
    measuredHeights,
    layoutZoom
  );

  const rowBandHeightByStep = new Map<string, number>();
  for (const root of roots) {
    const runs = childRunsForParent(
      root.id,
      childrenByParent.get(root.id) ?? [],
      flowLinks
    );
    for (const run of runs) {
      if (run.length < 2) continue;
      const band = Math.max(...run.map((c) => heightFor(c.id)));
      for (const c of run) rowBandHeightByStep.set(c.id, band);
    }
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const phases = phaseColumnOrder(steps, phaseTitles);

  const stackActions = mapStacksChildActions(layoutDetailLevel);
  const childToStack = new Map<string, string>();
  if (stackActions) {
    for (const root of roots) {
      const runs = childRunsForParent(root.id, childrenByParent.get(root.id) ?? [], flowLinks);
      for (const run of runs) {
        const stackId = mapActionStackNodeId(run[0]!.id);
        for (const child of run) childToStack.set(child.id, stackId);
      }
    }
  }

  const resolveStackEndpoint = (stepId: string) => childToStack.get(stepId) ?? stepId;

  const nodeStyle = (id: string, width = NODE_W, minHeight?: number) => {
    const band = minHeight ?? rowBandHeightByStep.get(id);
    return {
      border: "none",
      background: "transparent",
      padding: 0,
      width,
      maxWidth: width,
      minWidth: 0,
      minHeight: band,
      boxSizing: "border-box" as const,
      overflow: "visible",
      boxShadow: "none",
    };
  };

  const hiddenChildIds = new Set<string>();
  if (stackActions) {
    for (const root of roots) {
      const runs = childRunsForParent(root.id, childrenByParent.get(root.id) ?? [], flowLinks);
      const runCount = runs.length;
      for (const run of runs) {
        const stackId = mapActionStackNodeId(run[0]!.id);
        const stackPos = positions.get(stackId);
        if (!stackPos) continue;
        const minX = stackPos.x;
        const minY = stackPos.y;
        const first = run[0]!;
        const last = run[run.length - 1]!;
        const focused = run.some((c) => c.id === focusStepId);
        const showFlowIn = false;
        const showFlowOut = false;

        for (const child of run) hiddenChildIds.add(child.id);

        const stackBlurbOverride = resolveActionRunStackBlurbOverride(
          run,
          root.actionRunBlurb,
          runCount
        );
        const stackDescription = blurbForLayout(
          run,
          root.title,
          layoutDetailLevel,
          root.experienceGoal,
          root.actionRunBlurb,
          runCount
        );

        nodes.push({
          id: stackId,
          type: "journeyStep",
          position: { x: minX, y: minY },
          data: {
            stepId: stackId,
            engageTick: 0,
            isChild: true,
            isActionRunStack: true,
            runStepIds: run.map((c) => c.id),
            parentStepId: root.id,
            stackBlurbOverride,
            focused,
            showNestIn: false,
            showFlowIn,
            showFlowOut,
          },
          style: nodeStyle(
            stackId,
            NODE_W,
            resolveActionStackLayoutHeightPx(
              layoutDetailLevel,
              run.length,
              stackDescription,
              measuredHeights[stackId],
              layoutZoom
            )
          ),
        });
      }
    }
  }

  for (const s of steps) {
    if (hiddenChildIds.has(s.id)) continue;
    const pos = positions.get(s.id);
    if (!pos) continue;
    const isChild = Boolean(s.parentStepId);
    const focused = focusStepId === s.id;
    const run = runMeta.get(s.id);
    const showNestIn = false;
    const showFlowIn = Boolean(
      isChild && ((run && run.index > 0) || needsFlowIn.has(s.id))
    );
    const showFlowOut = Boolean(
      isChild && ((run && run.index < run.length - 1) || needsFlowOut.has(s.id))
    );
    const nodeH = heightFor(s.id);
    const layoutMinH =
      !isChild && mapStacksChildActions(layoutDetailLevel)
        ? resolveRootFootprintPx(
            nodeH,
            layoutDetailLevel,
            measuredHeights[s.id],
            layoutZoom
          )
        : undefined;
    nodes.push({
      id: s.id,
      type: "journeyStep",
      position: pos,
      data: {
        stepId: s.id,
        engageTick: 0,
        isChild,
        focused,
        showNestIn,
        showFlowIn,
        showFlowOut,
      },
      style: nodeStyle(s.id, NODE_W, layoutMinH),
    });
  }

  let prevPhaseAnchorId: string | null = null;

  phases.forEach((phaseTitle) => {
    const phaseRoots = roots.filter((r) => r.phaseTitle === phaseTitle);
    let firstRootId: string | null = null;
    let lastRootId: string | null = null;
    let prevInPhaseId: string | null = null;

    for (const root of phaseRoots) {
      if (!firstRootId) firstRootId = root.id;
      lastRootId = root.id;
      const runs = childRunsForParent(root.id, childrenByParent.get(root.id) ?? [], flowLinks);

      for (const run of runs) {
        if (stackActions) continue;
        for (let i = 0; i < run.length - 1; i++) {
          const from = run[i]!;
          const to = run[i + 1]!;
          edges.push({
            id: `e-chain-${from.id}-${to.id}`,
            source: from.id,
            target: to.id,
            sourceHandle: "flow-out",
            targetHandle: "flow-in",
            type: "journeyMapFlow",
            animated: true,
            data: { route: "chain" },
            style: mapFlowEdgeStyle("primary"),
          });
        }
      }
      if (prevInPhaseId) {
        edges.push({
          id: `e-phase-${prevInPhaseId}-${root.id}`,
          source: prevInPhaseId,
          target: root.id,
          sourceHandle: "nest-out",
          targetHandle: "nest-in",
          type: "journeyMapFlow",
          animated: true,
          data: { route: "phase" },
          style: mapFlowEdgeStyle("muted"),
        });
      }
      prevInPhaseId = root.id;
    }

    if (firstRootId && prevPhaseAnchorId) {
      edges.push({
        id: `e-flow-${prevPhaseAnchorId}-${firstRootId}`,
        source: prevPhaseAnchorId,
        target: firstRootId,
        sourceHandle: "flow-out",
        targetHandle: "flow-in",
        type: "journeyMapFlow",
        animated: true,
        data: { route: "phase" },
        style: mapFlowEdgeStyle("primary"),
      });
    }

    if (lastRootId) prevPhaseAnchorId = lastRootId;
  });

  for (const link of crossEdges) {
    if (stackActions) continue;
    const from = stepById.get(link.fromStepId);
    const to = stepById.get(link.toStepId);
    if (!from || !to) continue;
    const alternate = link.kind === "alternate";
    const source = resolveStackEndpoint(link.fromStepId);
    const target = resolveStackEndpoint(link.toStepId);
    if (source === target) continue;
    const edgeId = `e-flowlink-${source}-${target}`;
    if (edges.some((e) => e.id === edgeId)) continue;
    edges.push({
      id: edgeId,
      source,
      target,
      sourceHandle: "flow-out",
      targetHandle: "flow-in",
      type: "journeyMapFlow",
      animated: true,
      data: { route: "flow" },
      style: mapFlowEdgeStyle(alternate ? "alternate" : "primary"),
    });
  }

  const flowEdges = stackActions
    ? edges.filter(
        (e) => !isMapActionStackNodeId(e.source) && !isMapActionStackNodeId(e.target)
      )
    : edges;

  const wiredEdges = flowEdges.map((e) => {
    if (e.data?.route === "nest") return e;
    if (e.sourceHandle === "nest-out" && e.targetHandle === "nest-in") {
      return {
        ...e,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          ...e.data,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        },
      };
    }
    return wireFlowEdge(e, positions, heightFor);
  });

  return { nodes, edges: applyMapEdgeBundles(wiredEdges) };
}

function JourneyCanvasInner({
  steps,
  focusStepId,
  focusHighlightText,
  phaseTitles,
  flowLinks = [],
  discoveryScopePick,
  mapEngagement,
  onSelectStep,
  onViewportPhaseRootId,
  className,
  style,
  fill = false,
}: {
  steps: CanvasStep[];
  focusStepId?: string | null;
  focusHighlightText?: string | null;
  phaseTitles?: string[];
  flowLinks?: FlowLink[];
  discoveryScopePick?: DiscoveryScopePickHandlers | null;
  mapEngagement?: MapCanvasEngagement;
  onSelectStep?: (id: string) => void;
  /** Fires when pan/zoom settles — root step id for the phase column at the viewport horizontal center. */
  onViewportPhaseRootId?: (rootStepId: string | null) => void;
  className?: string;
  style?: CSSProperties;
  fill?: boolean;
}) {
  const stepGraphKey = useMemo(
    () => steps.map((s) => `${s.id}:${s.order}:${s.parentStepId ?? ""}`).join("|"),
    [steps]
  );
  const layoutTierRef = useRef<MapDetailLevel>("detail");
  const canvasRef = useRef<HTMLDivElement>(null);
  const remeasureRef = useRef<() => void>(() => {});
  const onLayoutTierSettled = useCallback(() => {
    remeasureRef.current();
  }, []);
  const { detailLevel, layoutDetailLevel, tierTransition, setViewLevel } =
    useMapDetailLevel(onLayoutTierSettled);
  layoutTierRef.current = layoutDetailLevel;
  const measureNodeIds = useMemo(() => {
    const roots = steps.filter((s) => !s.parentStepId);
    const childrenByParent = buildChildrenByParent(steps);
    const ids = steps.map((s) => s.id);
    if (mapStacksChildActions(layoutDetailLevel)) {
      for (const root of roots) {
        const runs = childRunsForParent(
          root.id,
          childrenByParent.get(root.id) ?? [],
          flowLinks
        );
        for (const run of runs) {
          ids.push(mapActionStackNodeId(run[0]!.id));
        }
      }
    }
    return ids;
  }, [steps, flowLinks, layoutDetailLevel]);
  const stackedLod = mapStacksChildActions(layoutDetailLevel);
  const { heights: layoutHeights, requestRemeasure } = useMapNodeHeights(
    measureNodeIds,
    `${stepGraphKey}:${layoutDetailLevel}`,
    true,
    ".journey-canvas",
    stackedLod
  );
  remeasureRef.current = requestRemeasure;

  const childrenByParent = useMemo(() => buildChildrenByParent(steps), [steps]);
  const stepsById = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps]);

  const [engageTick, setEngageTick] = useState(0);
  const engageSig = useMemo(
    () => (mapEngagement ? JSON.stringify(mapEngagement.state) : ""),
    [mapEngagement]
  );
  useEffect(() => {
    if (mapEngagement) setEngageTick((t) => t + 1);
  }, [engageSig, mapEngagement]);

  const mapCanvasValue = useMemo(
    () => ({
      getStep: (id: string) => stepsById.get(id),
      childCount: (parentId: string) => childrenByParent.get(parentId)?.length ?? 0,
      focusHighlightText,
      discoveryScopePick: discoveryScopePick ?? undefined,
      mapEngagement,
      detailLevel,
      layoutDetailLevel,
      tierTransition,
      setViewLevel,
      onSelectStep,
      requestLayoutRemeasure: requestRemeasure,
    }),
    [
      stepsById,
      childrenByParent,
      focusHighlightText,
      discoveryScopePick,
      mapEngagement,
      detailLevel,
      layoutDetailLevel,
      tierTransition,
      setViewLevel,
      onSelectStep,
      requestRemeasure,
    ]
  );

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () =>
      buildGraph(
        steps,
        focusStepId,
        phaseTitles,
        flowLinks,
        layoutHeights,
        layoutDetailLevel
      ),
    [
      steps,
      focusStepId,
      phaseTitles,
      flowLinks,
      layoutHeights,
      layoutDetailLevel,
    ]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const rootStepIds = useMemo(
    () => new Set(steps.filter((s) => !s.parentStepId).map((s) => s.id)),
    [steps]
  );

  const syncViewportPhaseRoot = useCallback(() => {
    if (!onViewportPhaseRootId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width < 8) return;
    const flowCenter = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    const rootId = pickRootPhaseStepIdAtFlowX(nodes, rootStepIds, flowCenter.x);
    onViewportPhaseRootId(rootId);
  }, [nodes, rootStepIds, screenToFlowPosition, onViewportPhaseRootId]);
  const syncViewportPhaseRootRef = useRef(syncViewportPhaseRoot);
  syncViewportPhaseRootRef.current = syncViewportPhaseRoot;

  const lastViewportKeyRef = useRef("");
  const lastFocusFitRef = useRef<{ stepId: string; highlight: string | null } | null>(null);
  /** Incremented when the user pans — cancels pending focus-driven fitView. */
  const focusFitCancelRef = useRef(0);
  const prevViewLevelRef = useRef(layoutDetailLevel);

  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return layoutNodes.map((n) => {
        const prior = prevById.get(n.id);
        const nextData = { ...n.data, engageTick };
        if (
          prior &&
          prior.position.x === n.position.x &&
          prior.position.y === n.position.y &&
          prior.width === n.width &&
          prior.height === n.height &&
          prior.data?.engageTick === engageTick
        ) {
          return prior;
        }
        return {
          ...n,
          position: { ...n.position },
          data: nextData,
        };
      });
    });
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, engageTick, setNodes, setEdges]);

  useEffect(() => {
    if (lastViewportKeyRef.current === stepGraphKey) return;
    lastViewportKeyRef.current = stepGraphKey;
    const t = window.setTimeout(() => {
      fitView({ padding: FIT_PADDING, maxZoom: 1, duration: 0 });
      window.setTimeout(() => syncViewportPhaseRootRef.current(), 120);
    }, 100);
    return () => clearTimeout(t);
  }, [stepGraphKey, fitView]);

  /** Combined / Overview — restack layout then fit entire journey in the pane. */
  useEffect(() => {
    const prev = prevViewLevelRef.current;
    if (prev === layoutDetailLevel) return;
    prevViewLevelRef.current = layoutDetailLevel;

    if (!mapStacksChildActions(layoutDetailLevel)) return;

    focusFitCancelRef.current += 1;
    lastFocusFitRef.current = null;

    const tQuick = window.setTimeout(() => {
      fitView({ padding: FIT_PADDING, maxZoom: 1, duration: 0 });
    }, 60);
    const tSettle = window.setTimeout(() => {
      fitView({
        padding: FIT_PADDING,
        maxZoom: 1,
        duration: MAP_ZOOM_VIEWPORT_ANIM_MS,
      });
      window.setTimeout(() => syncViewportPhaseRootRef.current(), MAP_ZOOM_VIEWPORT_ANIM_MS + 40);
    }, 340);

    return () => {
      clearTimeout(tQuick);
      clearTimeout(tSettle);
    };
  }, [layoutDetailLevel, fitView]);

  useMapViewReadabilityScale(canvasRef, layoutDetailLevel);
  useMapWheelDestinationAnchor(canvasRef, layoutDetailLevel, nodes, tierTransition);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const data = node.data as {
        isActionRunStack?: boolean;
        runStepIds?: string[];
      };
      if (data.isActionRunStack && data.runStepIds?.[0]) {
        onSelectStep?.(data.runStepIds[0]!);
        return;
      }
      if (isMapActionStackNodeId(node.id)) return;
      onSelectStep?.(node.id);
    },
    [onSelectStep]
  );

  const canvasHeight = useMemo(() => {
    const roots = steps.filter((s) => !s.parentStepId);
    const childrenByParent = buildChildrenByParent(steps);
    const stepById = new Map(steps.map((s) => [s.id, s]));
    const stackMetaById = buildStackMetaById(
    roots,
    childrenByParent,
    flowLinks,
    layoutDetailLevel
  );
    const heightFor = makeHeightResolver(
      stepById,
      childrenByParent,
      layoutHeights,
      layoutDetailLevel,
      stackMetaById
    );
    const stackOpts: MapStackLayoutOptions = {
      measuredStackHeights: layoutHeights,
    };
    const phases = phaseColumnOrder(steps, phaseTitles);
    let maxBottom = 168;
    for (const phaseTitle of phases) {
      let columnY = 0;
      for (const root of roots.filter((r) => r.phaseTitle === phaseTitle)) {
        const rootH = heightFor(root.id);
        const rootFoot = mapStacksChildActions(layoutDetailLevel)
          ? resolveRootFootprintPx(
              rootH,
              layoutDetailLevel,
              layoutHeights[root.id]
            )
          : rootH;
        let stackBottom = columnY + rootFoot;
        const children = childrenByParent.get(root.id) ?? [];
        const runs = childRunsForParent(root.id, children, flowLinks);
        if (runs.length > 0) {
          if (mapStacksChildActions(layoutDetailLevel)) {
            const childY = stackedActionAnchorY(
              columnY,
              rootH,
              layoutDetailLevel,
              layoutHeights[root.id]
            );
            stackBottom = stackedActionAreaBottom(
              childY,
              runs,
              layoutDetailLevel,
              stackOpts
            );
          } else {
            let laneY = columnY + rootH + CARD_GAP_PX;
            for (const run of runs) {
              let laneMaxH = 0;
              for (const child of run) {
                laneMaxH = Math.max(laneMaxH, heightFor(child.id));
              }
              stackBottom = Math.max(stackBottom, laneY + laneMaxH);
              laneY += laneMaxH + CARD_GAP_PX;
            }
          }
        }
        columnY = stackBottom + CARD_GAP_PX;
      }
      maxBottom = Math.max(maxBottom, columnY + 48);
    }
    return Math.min(CANVAS_MAX_H, Math.max(CANVAS_MIN_H, maxBottom));
  }, [steps, phaseTitles, flowLinks, layoutHeights, layoutDetailLevel]);

  useEffect(() => {
    if (!focusStepId) {
      lastFocusFitRef.current = null;
      return;
    }
    const highlight = focusHighlightText?.trim() || null;
    const prev = lastFocusFitRef.current;
    if (prev && prev.stepId === focusStepId && prev.highlight === highlight) {
      return;
    }
    lastFocusFitRef.current = { stepId: focusStepId, highlight };

    const id = focusStepId;
    const fitGen = focusFitCancelRef.current;
    const t = window.setTimeout(() => {
      if (fitGen !== focusFitCancelRef.current) return;
      fitView({ nodes: [{ id }], padding: 0.34, maxZoom: 1.1, duration: 420 });
      window.setTimeout(() => syncViewportPhaseRootRef.current(), 480);
    }, 80);
    const tRefit = highlight
      ? window.setTimeout(() => {
          if (fitGen !== focusFitCancelRef.current) return;
          fitView({ nodes: [{ id }], padding: 0.34, maxZoom: 1.05, duration: 300 });
          window.setTimeout(() => syncViewportPhaseRootRef.current(), 340);
        }, 400)
      : undefined;
    return () => {
      clearTimeout(t);
      if (tRefit !== undefined) clearTimeout(tRefit);
    };
  }, [focusStepId, focusHighlightText, fitView]);

  const heightStyle: CSSProperties = fill
    ? { width: "100%", height: "100%", minHeight: 0, ...style }
    : {
        width: "100%",
        height: canvasHeight,
        ...style,
      };

  if (!fill && style?.minHeight != null) {
    const minPx =
      typeof style.minHeight === "number"
        ? style.minHeight
        : parseFloat(String(style.minHeight)) || canvasHeight;
    heightStyle.height = Math.max(canvasHeight, minPx);
  }

  return (
    <div
      ref={canvasRef}
      className={cn(
        "journey-canvas w-full rounded-2xl",
        fill ? "h-full min-h-0" : "min-h-[480px]",
        className
      )}
      style={heightStyle}
      data-map-detail={detailLevel}
      data-map-detail-layout={layoutDetailLevel}
      data-map-detail-transition={tierTransition === "idle" ? undefined : tierTransition}
    >
      <MapCanvasProvider value={mapCanvasValue}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onMoveStart={() => {
            focusFitCancelRef.current += 1;
            lastFocusFitRef.current = null;
          }}
          onMoveEnd={syncViewportPhaseRoot}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll={false}
          zoomOnScroll
          zoomOnPinch
          proOptions={{ hideAttribution: true }}
          minZoom={MAP_MIN_VIEWPORT_ZOOM}
          maxZoom={1.2}
          defaultEdgeOptions={{ style: { strokeLinecap: "round" } }}
        >
          <Background color="#e3e3e8" gap={24} size={1} />
          <MapZoomLodRail />
          <Controls showInteractive={false} />
        </ReactFlow>
      </MapCanvasProvider>
    </div>
  );
}

export function JourneyCanvas(props: {
  steps: CanvasStep[];
  focusStepId?: string | null;
  /** When set, emphasized inside the focused step card (discovery map reference). */
  focusHighlightText?: string | null;
  phaseTitles?: string[];
  flowLinks?: FlowLink[];
  discoveryScopePick?: DiscoveryScopePickHandlers | null;
  mapEngagement?: MapCanvasEngagement;
  onSelectStep?: (id: string) => void;
  onViewportPhaseRootId?: (rootStepId: string | null) => void;
  className?: string;
  style?: CSSProperties;
  fill?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <JourneyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}