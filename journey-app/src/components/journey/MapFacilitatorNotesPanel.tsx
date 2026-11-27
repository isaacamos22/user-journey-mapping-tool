"use client";

import { useLayoutEffect, useState } from "react";
import { Heart, MessageSquare, Pencil, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapPainComment } from "@/lib/journey/mapEngagementTypes";
import { useMapCanvas } from "@/components/journey/mapCanvasContext";

function CheckIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function MapFacilitatorEngagementRail({
  hearted,
  pending,
  commentOpen,
  commentsCount,
  canEngage,
  onHeart,
  onToggleNotes,
  toolbarLabel,
}: {
  hearted: boolean;
  pending: boolean;
  commentOpen: boolean;
  commentsCount: number;
  canEngage: boolean;
  onHeart: () => void;
  onToggleNotes: () => void;
  toolbarLabel: string;
}) {
  if (!canEngage) return null;
  return (
    <div className={cn("journey-map-bullet-popup", commentOpen && "journey-map-bullet-popup--open")}>
      <div className="journey-map-bullet-popup__rail" role="toolbar" aria-label={toolbarLabel}>
        <button
          type="button"
          className={cn(
            "m3-btn-icon h-7 w-7",
            hearted ? "text-red-600" : "text-muted hover:text-red-600"
          )}
          aria-label={hearted ? "Remove heart" : "Heart"}
          aria-pressed={hearted}
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onHeart();
          }}
        >
          <Heart className={cn("h-3.5 w-3.5", hearted && "fill-current")} aria-hidden />
        </button>
        <button
          type="button"
          className={cn(
            "m3-btn-icon h-7 w-7 text-muted hover:text-foreground",
            (commentOpen || commentsCount > 0) && "text-brand"
          )}
          aria-label="Facilitator notes"
          aria-expanded={commentOpen}
          onClick={(e) => {
            e.stopPropagation();
            onToggleNotes();
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function MapFacilitatorNotesPanel({
  comments,
  commentOpen,
  canEngage,
  pending,
  editingId,
  setEditingId,
  draft,
  setDraft,
  onSaveNew,
  onSaveEdit,
  onRemove,
}: {
  comments: MapPainComment[];
  commentOpen: boolean;
  canEngage: boolean;
  pending: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  draft: string;
  setDraft: (v: string) => void;
  onSaveNew: () => void;
  onSaveEdit: (commentId: string) => void;
  onRemove: (commentId: string) => void;
}) {
  const ctx = useMapCanvas();
  useLayoutEffect(() => {
    if (!commentOpen) return;
    ctx?.requestLayoutRemeasure?.();
  }, [commentOpen, comments.length, ctx?.requestLayoutRemeasure]);

  if (!commentOpen || !canEngage) return null;
  return (
    <div
      className="journey-map-facilitator-notes mt-1.5 space-y-1.5 text-[11px]"
      onClick={(e) => e.stopPropagation()}
    >
      {comments.map((c) => (
        <div key={c.id} className="group/comment flex gap-1 pl-0.5">
          {editingId === c.id ? (
            <textarea
              className="journey-map-facilitator-notes-field min-h-[2.5rem] w-full resize-y text-[11px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <p className="min-w-0 flex-1 leading-snug text-foreground/90 italic">{c.body}</p>
          )}
          <div className="flex shrink-0 gap-0.5 opacity-0 group-hover/comment:opacity-100">
            {editingId === c.id ? (
              <>
                <button
                  type="button"
                  className="m3-btn-icon h-6 w-6"
                  aria-label="Save"
                  onClick={() => onSaveEdit(c.id)}
                >
                  <CheckIcon />
                </button>
                <button
                  type="button"
                  className="m3-btn-icon h-6 w-6"
                  onClick={() => {
                    setEditingId(null);
                    setDraft("");
                  }}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="m3-btn-icon h-6 w-6"
                  aria-label="Edit comment"
                  onClick={() => {
                    setEditingId(c.id);
                    setDraft(c.body);
                  }}
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  className="m3-btn-icon h-6 w-6 text-red-700"
                  aria-label="Delete comment"
                  onClick={() => onRemove(c.id)}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {editingId == null ? (
        <div className="flex items-end gap-1.5">
          <textarea
            className="journey-map-facilitator-notes-field min-h-[2.25rem] min-w-0 flex-1 resize-y text-[11px]"
            placeholder="Facilitator note for discovery…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim() && !pending) onSaveNew();
              }
            }}
          />
          <button
            type="button"
            className="m3-btn-icon h-8 w-8 shrink-0 text-brand hover:bg-brand/10 disabled:opacity-40"
            aria-label="Add note"
            disabled={!draft.trim() || pending}
            onClick={onSaveNew}
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}