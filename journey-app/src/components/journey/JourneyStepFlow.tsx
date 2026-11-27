"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { CSS, type Transform } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { StepNode } from "@/components/journey/StepNode";
import { useJourneyCanvasSelectionOptional } from "@/components/journey/JourneyCanvasSelectionContext";
import { useJourneyCanvasScale } from "@/components/journey/JourneyCanvasTransformContext";
import {
  applyChildReparent,
  applyChildReorderInParent,
  collectMovingChildIds,
  findActionInRoots,
  findChildParentId,
  isRootStepId,
  resolveActionDropTarget,
  resolveCommittedActionDrop,
  resolveDropIdFromPoint,
  sortedChildren,
} from "@/lib/journey/flowStepTree";
import { reorderWithSelection } from "@/lib/journey/reorderWithSelection";
import {
  JOURNEY_DROP_MS,
  journeyChromeTransition,
  journeyDropAnimation,
  journeyLayoutTransition,
} from "@/lib/dnd/animations";
import {
  createActionFlowBranch,
  reparentChildSteps,
  reorderSteps,
  saveStep,
} from "@/lib/actions/journey";
import {
  groupActionsIntoSiblingRuns,
  orderActionsForFlowTree,
} from "@/lib/journey/actionFlowLayout";
import { TREE_SPINE_GUTTER_PX } from "@/lib/journey/journeyConnectorGeometry";
import {
  ACTION_CARD_WIDTH_PX,
  ADD_STEP_TRAIL_PX,
  JOURNEY_FLOW_INLINE_GAP_PX,
  JOURNEY_FLOW_STACK_GAP_PX,
  SIBLING_ADD_BUTTON_PX,
  STEP_COLUMN_WIDTH_PX,
} from "@/lib/journey/journeyFlowSpacing";
import type { FlowLink } from "@/lib/journey/flowLinks";
import { JourneyFlowLinkOverlay } from "@/components/journey/JourneyFlowLinkOverlay";
import {
  JourneyActionFlowOverlay,
  type ActionFlowColumnSpec,
} from "@/components/journey/JourneyActionFlowOverlay";
import { StepSequenceConnectorOverlay } from "@/components/journey/StepSequenceConnectorOverlay";
import {
  applyActionFlowLaneMap,
  resolveActionFlowBranchId,
  type ActionFlowLaneMap,
} from "@/lib/journey/resolveActionFlowLane";
import { cn } from "@/lib/utils";

export type FlowStep = {
  id: string;
  title: string;
  userAction: string | null;
  order: number;
  parentStepId?: string | null;
  actionFlowBranchId?: string | null;
  touchpoints: {
    id: string;
    module: string | null;
    screen: string | null;
    panel: string | null;
    dialog: string | null;
  }[];
  painPoints: {
    id: string;
    description: string;
    severity: number;
    evidence: string | null;
    opportunity: string | null;
  }[];
  feelings: {
    id: string;
    title: string;
    confidence: number;
    frustration: number;
    delight: number;
    freeText: string | null;
  }[];
  children?: FlowStep[];
};

type DragGroupState = {
  activeId: string | null;
  multiRootDrag: boolean;
  dragKind: "root" | "action" | null;
};

const journeyStackGapClass = "journey-flow-stack-gap";
const journeyInlineGapClass = "journey-flow-inline-gap";
const flowStackGapStyle = { gap: JOURNEY_FLOW_STACK_GAP_PX } as const;
const flowInlineGapStyle = { gap: JOURNEY_FLOW_INLINE_GAP_PX } as const;

function sortableItemStyle(
  transform: Transform | null,
  transition: string | undefined,
  canvasScale: number,
  isDragging: boolean,
  width: number | "100%"
) {
  const corrected =
    transform && canvasScale > 0
      ? { x: transform.x / canvasScale, y: transform.y / canvasScale, scaleX: 1, scaleY: 1 }
      : null;

  const colPx = width === "100%" ? STEP_COLUMN_WIDTH_PX : width;
  return {
    transform: corrected ? CSS.Translate.toString(corrected) : undefined,
    transition: isDragging ? undefined : (transition ?? journeyLayoutTransition),
    opacity: isDragging ? 0.96 : 1,
    zIndex: isDragging ? 40 : undefined,
    width: width === "100%" ? "100%" : colPx,
    minWidth: width === "100%" ? undefined : colPx,
    maxWidth:
      width === "100%"
        ? undefined
        : colPx > STEP_COLUMN_WIDTH_PX
          ? `min(${colPx}px, calc(85vw + ${ADD_STEP_TRAIL_PX}px))`
          : "min(300px, 85vw)",
    flex: width === "100%" ? undefined : (`0 0 ${colPx}px` as const),
    boxSizing: "border-box" as const,
  };
}

const DragGroupContext = createContext<DragGroupState>({
  activeId: null,
  multiRootDrag: false,
  dragKind: null,
});

function rootSteps(steps: FlowStep[]) {
  return steps.filter((s) => !s.parentStepId);
}

