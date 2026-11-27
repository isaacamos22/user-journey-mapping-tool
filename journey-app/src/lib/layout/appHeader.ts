/** Default app chrome (home, import, settings). */
export const APP_HEADER_BASE_PX = 56;

/** Journey routes — same single-row height as the base shell header. */
export const APP_HEADER_JOURNEY_PX = 56;

export function journeyHeaderOffsetPx(hasJourneyHeader: boolean) {
  return hasJourneyHeader ? APP_HEADER_JOURNEY_PX : APP_HEADER_BASE_PX;
}