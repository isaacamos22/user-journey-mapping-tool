"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { useReactFlow, type Node } from "reactflow";
import {
  isMapActionStackNodeId,
  tierRank,
  type MapDetailLevel,
  type MapTierTransition,
} from "@/lib/journey/mapDetailLevel";
import {
  pickMapNodeAtFlow,
  resolveMapAnchorNodeId,
} from "@/lib/journey/mapViewportFit";

const STICKY_MS = 120;

type StickyAnchor = {
  screenX: number;
  screenY: number;
  offsetFx: number;
  offsetFy: number;
  preferredId: string;
  captureFlowX: number;
  captureFlowY: number;
};

function captureAnchorHit(
  snapshot: Node[],
  flowX: number,
  flowY: number
): { preferredId: string; anchorX: number; anchorY: number } | null {
  const hit = pickMapNodeAtFlow(snapshot, flowX, flowY);
  if (!hit) return null;

  if (isMapActionStackNodeId(hit.id)) {
    const parentId = (hit.data as { parentStepId?: string })?.parentStepId;
    if (parentId) {
      const root = snapshot.find((n) => n.id === parentId);
      if (root) {
        return {
          preferredId: parentId,
          anchorX: root.position.x,
          anchorY: root.position.y,
        };
      }
    }
  }

  return {
    preferredId: hit.id,
    anchorX: hit.position.x,
    anchorY: hit.position.y,
  };
}

/**
 * Keeps the wheel target under the cursor when LOD unfolds (layout relayout + height remeasure).
 */
export function useMapWheelDestinationAnchor(
  canvasRef: RefObject<HTMLElement | null>,
  layoutDetailLevel: MapDetailLevel,
  nodes: Node[],
  tierTransition: MapTierTransition
) {
  const { getViewport, setViewport, screenToFlowPosition } = useReactFlow();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const stickyRef = useRef<StickyAnchor | null>(null);
  const stickyUntilRef = useRef(0);
  const layoutLevelRef = useRef(layoutDetailLevel);
  const expandingRef = useRef(false);
  const tierTransitionRef = useRef(tierTransition);
  tierTransitionRef.current = tierTransition;

  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };

    root.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => root.removeEventListener("wheel", onWheel, { capture: true });
  }, [canvasRef]);

  const applySticky = useCallback(
    (anchor: StickyAnchor, nodeList: Node[], trackLivePointer = false) => {
      const pane = canvasRef.current?.querySelector(".react-flow__pane") as HTMLElement | null;
      if (!pane) return;

      const rect = pane.getBoundingClientRect();
      let screenX = anchor.screenX;
      let screenY = anchor.screenY;
      if (trackLivePointer && pointerRef.current) {
        screenX = pointerRef.current.x - rect.left;
        screenY = pointerRef.current.y - rect.top;
      }

      const { zoom } = getViewport();
      let flowX = anchor.captureFlowX;
      let flowY = anchor.captureFlowY;

      if (anchor.preferredId) {
        const targetId = resolveMapAnchorNodeId(anchor.preferredId, nodeList);
        const node = targetId ? nodeList.find((n) => n.id === targetId) : undefined;
        if (node) {
          flowX = node.position.x + anchor.offsetFx;
          flowY = node.position.y + anchor.offsetFy;
        }
      }

      setViewport(
        {
          x: screenX - flowX * zoom,
          y: screenY - flowY * zoom,
          zoom,
        },
        { duration: 0 }
      );
    },
    [canvasRef, getViewport, setViewport]
  );

  useLayoutEffect(() => {
    const prev = layoutLevelRef.current;
    if (prev === layoutDetailLevel) return;

    const prevRank = tierRank(prev);
    const nextRank = tierRank(layoutDetailLevel);
    expandingRef.current = nextRank > prevRank;
    layoutLevelRef.current = layoutDetailLevel;

    if (layoutDetailLevel === "overview") {
      stickyRef.current = null;
      stickyUntilRef.current = 0;
      return;
    }

    const pane = canvasRef.current?.querySelector(".react-flow__pane") as HTMLElement | null;
    const snapshot = nodesRef.current;
    if (!pane || snapshot.length === 0) return;

    const rect = pane.getBoundingClientRect();
    const pointer = pointerRef.current;
    if (!pointer) {
      stickyRef.current = null;
      stickyUntilRef.current = 0;
      return;
    }
    const screenX = pointer.x - rect.left;
    const screenY = pointer.y - rect.top;
    const flow = screenToFlowPosition({ x: screenX, y: screenY });

    const hit = captureAnchorHit(snapshot, flow.x, flow.y);
    stickyRef.current = {
      screenX,
      screenY,
      captureFlowX: flow.x,
      captureFlowY: flow.y,
      preferredId: hit?.preferredId ?? "",
      offsetFx: hit ? flow.x - hit.anchorX : 0,
      offsetFy: hit ? flow.y - hit.anchorY : 0,
    };
    stickyUntilRef.current = Date.now() + STICKY_MS;
  }, [layoutDetailLevel, canvasRef, screenToFlowPosition]);

  useEffect(() => {
    if (tierTransition !== "idle") return;
    const anchor = stickyRef.current;
    if (!anchor) return;
    if (Date.now() > stickyUntilRef.current) return;

    const t = window.requestAnimationFrame(() => {
      applySticky(anchor, nodesRef.current, false);
    });
    return () => window.cancelAnimationFrame(t);
  }, [layoutDetailLevel, tierTransition, applySticky]);

  useEffect(() => {
    if (!expandingRef.current) return;
    if (tierTransition !== "idle") return;

    expandingRef.current = false;
    const anchor = stickyRef.current;
    if (!anchor) return;

    const t = window.requestAnimationFrame(() => {
      if (Date.now() > stickyUntilRef.current) return;
      applySticky(anchor, nodesRef.current);
    });

    return () => window.cancelAnimationFrame(t);
  }, [tierTransition, applySticky]);
}