function appendNestedAction(roots: FlowStep[], parentStepId: string, child: FlowStep): FlowStep[] {
  return roots.map((root) => {
    if (root.id !== parentStepId) return root;
    const children = [...(root.children ?? []), child].sort((a, b) => a.order - b.order);
    return { ...root, children };
  });
}

function syncStepsFromServer(
  prev: FlowStep[],
  incoming: FlowStep[],
  laneByActionId: ActionFlowLaneMap
): FlowStep[] {
  const laneByChildId = new Map<string, string>();
  for (const root of prev) {
    for (const c of root.children ?? []) {
      if (c.actionFlowBranchId?.startsWith("lane:")) {
        laneByChildId.set(c.id, c.actionFlowBranchId);
      }
    }
  }

  return applyActionFlowLaneMap(
    rootSteps(incoming).map((root) => ({
      ...root,
      children: (root.children ?? []).map((c) => {
        const remembered = laneByChildId.get(c.id);
        return {
          ...c,
          actionFlowBranchId:
            resolveActionFlowBranchId(c.id, c.actionFlowBranchId, laneByActionId) ??
            remembered ??
            c.actionFlowBranchId ??
            null,
        };
      }),
    })),
    laneByActionId
  );
}

function newActionFlowStep(input: {
  id: string;
  title: string;
  userAction: string;
  order: number;
  parentStepId: string;
  actionFlowBranchId: string;
}): FlowStep {
  return {
    id: input.id,
    title: input.title,
    userAction: input.userAction,
    order: input.order,
    parentStepId: input.parentStepId,
    actionFlowBranchId: input.actionFlowBranchId,
    touchpoints: [],
    painPoints: [],
    feelings: [],
    children: [],
  };
}

function canStartDrag(target: EventTarget | null) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest("input, textarea, select, [role='slider']")) return false;
  if (el.closest("[data-journey-no-drag]")) return false;

  if (el.closest("[data-journey-root-drag]")) {
    return true;
  }

  const onActionCard = el.closest('[data-journey-sortable="action"]');
  if (onActionCard) {
    if (el.closest("button, a")) return false;
    return true;
  }
  if (el.closest("button, a")) return false;
  return true;
}

function pointerFromActivator(activatorEvent: Event, delta?: { x: number; y: number }) {
  if (activatorEvent instanceof PointerEvent || activatorEvent instanceof MouseEvent) {
    const dx = delta?.x ?? 0;
    const dy = delta?.y ?? 0;
    return { x: activatorEvent.clientX + dx, y: activatorEvent.clientY + dy };
  }
  return null;
}

function wrapPointerListener(listeners: ReturnType<typeof useSortable>["listeners"]) {
  if (!listeners?.onPointerDown) return listeners;
  const onPointerDown = listeners.onPointerDown;
  return {
    ...listeners,
    onPointerDown: (event: React.PointerEvent) => {
      if (!canStartDrag(event.target)) return;
      onPointerDown(event);
    },
  };
}

type JourneyStepFlowProps = {
  journeyId: string;
  phaseId: string;
  initialSteps: FlowStep[];
  flowLinks?: FlowLink[];
  flowLaneByActionId?: ActionFlowLaneMap;
};

/** Avoid dnd-kit SSR/client aria-id drift (hydration warnings). */
export function JourneyStepFlow(props: JourneyStepFlowProps) {
  const [dndReady, setDndReady] = useState(false);
  useEffect(() => setDndReady(true), []);
  if (!dndReady) return <JourneyStepFlowPlaceholder {...props} />;
  return <JourneyStepFlowDnd {...props} />;
}

