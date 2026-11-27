import { prisma } from "@/lib/db";
import { engagementKeyForAction } from "@/lib/journey/mapEngagementKeys";
import {
  emptyMapEngagement,
  type MapEngagement,
  type MapPainComment,
  type MapPainEngagement,
} from "@/lib/journey/mapEngagementTypes";

export type { MapEngagement, MapPainComment, MapPainEngagement };
export { emptyMapEngagement };

function engagementKeyForAnchor(stepId: string, kind: string, labelKey: string): string {
  if (kind === "action") return engagementKeyForAction(stepId);
  return `opportunity:${stepId}:${labelKey}`;
}

/** Raw SQL so map works even when the dev server holds a stale Prisma client after migrate. */
export async function loadMapPainEngagement(journeyId: string): Promise<MapEngagement> {
  const base = emptyMapEngagement();

  const painRows = await prisma.$queryRaw<Array<{ id: string; facilitatorHeart: number }>>`
    SELECT p.id, p.facilitatorHeart
    FROM PainPoint p
    INNER JOIN Step s ON p.stepId = s.id
    INNER JOIN Phase ph ON s.phaseId = ph.id
    WHERE ph.journeyId = ${journeyId}
  `;

  const commentRows = await prisma.$queryRaw<
    Array<{
      id: string;
      body: string;
      authorId: string;
      painPointId: string | null;
      facilitatorAnchorId: string | null;
    }>
  >`
    SELECT id, body, authorId, painPointId, facilitatorAnchorId
    FROM Comment
    WHERE journeyId = ${journeyId}
      AND (painPointId IS NOT NULL OR facilitatorAnchorId IS NOT NULL)
    ORDER BY createdAt ASC
  `;

  for (const p of painRows) {
    if (p.facilitatorHeart) base.heartedByPainId[p.id] = true;
  }

  for (const c of commentRows) {
    if (c.painPointId) {
      const list = base.commentsByPainId[c.painPointId] ?? [];
      list.push({ id: c.id, body: c.body, authorId: c.authorId });
      base.commentsByPainId[c.painPointId] = list;
    }
  }

  try {
    const anchorsWithId = await prisma.$queryRaw<
      Array<{ id: string; stepId: string; kind: string; labelKey: string; facilitatorHeart: number }>
    >`
      SELECT id, stepId, kind, labelKey, facilitatorHeart
      FROM MapFacilitatorAnchor
      WHERE journeyId = ${journeyId}
    `;
    const anchorIdToKey = new Map<string, string>();
    for (const a of anchorsWithId) {
      const key = engagementKeyForAnchor(a.stepId, a.kind, a.labelKey ?? "");
      anchorIdToKey.set(a.id, key);
      if (a.facilitatorHeart) base.heartedByKey[key] = true;
    }

    for (const c of commentRows) {
      if (!c.facilitatorAnchorId) continue;
      const key = anchorIdToKey.get(c.facilitatorAnchorId);
      if (!key) continue;
      const list = base.commentsByKey[key] ?? [];
      list.push({ id: c.id, body: c.body, authorId: c.authorId });
      base.commentsByKey[key] = list;
    }
  } catch {
    /* MapFacilitatorAnchor missing until migrate */
  }

  return base;
}