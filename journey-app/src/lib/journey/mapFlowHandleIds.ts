import { Position } from "reactflow";

export function sourceFlowHandleId(position: Position): string {
  switch (position) {
    case Position.Right:
      return "flow-out";
    case Position.Bottom:
      return "flow-out-bottom";
    case Position.Left:
      return "flow-out-left";
    case Position.Top:
      return "flow-out-top";
    default:
      return "flow-out";
  }
}

export function targetFlowHandleId(position: Position): string {
  switch (position) {
    case Position.Left:
      return "flow-in";
    case Position.Top:
      return "flow-in-top";
    case Position.Right:
      return "flow-in-right";
    case Position.Bottom:
      return "flow-in-bottom";
    default:
      return "flow-in";
  }
}