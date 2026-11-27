"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MapFacilitatorEngagementRail,
  MapFacilitatorNotesPanel,
} from "@/components/journey/MapFacilitatorNotesPanel";
import { useMapFacilitatorEngagement } from "@/components/journey/useMapFacilitatorEngagement";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";
import { engagementKeyForAction } from "@/lib/journey/mapEngagementKeys";

export function MapActionEngagementToolbar({
  stepId,
  journeyId,
  engagement,
  onEngagementChange,
  children,
}: {
  stepId: string;
  journeyId?: string;
  engagement?: MapEngagement;
  onEngagementChange?: (next: MapEngagement) => void;
  children: React.ReactNode;
}) {
  const itemId = engagementKeyForAction(stepId);
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const closeNotes = useCallback(() => {
    setCommentOpen(false);
    setEditingId(null);
    setDraft("");
  }, []);

  useEffect(() => {
    if (!commentOpen && !editingId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      closeNotes();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNotes();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [commentOpen, editingId, closeNotes]);

  const fac = useMapFacilitatorEngagement({
    itemId,
    journeyId,
    engagement,
    onEngagementChange,
  });

  const pinRail = commentOpen;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "journey-map-action-engage group/action-engage relative",
        pinRail && "journey-map-action-engage--pinned",
        fac.hearted && "journey-map-node--hearted"
      )}
    >
      {children}
      {fac.hearted && !commentOpen ? (
        <span className="journey-map-action-engage__heart-pin" aria-hidden>
          <Heart className="h-3.5 w-3.5 fill-current text-red-600" />
        </span>
      ) : null}
      <MapFacilitatorEngagementRail
        hearted={fac.hearted}
        pending={fac.pending}
        commentOpen={commentOpen}
        commentsCount={fac.comments.length}
        canEngage={fac.canEngage}
        onHeart={fac.onHeart}
        onToggleNotes={() => setCommentOpen((v) => !v)}
        toolbarLabel="User action"
      />
      <MapFacilitatorNotesPanel
        comments={fac.comments}
        commentOpen={commentOpen}
        canEngage={fac.canEngage}
        pending={fac.pending}
        editingId={editingId}
        setEditingId={setEditingId}
        draft={draft}
        setDraft={setDraft}
        onSaveNew={() => {
          if (!draft.trim()) return;
          fac.saveNewComment(draft.trim());
          setDraft("");
        }}
        onSaveEdit={(commentId) => {
          if (!draft.trim()) return;
          fac.saveEdit(commentId, draft.trim());
          setEditingId(null);
          setDraft("");
        }}
        onRemove={fac.removeComment}
      />
      {fac.comments.length > 0 && !commentOpen ? (
        <p className="mt-1 hidden text-[10px] text-muted group-hover/action-engage:block">
          {fac.comments.length} facilitator note{fac.comments.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}