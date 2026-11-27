/** Client-safe map facilitator engagement types (no Prisma). */

export type MapPainComment = { id: string; body: string; authorId: string };

export type MapEngagement = {
  heartedByPainId: Record<string, boolean>;
  commentsByPainId: Record<string, MapPainComment[]>;
  heartedByKey: Record<string, boolean>;
  commentsByKey: Record<string, MapPainComment[]>;
};

/** @deprecated Use MapEngagement */
export type MapPainEngagement = MapEngagement;

export const emptyMapEngagement = (): MapEngagement => ({
  heartedByPainId: {},
  commentsByPainId: {},
  heartedByKey: {},
  commentsByKey: {},
});