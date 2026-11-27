import type { DropAnimation } from "@dnd-kit/core";

export const JOURNEY_DROP_MS = 280;

/** Shared easing for DnD layout and drop settle. */
export const journeyDropAnimation: DropAnimation = {
  duration: JOURNEY_DROP_MS,
  easing: "cubic-bezier(0.33, 1, 0.68, 1)",
};

export const journeyLayoutTransition =
  "transform 280ms cubic-bezier(0.33, 1, 0.68, 1), opacity 220ms ease";

export const journeyChromeTransition =
  "min-height 320ms cubic-bezier(0.33, 1, 0.68, 1), box-shadow 220ms ease, background-color 220ms ease";