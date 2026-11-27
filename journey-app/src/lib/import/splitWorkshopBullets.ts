const MIN_BULLET_CHARS = 3;

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Merge workshop bullet lists without dropping duplicates across sources (dedupe by exact text). */
export function mergeWorkshopBulletLists(...groups: (string[] | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    if (!g?.length) continue;
    for (const item of g) {
      const t = item.trim();
      if (t.length < MIN_BULLET_CHARS) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function splitDelimiterBullets(t: string, delimiter: RegExp): string[] {
  const parts = t
    .split(delimiter)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_BULLET_CHARS);
  return parts.length >= 2 ? dedupe(parts) : [];
}

function splitSemicolonBullets(t: string): string[] {
  if (!t.includes(";")) return [];
  return splitDelimiterBullets(t, /\s*;\s*/);
}

function splitCommaBullets(t: string): string[] {
  if (!t.includes(",")) return [];
  return splitDelimiterBullets(t, /,(?![^(]*\))/);
}

/** Split workshop pain/opportunity cells into list items for map + discovery (preserve all bullets). */
export function splitWorkshopBullets(raw: string | undefined | null): string[] {
  const t = raw?.trim();
  if (!t) return [];

  const lineItems = t
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter((line) => line.length >= MIN_BULLET_CHARS);
  if (lineItems.length >= 2) return dedupe(lineItems);

  const semi = splitSemicolonBullets(t);
  if (semi.length >= 2) return semi;

  if (t.includes(" · ")) {
    const dot = splitDelimiterBullets(t, /\s*·\s*/);
    if (dot.length >= 2) return dot;
  }

  if (t.includes("|")) {
    const pipe = splitDelimiterBullets(t, /\s*\|\s*/);
    if (pipe.length >= 2) return pipe;
  }

  const comma = splitCommaBullets(t);
  if (comma.length >= 2) return comma;

  return [t];
}

export function resolveFrictionBullets(
  step: { frictions?: string[] },
  pain?: { description: string }
): string[] {
  const explicit = step.frictions?.map((s) => s.trim()).filter(Boolean);
  const fromPain = splitWorkshopBullets(pain?.description);
  return mergeWorkshopBulletLists(explicit, fromPain);
}

export function resolveOpportunityBullets(
  step: { opportunities?: string[]; opportunity?: string },
  pain?: { opportunity?: string }
): string[] {
  const explicit = step.opportunities?.map((s) => s.trim()).filter(Boolean);
  const fromCell = splitWorkshopBullets(step.opportunity);
  const fromPain = splitWorkshopBullets(pain?.opportunity);
  return mergeWorkshopBulletLists(explicit, fromCell, fromPain);
}