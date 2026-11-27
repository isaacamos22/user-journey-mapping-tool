"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MapFacilitatorEngagementRail,
  MapFacilitatorNotesPanel,
} from "@/components/journey/MapFacilitatorNotesPanel";
import { useMapFacilitatorEngagement } from "@/components/journey/useMapFacilitatorEngagement";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";

export type MapFrictionBullet = {
  id: string;
  description: string;
  hearted?: boolean;
};

const wrapText = "min-w-0 max-w-full whitespace-normal break-words";

export function MapFrictionBulletList({
  bullets,
  journeyId,
  stepId,
  engagement,
  onEngagementChange,
  highlightText,
  onPickItem,
  bodyForItem,
  toolbarLabel = "Friction actions",
  className,
}: {
  bullets: MapFrictionBullet[];
  journeyId?: string;
  stepId?: string;
  engagement?: MapEngagement;
  onEngagementChange?: (next: MapEngagement) => void;
  highlightText?: string | null;
  onPickItem?: (text: string) => void;
  bodyForItem?: (text: string, emphasized: boolean) => ReactNode;
  toolbarLabel?: string;
  className?: string;
}) {
  if (!bullets.length) return null;

  return (
    <ul className={cn("journey-map-bullet-list journey-map-body", wrapText, className)}>
      {bullets.map((bullet, index) => (
        <MapFrictionBulletRow
          key={bullet.id || `${stepId ?? "step"}-friction-${index}-${bullet.description.slice(0, 24)}`}
          bullet={bullet}
          journeyId={journeyId}
          engagement={engagement}
          onEngagementChange={onEngagementChange}
          highlightText={highlightText}
          onPickItem={onPickItem}
          bodyForItem={bodyForItem}
          toolbarLabel={toolbarLabel}
        />
      ))}
    </ul>
  );
}

function MapFrictionBulletRow({
  bullet,
  journeyId,
  engagement,
  onEngagementChange,
  highlightText,
  onPickItem,
  bodyForItem,
  toolbarLabel,
}: {
  bullet: MapFrictionBullet;
  journeyId?: string;
  engagement?: MapEngagement;
  onEngagementChange?: (next: MapEngagement) => void;
  highlightText?: string | null;
  onPickItem?: (text: string) => void;
  bodyForItem?: (text: string, emphasized: boolean) => ReactNode;
  toolbarLabel: string;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);

  const closeNotes = useCallback(() => {
    setCommentOpen(false);
    setEditingId(null);
    setDraft("");
  }, []);

  useEffect(() => {
    if (!commentOpen && !editingId) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rowRef.current?.contains(e.target as Node)) return;
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
    itemId: bullet.id,
    journeyId,
    engagement,
    onEngagementChange,
  });

  const hearted = Boolean(fac.hearted || bullet.hearted);

  const emphasized =
    highlightText &&
    bullet.description.toLowerCase().includes(highlightText.toLowerCase().slice(0, 20));

  const textBody =
    bodyForItem?.(bullet.description, Boolean(emphasized)) ??
    bullet.description;

  const showPinnedRail = fac.canEngage && commentOpen;

  return (
    <li
      ref={rowRef}
      className={cn(
        "journey-map-bullet-item group/bullet",
        showPinnedRail && "journey-map-bullet-item--rail-visible",
        hearted && "journey-map-bullet-item--hearted"
      )}
    >
      <div
        className={cn(
          "journey-map-bullet-item__shell",
          fac.canEngage && "journey-map-bullet-item__shell--engage"
        )}
      >
        <div className="journey-map-bullet-item__body min-w-0">
          {onPickItem ? (
            <button
              type="button"
              className="nopan nodrag nowheel w-full cursor-pointer rounded-md px-0.5 text-left transition-colors hover:bg-black/5"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onPickItem(bullet.description);
              }}
            >
              {textBody}
            </button>
          ) : (
            <span className="block px-0.5">{textBody}</span>
          )}
        </div>
        {fac.canEngage ? (
          <div className="journey-map-bullet-item__rail">
            {hearted ? (
              <span className="journey-map-bullet-item__heart-pin" aria-hidden>
                <Heart className="h-3.5 w-3.5 fill-current" />
              </span>
            ) : null}
            {fac.comments.length > 0 && !commentOpen ? (
              <span
                className="journey-map-bullet-item__notes-pin"
                title={`${fac.comments.length} facilitator note(s)`}
              >
                <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
                <span className="tabular-nums">{fac.comments.length}</span>
              </span>
            ) : null}
            <MapFacilitatorEngagementRail
              hearted={hearted}
              pending={fac.pending}
              commentOpen={commentOpen}
              commentsCount={fac.comments.length}
              canEngage={fac.canEngage}
              onHeart={fac.onHeart}
              onToggleNotes={() => setCommentOpen((v) => !v)}
              toolbarLabel={toolbarLabel}
            />
          </div>
        ) : null}
      </div>
      {commentOpen ? (
        <div className="journey-map-bullet-item__notes">
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
        </div>
      ) : null}
    </li>
  );
}