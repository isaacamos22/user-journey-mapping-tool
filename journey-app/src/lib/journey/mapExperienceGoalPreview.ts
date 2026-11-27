/** Workshop goals are often merged with " · " — show one concise lead on the map. */
const GOAL_PREVIEW_MAX_CHARS = 160;

export function previewExperienceGoal(full: string): string {
  const raw = full.trim();
  if (!raw) return "";
  const parts = raw.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  const lead = parts[0] ?? raw;
  if (lead.length <= GOAL_PREVIEW_MAX_CHARS) return lead;
  return `${lead.slice(0, GOAL_PREVIEW_MAX_CHARS - 1)}…`;
}

export function experienceGoalHasMore(full: string): boolean {
  const raw = full.trim();
  if (!raw) return false;
  const parts = raw.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return true;
  const lead = parts[0] ?? raw;
  return lead.length > GOAL_PREVIEW_MAX_CHARS;
}

export const MAP_GOAL_PREVIEW_MAX_CHARS = GOAL_PREVIEW_MAX_CHARS;