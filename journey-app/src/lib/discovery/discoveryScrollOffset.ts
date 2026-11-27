/** Pixels to leave below the sticky sheet header when jumping to an anchored section. */
export function resolveDiscoveryScrollOffset(
  sheet: Element | null,
  header: Element | null
): number {
  if (sheet instanceof HTMLElement) {
    const px = parseFloat(sheet.style.getPropertyValue("--discovery-scroll-offset-px"));
    if (Number.isFinite(px) && px > 0) return px;
    const headerPx = parseFloat(sheet.style.getPropertyValue("--discovery-sheet-header-px"));
    if (Number.isFinite(headerPx) && headerPx > 0) return headerPx + 23;
  }
  if (header instanceof HTMLElement) return header.offsetHeight + 23;
  return 83;
}