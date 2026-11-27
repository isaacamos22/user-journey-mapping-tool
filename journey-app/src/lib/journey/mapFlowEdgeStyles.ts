import type { CSSProperties } from "react";

export const MAP_FLOW_EDGE_DASH = "8 6";

export type MapFlowEdgeVisual = "primary" | "alternate" | "muted";

export function mapFlowEdgeStyle(visual: MapFlowEdgeVisual): CSSProperties {
  if (visual === "alternate") {
    return {
      stroke: "#8e8e93",
      strokeWidth: 1.5,
      strokeDasharray: MAP_FLOW_EDGE_DASH,
      opacity: 0.88,
    };
  }
  if (visual === "muted") {
    return {
      stroke: "#aeaeb2",
      strokeWidth: 1.2,
      strokeDasharray: "6 5",
      opacity: 0.82,
    };
  }
  return {
    stroke: "#0014dc",
    strokeWidth: 1.65,
    strokeDasharray: MAP_FLOW_EDGE_DASH,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    opacity: 0.92,
  };
}