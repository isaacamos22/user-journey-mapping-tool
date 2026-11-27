/** Deterministic key from full bullet text (avoids collisions on long similar stickies). */
export function stableTextKey(text: string): string {
  const n = text.trim();
  let h = 5381;
  for (let i = 0; i < n.length; i++) {
    h = (h * 33) ^ n.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Stable slug for opportunity bullet text (matches discovery scope ids). */
export function opportunityLabelKey(text: string): string {
  return stableTextKey(text);
}

/** Pre-hash anchor ids (still used in DB for older journeys). */
export function legacyOpportunityLabelKey(text: string): string {
  return text.trim().slice(0, 40).replace(/\s+/g, "-").toLowerCase();
}

export function engagementKeysForOpportunityLookup(stepId: string, text: string): string[] {
  const keys = [
    engagementKeyForOpportunity(stepId, text),
    `opportunity:${stepId}:${legacyOpportunityLabelKey(text)}`,
  ];
  return [...new Set(keys)];
}

export function engagementKeyForOpportunity(stepId: string, text: string): string {
  return `opportunity:${stepId}:${opportunityLabelKey(text)}`;
}

export function engagementKeyForAction(stepId: string): string {
  return `action:${stepId}:`;
}

export function parseEngagementKey(
  key: string
): { kind: "opportunity" | "action"; stepId: string; labelKey: string } | null {
  if (key.startsWith("opportunity:")) {
    const rest = key.slice("opportunity:".length);
    const sep = rest.indexOf(":");
    if (sep < 0) return null;
    return {
      kind: "opportunity",
      stepId: rest.slice(0, sep),
      labelKey: rest.slice(sep + 1),
    };
  }
  if (key.startsWith("action:")) {
    const rest = key.slice("action:".length);
    const sep = rest.indexOf(":");
    if (sep < 0) return null;
    return {
      kind: "action",
      stepId: rest.slice(0, sep),
      labelKey: rest.slice(sep + 1),
    };
  }
  return null;
}

export function isAnchorEngagementKey(bulletId: string): boolean {
  return bulletId.startsWith("opportunity:") || bulletId.startsWith("action:");
}