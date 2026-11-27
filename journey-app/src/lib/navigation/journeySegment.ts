const JOURNEY_SECTIONS = new Set(["map", "workspace", "summary", "synthesis", "export", "share"]);

/** Sections that render the read-only map canvas (legacy workspace URLs included). */
const MAP_SECTIONS = new Set(["map", "workspace", "export", "summary"]);

/** Last journey section from `/journeys/:id/:section` (defaults to map). */
export function journeySectionFromPathname(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "home";
  const last = parts[parts.length - 1]!;
  if (last === "prefill" || last === "workshop") return "map";
  if (JOURNEY_SECTIONS.has(last)) return last;
  if (parts[0] === "journeys" && parts.length === 2) return "map";
  return last;
}

export function isJourneyMapPath(pathname: string): boolean {
  return MAP_SECTIONS.has(journeySectionFromPathname(pathname));
}

/** True only when the React Flow map canvas is mounted (not summary/export). */
export function isJourneyMapCanvasPath(pathname: string): boolean {
  const section = journeySectionFromPathname(pathname);
  return section === "map" || section === "workspace";
}

/** @deprecated Use isJourneyMapPath */
export function isJourneyWorkspacePath(pathname: string): boolean {
  return isJourneyMapPath(pathname);
}

export function isJourneySummaryPath(pathname: string): boolean {
  return journeySectionFromPathname(pathname) === "summary";
}

export function isJourneyDiscoveryPath(pathname: string): boolean {
  return journeySectionFromPathname(pathname) === "synthesis";
}

/** Map + discovery workbench (single `/map` experience). */
export function isJourneyUnifiedWorkbenchPath(pathname: string): boolean {
  const section = journeySectionFromPathname(pathname);
  return section === "map" || section === "workspace" || section === "synthesis";
}