function JourneyStepFlowPlaceholder({
  journeyId,
  phaseId,
  initialSteps,
  flowLinks = [],
  flowLaneByActionId = {},
}: JourneyStepFlowProps) {
  const roots = useMemo(
    () => applyActionFlowLaneMap(rootSteps(initialSteps), flowLaneByActionId),
    [initialSteps, flowLaneByActionId]
  );
  const actionCount = roots.reduce((n, s) => n + (s.children?.length ?? 0), 0);

  return (
    <div className="mt-2" aria-busy="true">
      {actionCount > 0 && (
        <p className="m3-caption mb-3">
          {actionCount} additional user action{actionCount === 1 ? "" : "s"} nested under steps
        </p>
      )}
      <div className="flex min-w-max items-start px-1 py-1 pb-8">
        {roots.map((step, i) => (
          <div
            key={step.id}
            className="flex items-start shrink-0"
            style={{
              marginInlineEnd: i < roots.length - 1 ? JOURNEY_FLOW_STACK_GAP_PX : undefined,
            }}
          >
            <div
              className={cn(
                "flex w-max min-w-[300px] shrink-0 flex-col items-start",
                journeyStackGapClass
              )}
              style={flowStackGapStyle}
            >
              <StepNode
                step={step}
                index={i + 1}
                journeyId={journeyId}
                phaseId={phaseId}
                variant="step"
              />
              {sortedChildren(step).length > 0 ? (
                (() => {
                  const nested = sortedChildren(step).map((c) => ({
                    ...c,
                    actionFlowBranchId: resolveActionFlowBranchId(
                      c.id,
                      c.actionFlowBranchId,
                      flowLaneByActionId
                    ),
                  }));
                  const childIds = new Set(nested.map((a) => a.id));
                  const childLinks = flowLinks.filter(
                    (l) => childIds.has(l.fromStepId) && childIds.has(l.toStepId)
                  );
                  const runs = groupActionsIntoSiblingRuns(nested, childLinks, step.id);
                  let sub = 0;
                  return (
                    <div
                      className={cn("flex w-max flex-col", journeyStackGapClass)}
                      style={flowStackGapStyle}
                    >
                      {runs.map((run) => (
                        <ul
                          key={run.map((c) => c.id).join("-")}
                          className={cn(
                            "flex w-max flex-row flex-nowrap items-start",
                            journeyInlineGapClass
                          )}
                          style={flowInlineGapStyle}
                        >
                          {run.map((child) => {
                            sub += 1;
                            return (
                              <li
                                key={child.id}
                                className="shrink-0"
                                style={{ width: ACTION_CARD_WIDTH_PX }}
                              >
                                <StepNode
                                  step={child}
                                  index={i + 1}
                                  subIndex={sub}
                                  journeyId={journeyId}
                                  phaseId={phaseId}
                                  variant="action"
                                />
                              </li>
                            );
                          })}
                        </ul>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <p className="m3-caption px-3 py-2 text-center text-muted">Drop user actions here</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyStepFlowDnd({
  journeyId,
  phaseId,
  initialSteps,
  flowLinks = [],
  flowLaneByActionId = {},
}: JourneyStepFlowProps) {
  const flowSurfaceRef = useRef<HTMLDivElement>(null);
  const roots = useMemo(
    () => applyActionFlowLaneMap(rootSteps(initialSteps), flowLaneByActionId),
    [initialSteps, flowLaneByActionId]
  );
  const [steps, setSteps] = useState(roots);
  const actionFlowColumns = useMemo((): ActionFlowColumnSpec[] => {
    return steps
      .map((step) => {
        const nested = sortedChildren(step).map((c) => ({
          ...c,
          actionFlowBranchId: resolveActionFlowBranchId(
            c.id,
            c.actionFlowBranchId,
            flowLaneByActionId
          ),
        }));
        const childIds = new Set(nested.map((a) => a.id));
        const childLinks = flowLinks.filter(
          (l) => childIds.has(l.fromStepId) && childIds.has(l.toStepId)
        );
        const runs = groupActionsIntoSiblingRuns(nested, childLinks, step.id);
        return {
          parentStepId: step.id,
          actionRuns: runs.map((r) => r.map((a) => a.id)),
        };
      })
      .filter((c) => c.actionRuns.length > 0);
  }, [steps, flowLinks, flowLaneByActionId]);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const dragStartStepsRef = useRef(steps);
  const router = useRouter();
  const [, start] = useTransition();
  const selection = useJourneyCanvasSelectionOptional();
  const canvasScale = useJourneyCanvasScale();
  const [dragGroup, setDragGroup] = useState<DragGroupState>({
    activeId: null,
    multiRootDrag: false,
    dragKind: null,
  });
  useEffect(() => {
    setSteps((prev) => syncStepsFromServer(prev, initialSteps, flowLaneByActionId));
  }, [initialSteps, flowLaneByActionId]);

  const journeySensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const rootCollisionDetection = useCallback<CollisionDetection>((args) => {
    const rootsNow = stepsRef.current;
    return closestCenter(args).filter((hit) => isRootStepId(rootsNow, String(hit.id)));
  }, []);

  const actionCollisionDetection = useCallback<CollisionDetection>((args) => {
    const byPointer = pointerWithin(args);
    if (byPointer.length > 0) {
      const rootsNow = stepsRef.current;
      const actionHits = byPointer.filter((c) =>
        Boolean(findChildParentId(rootsNow, String(c.id)))
      );
      if (actionHits.length > 0) return actionHits;
      const reparentHits = byPointer.filter((c) => String(c.id).startsWith("reparent-"));
      if (reparentHits.length > 0) return reparentHits;
      return byPointer.filter((c) => !String(c.id).startsWith("column-"));
    }
    return closestCenter(args);
  }, []);

  const journeyCollisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const type = args.active?.data.current?.type;
      if (type === "action") return actionCollisionDetection(args);
      if (type === "root") return rootCollisionDetection(args);
      return closestCenter(args);
    },
    [actionCollisionDetection, rootCollisionDetection]
  );

  const commitActionDrop = useCallback(
    (activeId: string, overId: string | null, pointer: { x: number; y: number }): boolean => {
      const clearDrag = () =>
        setDragGroup({ activeId: null, multiRootDrag: false, dragKind: null });
      const selected = selection?.selectedIds ?? new Set<string>();
      const snapshot = dragStartStepsRef.current;
      const resolvedOver = resolveCommittedActionDrop(snapshot, activeId, overId, pointer);
      if (!resolvedOver || resolvedOver === activeId) {
        clearDrag();
        return false;
      }

      const movingIds = collectMovingChildIds(snapshot, activeId, selected);
      if (movingIds.length === 0) {
        clearDrag();
        return false;
      }

      const target = resolveActionDropTarget(snapshot, resolvedOver);
      if (!target) {
        clearDrag();
        return false;
      }

      const fromParent = findChildParentId(snapshot, activeId);
      const allSameParent = movingIds.every((id) => findChildParentId(snapshot, id) === fromParent);

      const appendToParent =
        resolvedOver.startsWith("reparent-") ||
        (isRootStepId(snapshot, resolvedOver) && !findChildParentId(snapshot, resolvedOver));
      if (allSameParent && fromParent === target.parentId && !appendToParent) {
        const next = applyChildReorderInParent(
          snapshot,
          target.parentId,
          activeId,
          resolvedOver,
          selected
        );
        if (!next) {
          clearDrag();
          return false;
        }
        setSteps(next);
        const parent = next.find((s) => s.id === target.parentId);
        if (!parent) {
          clearDrag();
          return false;
        }
        start(async () => {
          await reorderSteps(phaseId, journeyId, sortedChildren(parent).map((c) => c.id));
          router.refresh();
        });
        clearDrag();
        return true;
      }

      const next = applyChildReparent(snapshot, movingIds, target.parentId, target.beforeChildId);
      if (!next) {
        clearDrag();
        return false;
      }
      setSteps(next);
      start(async () => {
        try {
          await reparentChildSteps(
            phaseId,
            journeyId,
            movingIds,
            target.parentId,
            target.beforeChildId
          );
          router.refresh();
        } catch {
          setSteps(dragStartStepsRef.current);
        }
      });
      clearDrag();
      return true;
    },
    [journeyId, phaseId, router, selection, start]
  );

  const [rootDragOverlay, setRootDragOverlay] = useState<{
    step: FlowStep;
    index: number;
  } | null>(null);
  const clearRootOverlay = useCallback(() => setRootDragOverlay(null), []);

  const resetDrag = useCallback(
    (restoreLayout?: boolean) => {
      if (restoreLayout) setSteps(dragStartStepsRef.current);
      setDragGroup({ activeId: null, multiRootDrag: false, dragKind: null });
      clearRootOverlay();
    },
    [clearRootOverlay]
  );

  const onRootDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const selected = selection?.selectedIds ?? new Set<string>();
    const multiRoot =
      selected.size > 1 &&
      selected.has(activeId) &&
      stepsRef.current.some((s) => selected.has(s.id));
    dragStartStepsRef.current = stepsRef.current;
    setDragGroup({ activeId, multiRootDrag: multiRoot, dragKind: "root" });
    const idx = stepsRef.current.findIndex((s) => s.id === activeId);
    const step = idx >= 0 ? stepsRef.current[idx] : undefined;
    if (step) setRootDragOverlay({ step, index: idx + 1 });
  };

  const onActionDragStart = useCallback((activeId: string) => {
    dragStartStepsRef.current = stepsRef.current;
    setDragGroup({ activeId, multiRootDrag: false, dragKind: "action" });
  }, []);

  const actionPointerRef = useRef({ x: 0, y: 0 });
  const lastActionOverRef = useRef<string | null>(null);

  const syncActionPointer = (event: { activatorEvent: Event; delta?: { x: number; y: number } }) => {
    const pt = pointerFromActivator(event.activatorEvent, event.delta);
    if (pt) actionPointerRef.current = pt;
  };

  const onActionDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    syncActionPointer(event);
    const overId = event.over
      ? String(event.over.id)
      : lastActionOverRef.current;
    lastActionOverRef.current = null;
    if (overId === activeId) {
      resetDrag(true);
      clearActionOverlay();
      return;
    }
    const dropped = commitActionDrop(activeId, overId, actionPointerRef.current);
    if (!dropped) {
      resetDrag(true);
      clearActionOverlay();
      return;
    }
    window.setTimeout(() => clearActionOverlay(), JOURNEY_DROP_MS);
  };

  const onRootDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.data.current?.type !== "root") {
      resetDrag(true);
      return;
    }

    if (!over || active.id === over.id) {
      resetDrag(true);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const selected = selection?.selectedIds ?? new Set<string>();
    const snapshot = dragStartStepsRef.current;

    resetDrag();

    if (!isRootStepId(snapshot, activeId) || !isRootStepId(snapshot, overId)) {
      setSteps(snapshot);
      return;
    }

    const reordered = reorderWithSelection(snapshot, activeId, overId, selected);
    if (!reordered) {
      setSteps(snapshot);
      return;
    }
    setSteps(reordered);
    window.setTimeout(() => clearRootOverlay(), JOURNEY_DROP_MS);
    start(async () => {
      await reorderSteps(
        phaseId,
        journeyId,
        reordered.map((s) => s.id)
      );
      router.refresh();
    });
  };

  const actionCount = useMemo(
    () => steps.reduce((n, s) => n + (s.children?.length ?? 0), 0),
    [steps]
  );

  const [actionDragOverlay, setActionDragOverlay] = useState<{
    step: FlowStep;
    parentIndex: number;
    subIndex: number;
  } | null>(null);

  const clearActionOverlay = useCallback(() => setActionDragOverlay(null), []);

  const onJourneyDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === "action") {
      const activeId = String(event.active.id);
      lastActionOverRef.current = null;
      onActionDragStart(activeId);
      syncActionPointer(event);
      const hit = findActionInRoots(stepsRef.current, activeId);
      if (hit) setActionDragOverlay(hit);
      return;
    }
    if (type === "root") onRootDragStart(event);
  };

  const onBranchActionCreated = useCallback((parentStepId: string, child: FlowStep) => {
    setSteps((prev) => appendNestedAction(prev, parentStepId, child));
  }, []);

  const onJourneyDragEnd = (event: DragEndEvent) => {
    const type = event.active.data.current?.type;
    if (type === "action") {
      onActionDragEnd(event);
      return;
    }
    if (type === "root") onRootDragEnd(event);
    else resetDrag(true);
  };

  const onJourneyDragCancel = () => {
    lastActionOverRef.current = null;
    clearActionOverlay();
    resetDrag(true);
  };

  return (
    <DragGroupContext.Provider value={dragGroup}>
      <div className="mt-2">
        {actionCount > 0 && (
          <p className="m3-caption mb-3">
            {actionCount} additional user action{actionCount === 1 ? "" : "s"} nested under steps
          </p>
        )}
        <DndContext
          sensors={journeySensors}
          collisionDetection={journeyCollisionDetection}
          modifiers={[snapCenterToCursor]}
          autoScroll={{ threshold: { x: 0.12, y: 0.12 }, acceleration: 8 }}
          measuring={{
            droppable: { strategy: MeasuringStrategy.Always },
          }}
          onDragStart={onJourneyDragStart}
          onDragMove={syncActionPointer}
          onDragOver={(event: DragOverEvent) => {
            if (event.active.data.current?.type === "action" && event.over) {
              lastActionOverRef.current = String(event.over.id);
            }
          }}
          onDragCancel={onJourneyDragCancel}
          onDragEnd={onJourneyDragEnd}
        >
          <SortableContext items={steps.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
            <div ref={flowSurfaceRef} className="relative min-w-max">
              <JourneyFlowLinkOverlay
                containerRef={flowSurfaceRef}
                links={flowLinks}
                scale={canvasScale}
              />
              <StepSequenceConnectorOverlay
                containerRef={flowSurfaceRef}
                stepIds={steps.map((s) => s.id)}
                scale={canvasScale}
              />
              <JourneyActionFlowOverlay
                containerRef={flowSurfaceRef}
                columns={actionFlowColumns}
                scale={canvasScale}
              />
              <div className="flex min-w-max items-start px-1 py-1 pb-8">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className="flex items-stretch shrink-0"
                  style={{
                    marginInlineEnd:
                      i < steps.length - 1 ? JOURNEY_FLOW_STACK_GAP_PX : undefined,
                  }}
                >
                  <SortableStepColumn
                    step={step}
                    index={i + 1}
                    journeyId={journeyId}
                    phaseId={phaseId}
                    flowLinks={flowLinks}
                    flowLaneByActionId={flowLaneByActionId}
                    isFlowLast={i === steps.length - 1}
                    onBranchActionCreated={onBranchActionCreated}
                  />
                </div>
              ))}
              {steps.length === 0 ? (
                <AddStepColumn journeyId={journeyId} phaseId={phaseId} />
              ) : null}
              </div>
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={journeyDropAnimation}
            zIndex={2000}
            style={{
              width: actionDragOverlay ? "min(300px, 85vw)" : 300,
            }}
          >
            {actionDragOverlay ? (
              <div
                className="w-full rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-2 ring-brand/35 cursor-grabbing transition-transform duration-200 ease-out"
                data-journey-dragging="true"
              >
                <StepNode
                  step={actionDragOverlay.step}
                  index={actionDragOverlay.parentIndex}
                  subIndex={actionDragOverlay.subIndex}
                  journeyId={journeyId}
                  phaseId={phaseId}
                  variant="action"
                />
              </div>
            ) : rootDragOverlay ? (
              <div
                className="w-[300px] cursor-grabbing rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-2 ring-brand/35"
                data-journey-dragging="true"
              >
                <StepNode
                  step={rootDragOverlay.step}
                  index={rootDragOverlay.index}
                  journeyId={journeyId}
                  phaseId={phaseId}
                  variant="step"
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DragGroupContext.Provider>
  );
}

function SortableStepColumn({
  step,
  index,
  journeyId,
  phaseId,
  flowLinks,
  flowLaneByActionId = {},
  isFlowLast = false,
  onBranchActionCreated,
}: {
  step: FlowStep;
  index: number;
  journeyId: string;
  phaseId: string;
  flowLinks: FlowLink[];
  flowLaneByActionId?: ActionFlowLaneMap;
  isFlowLast?: boolean;
  onBranchActionCreated?: (parentStepId: string, child: FlowStep) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const selection = useJourneyCanvasSelectionOptional();
  const dragGroup = useContext(DragGroupContext);
  const canvasScale = useJourneyCanvasScale();
  const childActions = useMemo(
    () =>
      sortedChildren(step).map((c) => ({
        ...c,
        actionFlowBranchId: resolveActionFlowBranchId(
          c.id,
          c.actionFlowBranchId,
          flowLaneByActionId
        ),
      })),
    [step, flowLaneByActionId]
  );
  const childFlowLinks = useMemo(() => {
    const childIds = new Set(childActions.map((a) => a.id));
    return flowLinks.filter(
      (l) => childIds.has(l.fromStepId) && childIds.has(l.toStepId)
    );
  }, [childActions, flowLinks]);
  const actionRuns = useMemo(
    () => groupActionsIntoSiblingRuns(childActions, childFlowLinks, step.id),
    [childActions, childFlowLinks, step.id]
  );
  const hasActionTree = childActions.length > 0;
  const columnWidth = useMemo(() => {
    const head = isFlowLast ? STEP_COLUMN_WIDTH_PX + ADD_STEP_TRAIL_PX : STEP_COLUMN_WIDTH_PX;
    if (!hasActionTree) return head;
    const maxRun = Math.max(
      1,
      ...actionRuns.map(
        (run) =>
          run.length * ACTION_CARD_WIDTH_PX +
          run.length * JOURNEY_FLOW_INLINE_GAP_PX +
          SIBLING_ADD_BUTTON_PX
      )
    );
    return Math.max(head, maxRun + TREE_SPINE_GUTTER_PX + 8);
  }, [actionRuns, hasActionTree, isFlowLast]);

  const {
    attributes,
    listeners,
    setDroppableNodeRef,
    setDraggableNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, data: { type: "root" } });

  const multiSelected =
    dragGroup.multiRootDrag &&
    dragGroup.activeId &&
    selection?.selectedIds.has(dragGroup.activeId);
  const isSelected = selection?.isSelected(step.id) ?? false;
  const { setNodeRef: setReparentDropRef, isOver: isReparentDropTarget } = useDroppable({
    id: `reparent-${step.id}`,
    data: { type: "reparent", parentId: step.id },
  });

  const actionDragActive = dragGroup.dragKind === "action";
  const rootDragActive = dragGroup.dragKind === "root";

  const style = sortableItemStyle(
    transform,
    transition,
    canvasScale,
    isDragging,
    columnWidth
  );

  const columnRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDroppableNodeRef(node);
    },
    [setDroppableNodeRef]
  );

  const rootDragActivatorRef = useCallback(
    (node: HTMLDivElement | null) => {
      setActivatorNodeRef(node);
      setDraggableNodeRef(node);
      setReparentDropRef(node);
    },
    [setActivatorNodeRef, setDraggableNodeRef, setReparentDropRef]
  );

  const boundListeners = useMemo(() => wrapPointerListener(listeners), [listeners]);

  useEffect(() => {
    if (!addOpen) return;
    const close = () => setAddOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      const el = addFormRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const attachId = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(attachId);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addOpen]);

  return (
    <div
      ref={columnRef}
      data-journey-step-column
      data-journey-column-id={step.id}
      data-journey-sortable="step-column"
      className={cn(
        "relative flex shrink-0 flex-col items-start overflow-visible",
        journeyStackGapClass
      )}
      style={{
        ...style,
        ...flowStackGapStyle,
        width: columnWidth,
        minWidth: STEP_COLUMN_WIDTH_PX,
        maxWidth: "none",
        opacity: isDragging && rootDragActive ? 0.2 : style.opacity,
        transition: `${style.transition ?? journeyLayoutTransition}, ${journeyChromeTransition}`,
      }}
    >
      <div className={cn("flex w-full items-start", journeyStackGapClass)} style={flowStackGapStyle}>
        <div
          ref={rootDragActivatorRef}
          {...attributes}
          {...boundListeners}
          data-journey-root-drag
          data-journey-step-parent-drop
          style={{ touchAction: "none" }}
          className={cn(
            "w-[300px] max-w-[min(300px,85vw)] shrink-0 rounded-xl select-none transition-shadow duration-200",
            isDragging && rootDragActive ? "cursor-grabbing" : "cursor-grab",
            actionDragActive &&
              isReparentDropTarget &&
              "ring-2 ring-brand/45 shadow-[0_0_0_4px_rgba(0,20,220,0.12)]"
          )}
        >
          <StepNode
            step={step}
            index={index}
            journeyId={journeyId}
            phaseId={phaseId}
            variant="step"
          />
        </div>
        {isFlowLast ? (
          <AddStepColumn journeyId={journeyId} phaseId={phaseId} />
        ) : null}
      </div>

      <div
        className={cn(
          "relative z-[2] flex w-max max-w-none flex-col",
          journeyStackGapClass
        )}
        style={flowStackGapStyle}
      >
        {hasActionTree ? (
          <div
            data-journey-action-tree
            className={cn("flex w-max flex-col", journeyStackGapClass)}
            style={flowStackGapStyle}
          >
            <ActionListDnd
              actionRuns={actionRuns}
              parentStepId={step.id}
              parentIndex={index}
              journeyId={journeyId}
              phaseId={phaseId}
              dragSurfaceActive={actionDragActive}
            />
          </div>
        ) : null}
        <div
          className="flex justify-start pl-1"
        >
          {!addOpen ? (
            <button
              type="button"
              data-journey-no-drag
              data-journey-new-flow-branch
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen(true);
              }}
              className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-outline bg-surface-container text-brand hover:border-brand hover:bg-brand-container pointer-events-auto"
              title={`Add separate user action flow under step ${index}`}
              aria-label={`Add separate user action flow under step ${index}`}
            >
              <Plus className="pointer-events-none h-4 w-4" />
            </button>
          ) : (
            <form
              ref={addFormRef}
              data-journey-no-drag
              data-journey-new-flow-branch
              className="min-w-[300px] rounded-xl border border-dashed border-outline bg-surface-container p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const userAction = String(fd.get("userAction") || "").trim();
                if (!userAction) return;
                start(async () => {
                  try {
                    const created = await createActionFlowBranch(
                      phaseId,
                      journeyId,
                      step.id,
                      userAction
                    );
                    const child = newActionFlowStep({
                      id: created.id,
                      title: created.title,
                      userAction: created.userAction,
                      order: created.order,
                      parentStepId: created.parentStepId,
                      actionFlowBranchId: created.actionFlowBranchId,
                    });
                    onBranchActionCreated?.(step.id, child);
                    form.reset();
                    setAddOpen(false);
                    void router.refresh();
                  } catch (err) {
                    console.error(err);
                  }
                });
              }}
            >
              <div className="flex items-center gap-1.5">
                <input
                  name="userAction"
                  required
                  autoFocus
                  placeholder="Verb-led action — new branch"
                  className="m3-field min-w-0 flex-1"
                  disabled={pending}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="m3-btn-filled h-10 w-10 shrink-0 p-0 disabled:opacity-50"
                  title="Add new action flow (separate branch)"
                  aria-label="Add new action flow as separate branch under this step"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionListDnd({
  actionRuns,
  parentStepId,
  parentIndex,
  journeyId,
  phaseId,
  dragSurfaceActive,
}: {
  actionRuns: FlowStep[][];
  parentStepId: string;
  parentIndex: number;
  journeyId: string;
  phaseId: string;
  dragSurfaceActive: boolean;
}) {
  const subIndexById = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const run of actionRuns) {
      for (const a of run) {
        n += 1;
        m.set(a.id, n);
      }
    }
    return m;
  }, [actionRuns]);

  return actionRuns.length > 0 ? (
    <div className={cn("flex w-max flex-col", journeyStackGapClass)} style={flowStackGapStyle}>
      {actionRuns.map((run) => {
        const runIds = run.map((a) => a.id);
        return (
          <SortableContext
            key={runIds.join("-")}
            items={runIds}
            strategy={horizontalListSortingStrategy}
          >
            <div
              data-journey-action-run
              data-journey-action-lane
              data-lane-key={run[0]?.actionFlowBranchId ?? "default"}
              className="flex min-h-[var(--journey-action-card-min-h,3.5rem)] w-max max-w-none flex-row flex-nowrap items-center"
            >
              <ul
                className={cn(
                  "relative z-[3] m-0 flex list-none flex-row flex-nowrap items-stretch p-0",
                  journeyInlineGapClass
                )}
                style={flowInlineGapStyle}
              >
                {run.map((child) => (
                  <li
                    key={child.id}
                    className="shrink-0"
                    style={{ width: ACTION_CARD_WIDTH_PX }}
                  >
                    <SortableActionCard
                      step={child}
                      index={parentIndex}
                      subIndex={subIndexById.get(child.id) ?? 1}
                      journeyId={journeyId}
                      phaseId={phaseId}
                      parentStepId={parentStepId}
                    />
                  </li>
                ))}
                <li className="flex shrink-0 items-center self-center">
                  <AddSiblingActionButton
                    journeyId={journeyId}
                    phaseId={phaseId}
                    parentStepId={parentStepId}
                    insertAfterStepId={run[run.length - 1]!.id}
                    siblingIndex={subIndexById.get(run[run.length - 1]!.id) ?? run.length}
                  />
                </li>
              </ul>
            </div>
          </SortableContext>
        );
      })}
    </div>
  ) : dragSurfaceActive ? (
    <p className="m3-caption px-2 py-1 text-muted">
      Drop on another action to reorder, or on a step card to move there
    </p>
  ) : null;
}

function AddSiblingActionButton({
  journeyId,
  phaseId,
  parentStepId,
  insertAfterStepId,
  siblingIndex,
}: {
  journeyId: string;
  phaseId: string;
  parentStepId: string;
  insertAfterStepId: string;
  siblingIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      const el = formRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const attachId = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(attachId);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (open) {
    return (
      <form
        ref={formRef}
        data-journey-no-drag
        className="z-20 w-[min(220px,40vw)] shrink-0 rounded-xl border border-dashed border-outline bg-surface-container p-2 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          fd.set("parentStepId", parentStepId);
          fd.set("insertAfterStepId", insertAfterStepId);
          fd.set("lightSave", "1");
          if (!String(fd.get("title")).trim()) {
            fd.set("title", String(fd.get("userAction") || "User action"));
          }
          start(async () => {
            await saveStep(phaseId, journeyId, fd);
            form.reset();
            setOpen(false);
            router.refresh();
          });
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
          Sibling action
        </p>
        <input
          name="userAction"
          required
          autoFocus
          placeholder="Verb-led action"
          className="m3-field mb-2 w-full text-sm"
          disabled={pending}
        />
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      data-journey-no-drag
      title={`Add sibling after action ${siblingIndex}`}
      aria-label={`Add sibling user action after action ${siblingIndex}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-dashed border-outline bg-surface text-brand shadow-sm hover:border-brand hover:bg-brand/5"
    >
      <Plus className="h-4 w-4 pointer-events-none" />
    </button>
  );
}

function SortableActionCard({
  step,
  index,
  subIndex,
  journeyId,
  phaseId,
  parentStepId,
}: {
  step: FlowStep;
  index: number;
  subIndex: number;
  journeyId: string;
  phaseId: string;
  parentStepId: string;
}) {
  const canvasScale = useJourneyCanvasScale();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: step.id,
    data: { type: "action", parentStepId },
  });

  const boundListeners = useMemo(() => wrapPointerListener(listeners), [listeners]);

  const style = sortableItemStyle(
    transform,
    transition,
    canvasScale,
    isDragging,
    ACTION_CARD_WIDTH_PX
  );

  const dragStyle = isDragging
    ? {
        ...style,
        opacity: 0.5,
        pointerEvents: "none" as const,
      }
    : style;

  const bindRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef]
  );

  return (
    <div
      ref={bindRef}
      style={{ ...dragStyle, touchAction: "none" }}
      data-journey-sortable="action"
      data-journey-action-parent={parentStepId}
      data-journey-dragging={isDragging ? "true" : undefined}
      className={cn("select-none rounded-xl", isDragging ? "cursor-grabbing" : "cursor-grab")}
      {...attributes}
      {...boundListeners}
    >
      <StepNode
        step={step}
        index={index}
        subIndex={subIndex}
        journeyId={journeyId}
        phaseId={phaseId}
        variant="action"
      />
    </div>
  );
}

function AddStepColumn({ journeyId, phaseId }: { journeyId: string; phaseId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const addFormRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!addOpen) return;
    const close = () => setAddOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      const el = addFormRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const attachId = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(attachId);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addOpen]);

  return (
    <div
      className="relative shrink-0"
      data-journey-no-drag
      aria-label="Add step to flow"
    >
      {!addOpen ? (
        <button
          type="button"
          data-journey-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setAddOpen(true);
          }}
          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-outline bg-surface-container text-brand hover:border-brand hover:bg-brand-container pointer-events-auto"
          title="Add step to flow"
          aria-label="Add step to flow"
        >
          <Plus className="pointer-events-none h-4 w-4" />
        </button>
      ) : (
        <>
          <div className="h-10 w-10 shrink-0" aria-hidden />
          <form
            ref={addFormRef}
            data-journey-no-drag
            className="absolute left-full top-1/2 z-30 ml-3 w-[min(300px,85vw)] -translate-y-1/2 rounded-xl border border-dashed border-outline bg-surface-container p-3 shadow-lg space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            fd.set("lightSave", "1");
            start(async () => {
              await saveStep(phaseId, journeyId, fd);
              form.reset();
              setAddOpen(false);
              router.refresh();
            });
          }}
        >
          <p className="m3-caption font-semibold text-brand px-0.5">New step</p>
          <input
            name="title"
            required
            autoFocus
            placeholder="Step title"
            className="m3-field w-full"
            disabled={pending}
          />
          <input
            name="userAction"
            placeholder="User action (verb-led)"
            className="m3-field w-full"
            disabled={pending}
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="m3-btn-filled flex-1 disabled:opacity-50">
              Add step
            </button>
            <button
              type="button"
              className="m3-btn-text text-muted"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
        </>
      )}
    </div>
  );
}