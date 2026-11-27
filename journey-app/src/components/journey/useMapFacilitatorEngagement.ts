"use client";

import { useCallback, useTransition } from "react";
import {
  addFacilitatorAnchorComment,
  deleteFacilitatorAnchorComment,
  toggleFacilitatorAnchorHeart,
  updateFacilitatorAnchorComment,
} from "@/lib/actions/mapAnchorEngagement";
import {
  addPainPointComment,
  deletePainPointComment,
  togglePainPointHeart,
  updatePainPointComment,
} from "@/lib/actions/mapPainEngagement";
import type { MapEngagement, MapPainComment } from "@/lib/journey/mapEngagementTypes";
import { isAnchorEngagementKey, parseEngagementKey } from "@/lib/journey/mapEngagementKeys";

export function useMapFacilitatorEngagement({
  itemId,
  journeyId,
  engagement,
  onEngagementChange,
}: {
  itemId: string;
  journeyId?: string;
  engagement?: MapEngagement;
  onEngagementChange?: (next: MapEngagement) => void;
}) {
  const [pending, start] = useTransition();
  const isAnchor = isAnchorEngagementKey(itemId);

  const hearted = isAnchor
    ? (engagement?.heartedByKey[itemId] ?? false)
    : (engagement?.heartedByPainId[itemId] ?? false);

  const comments: MapPainComment[] = isAnchor
    ? (engagement?.commentsByKey[itemId] ?? [])
    : (engagement?.commentsByPainId[itemId] ?? []);

  const canEngage = Boolean(journeyId && engagement && onEngagementChange);

  const patchEngagement = useCallback(
    (patch: Partial<MapEngagement>) => {
      if (!engagement || !onEngagementChange) return;
      onEngagementChange({
        heartedByPainId: { ...engagement.heartedByPainId, ...(patch.heartedByPainId ?? {}) },
        commentsByPainId: { ...engagement.commentsByPainId, ...(patch.commentsByPainId ?? {}) },
        heartedByKey: { ...engagement.heartedByKey, ...(patch.heartedByKey ?? {}) },
        commentsByKey: { ...engagement.commentsByKey, ...(patch.commentsByKey ?? {}) },
      });
    },
    [engagement, onEngagementChange]
  );

  const onHeart = () => {
    if (!journeyId || !canEngage) return;
    const next = !hearted;
    if (isAnchor) {
      const parsed = parseEngagementKey(itemId);
      if (!parsed) return;
      patchEngagement({ heartedByKey: { [itemId]: next } });
      start(async () => {
        await toggleFacilitatorAnchorHeart(
          journeyId,
          parsed.stepId,
          parsed.kind,
          parsed.labelKey,
          next
        );
      });
    } else {
      patchEngagement({ heartedByPainId: { [itemId]: next } });
      start(async () => {
        await togglePainPointHeart(journeyId, itemId, next);
      });
    }
  };

  const saveNewComment = (body: string) => {
    if (!journeyId) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: MapPainComment = { id: tempId, body, authorId: "" };
    if (isAnchor) {
      patchEngagement({ commentsByKey: { [itemId]: [...comments, optimistic] } });
      const parsed = parseEngagementKey(itemId);
      if (!parsed) return;
      start(async () => {
        await addFacilitatorAnchorComment(
          journeyId,
          parsed.stepId,
          parsed.kind,
          parsed.labelKey,
          body
        );
      });
    } else {
      patchEngagement({ commentsByPainId: { [itemId]: [...comments, optimistic] } });
      start(async () => {
        await addPainPointComment(journeyId, itemId, body);
      });
    }
  };

  const saveEdit = (commentId: string, body: string) => {
    if (!journeyId) return;
    if (isAnchor) {
      patchEngagement({
        commentsByKey: {
          [itemId]: comments.map((c) => (c.id === commentId ? { ...c, body } : c)),
        },
      });
      start(async () => {
        if (!commentId.startsWith("temp-")) {
          await updateFacilitatorAnchorComment(journeyId, commentId, body);
        }
      });
    } else {
      patchEngagement({
        commentsByPainId: {
          [itemId]: comments.map((c) => (c.id === commentId ? { ...c, body } : c)),
        },
      });
      start(async () => {
        if (!commentId.startsWith("temp-")) {
          await updatePainPointComment(journeyId, commentId, body);
        }
      });
    }
  };

  const removeComment = (commentId: string) => {
    if (!journeyId) return;
    if (isAnchor) {
      patchEngagement({
        commentsByKey: { [itemId]: comments.filter((c) => c.id !== commentId) },
      });
      start(async () => {
        if (!commentId.startsWith("temp-")) {
          await deleteFacilitatorAnchorComment(journeyId, commentId);
        }
      });
    } else {
      patchEngagement({
        commentsByPainId: { [itemId]: comments.filter((c) => c.id !== commentId) },
      });
      start(async () => {
        if (!commentId.startsWith("temp-")) {
          await deletePainPointComment(journeyId, commentId);
        }
      });
    }
  };

  return {
    pending,
    hearted,
    comments,
    canEngage,
    onHeart,
    saveNewComment,
    saveEdit,
    removeComment,
  };
}