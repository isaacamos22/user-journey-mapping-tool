/** Vertical / structural spacing on the journey canvas (lanes, step→tree, step columns). */
export const JOURNEY_FLOW_STACK_GAP_PX = 28;
/** Gap between stacked action summary cards under the same step (compact / overview). */
export const JOURNEY_MAP_ACTION_STACK_RUN_GAP_PX = 14;
/** Uniform gap between map cards (step→action, lane→lane, step→step in a column). */
export const JOURNEY_MAP_CARD_GAP_PX = 36;
/** @deprecated Use JOURNEY_MAP_CARD_GAP_PX */
export const JOURNEY_ROOT_TO_ACTION_GAP_PX = JOURNEY_MAP_CARD_GAP_PX;
/** Horizontal gap between sibling action cards in one lane. */
export const JOURNEY_MAP_ACTION_H_GAP_PX = 44;
/** Horizontal gap between sibling action cards (workspace / legacy). */
export const JOURNEY_FLOW_INLINE_GAP_PX = 12;

/** Map node content width (must match `.journey-canvas` node CSS). */
export const JOURNEY_MAP_NODE_WIDTH_PX = 304;

export const STEP_COLUMN_WIDTH_PX = 300;
export const ACTION_CARD_WIDTH_PX = STEP_COLUMN_WIDTH_PX;
export const SIBLING_ADD_BUTTON_PX = 44;
/** Stack gap + add-step control (h-10) beside the last step card */
export const ADD_STEP_TRAIL_PX = JOURNEY_FLOW_STACK_GAP_PX + 40;