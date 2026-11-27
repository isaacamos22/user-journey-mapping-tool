import { Position } from "reactflow";

export type MapNodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function center(r: MapNodeRect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Pick handle sides from relative card placement (common diagram-tool behaviour). */
export function resolveFlowHandlePositions(
  source: MapNodeRect,
  target: MapNodeRect
): { sourcePosition: Position; targetPosition: Position } {
  const sc = center(source);
  const tc = center(target);
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;

  const horizontal =
    Math.abs(dx) >= Math.abs(dy) * 0.72 ||
    (Math.abs(dy) < 32 && Math.abs(dx) > 40);

  if (horizontal) {
    return dx >= 0
      ? { sourcePosition: Position.Right, targetPosition: Position.Left }
      : { sourcePosition: Position.Left, targetPosition: Position.Right };
  }

  return dy >= 0
    ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
    : { sourcePosition: Position.Top, targetPosition: Position.Bottom };
}

export function resolveNestHandlePositions(
  source: MapNodeRect,
  target: MapNodeRect
): { sourcePosition: Position; targetPosition: Position } {
  const sc = center(source);
  const tc = center(target);
  if (Math.abs(tc.x - sc.x) > source.width * 0.35) {
    return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
  }
  return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
}