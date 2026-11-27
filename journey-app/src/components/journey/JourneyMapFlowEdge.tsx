"use client";

import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from "reactflow";
import {
  buildMapFlowEdgePath,
  MAP_EDGE_BUNDLE_GAP_PX,
  MAP_EDGE_CORNER_RADIUS_PX,
  MAP_EDGE_PHASE_CORNER_RADIUS_PX,
  padFlowHandle,
  type MapFlowEdgeRoute,
} from "@/lib/journey/mapFlowEdgeGeometry";

function bundleOffsetPx(index: number, count: number): number {
  if (count <= 1) return 0;
  return (index - (count - 1) / 2) * MAP_EDGE_BUNDLE_GAP_PX;
}

export type JourneyMapFlowEdgeData = {
  route?: MapFlowEdgeRoute;
  bundleIndex?: number;
  bundleCount?: number;
  busY?: number;
  mergeJoinX?: number;
  sourcePosition?: Position;
  targetPosition?: Position;
};

/** Dagre layout + smooth-step / org-chart routing (React Flow standard pattern). */
export function JourneyMapFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  interactionWidth,
}: EdgeProps<JourneyMapFlowEdgeData>) {
  const route = data?.route ?? "flow";
  const bundleIndex = data?.bundleIndex ?? 0;
  const bundleCount = data?.bundleCount ?? 1;
  const srcPos = data?.sourcePosition ?? sourcePosition ?? Position.Right;
  const tgtPos = data?.targetPosition ?? targetPosition ?? Position.Left;

  const isHorizontalLR =
    (srcPos === Position.Right && tgtPos === Position.Left) ||
    (srcPos === Position.Left && tgtPos === Position.Right);

  const useStraightHorizontal =
    isHorizontalLR &&
    (route === "chain" ||
      (route === "flow" && Math.abs(sourceY - targetY) < 32));

  let path: string;
  if (route === "merge") {
    path = buildMapFlowEdgePath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: srcPos,
      targetPosition: tgtPos,
      route: "merge",
      bundleIndex,
      bundleCount,
      mergeJoinX: data?.mergeJoinX,
    });
  } else if (route === "nest") {
    path = buildMapFlowEdgePath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      route: "nest",
      bundleIndex,
      bundleCount,
      busY: data?.busY,
    });
  } else if (useStraightHorizontal) {
    const y = (sourceY + targetY) / 2;
    path = `M ${sourceX} ${y} L ${targetX} ${y}`;
  } else {
    const src = padFlowHandle(sourceX, sourceY, srcPos);
    const tgt = padFlowHandle(targetX, targetY, tgtPos);
    const radius =
      route === "phase" ? MAP_EDGE_PHASE_CORNER_RADIUS_PX : MAP_EDGE_CORNER_RADIUS_PX;
    [path] = getSmoothStepPath({
      sourceX: src.x,
      sourceY: src.y,
      targetX: tgt.x,
      targetY: tgt.y,
      sourcePosition: srcPos,
      targetPosition: tgtPos,
      borderRadius: radius,
      offset: bundleOffsetPx(bundleIndex, bundleCount),
    });
  }

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      interactionWidth={interactionWidth ?? 14}
    />
  );
}