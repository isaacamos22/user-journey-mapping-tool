"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  ListTree,
  MoreVertical,
  PanelLeftClose,
  ScrollText,
  Trash2,
} from "lucide-react";
import { CursorDiscoveryPanel } from "@/components/discovery/CursorDiscoveryPanel";
import { DiscoveryTreeReveal } from "@/components/discovery/DiscoveryTreeReveal";
import { BlurModal } from "@/components/ui/BlurModal";
import { cn } from "@/lib/utils";
import type { DiscoveryBatchMeta } from "@/lib/discovery/groupDiscoveryBatches";
import type { DiscoveryRequirementRecord } from "@/components/discovery/RequirementDiscoveryCard";

export type DiscoverySelection =
  | { kind: "requirement"; requirementId: string }
  | { kind: "story"; requirementId: string; storyId: string };

export type DiscoverySetSummary = {
  id: string;
  tag: string;
  title: string;
  priority: string;
  storyCount: number;
  mapRef?: string;
  stories: { id: string; title: string }[];
};

export function discoverySetSummary(record: DiscoveryRequirementRecord): DiscoverySetSummary {
  const ref = record.body.references;
  const mapRef = ref?.personaName
    ? `${ref.personaName}${ref.painDescription ? ` · ${ref.painDescription.slice(0, 40)}` : ""}`
    : ref?.painDescription
      ? ref.painDescription.slice(0, 56)
      : ref?.stepTitle
        ? ref.stepTitle
        : undefined;
  return {
    id: record.id,
    tag: record.tag,
    title: record.title,
    priority: record.body.priority,
    storyCount: record.stories.length,
    mapRef,
    stories: record.stories.map((s) => ({ id: s.id, title: s.title })),
  };
}

function TreeChevron({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="discovery-tree-chevron"
      aria-expanded={open}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );
}

function TreeItem({
  kind,
  active,
  chevron,
  icon,
  badge,
  title,
  meta,
  onClick,
  trailing,
}: {
  kind: "set" | "req" | "story";
  active?: boolean;
  chevron: ReactNode;
  icon: ReactNode;
  trailing?: ReactNode;
  badge?: string;
  title: string;
  meta?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      className={cn(
        "discovery-tree-item",
        kind === "set" && "discovery-tree-item--set",
        kind === "req" && "discovery-tree-item--req",
        kind === "story" && "discovery-tree-item--story",
        active && "discovery-tree-item--active"
      )}
    >
      {chevron}
      <button
        type="button"
        className="discovery-tree-item__hit"
        onClick={(e) => onClick?.(e)}
      >
        <span className="discovery-tree-glyph" aria-hidden>
          {icon}
        </span>
        <span className="discovery-tree-item__content min-w-0">
          {badge ? <span className="discovery-tree-badge">{badge}</span> : null}
          <span className="discovery-tree-item__title line-clamp-2">{title}</span>
          {meta ? <span className="discovery-tree-item__meta line-clamp-1">{meta}</span> : null}
        </span>
      </button>
      {trailing}
    </div>
  );
}

export function DiscoverySetList({
  batches,
  setsById,
  selection,
  onSelect,
  onDeleteBatch,
  onDeleteRequirement,
  deletingBatch,
  error,
  journeyId,
  journeyTitle,
  scope,
  mapReady,
  onStartFromMap,
  mapScopeMode,
  onCollapsePanel,
}: {
  batches: DiscoveryBatchMeta[];
  setsById: Map<string, DiscoverySetSummary>;
  selection: DiscoverySelection | null;
  onSelect: (next: DiscoverySelection, originEl?: HTMLElement) => void;
  onDeleteBatch: (batch: DiscoveryBatchMeta) => void;
  onDeleteRequirement?: (requirementId: string) => void;
  deletingBatch?: boolean;
  error?: string | null;
  journeyId: string;
  journeyTitle: string;
  scope?: import("@/lib/discovery/discoveryScope").DiscoveryScopeTarget[];
  mapReady?: boolean;
  onStartFromMap?: () => void;
  mapScopeMode?: boolean;
  onCollapsePanel?: () => void;
  mapEngagement?: import("@/lib/journey/mapEngagementTypes").MapEngagement;
  stepOptions?: import("@/lib/discovery/flattenJourneySteps").DiscoveryStepOption[];
  canvasSteps?: import("@/components/journey/JourneyCanvas").CanvasStep[];
}) {
  const [openBatches, setOpenBatches] = useState<Record<string, boolean>>({});
  const [openReqs, setOpenReqs] = useState<Record<string, boolean>>({});
  const [menuBatchId, setMenuBatchId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    batch: DiscoveryBatchMeta;
    setNumber: number;
  } | null>(null);
  const [menuReqId, setMenuReqId] = useState<string | null>(null);
  const [deleteReqTarget, setDeleteReqTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    setOpenBatches((prev) => {
      const next = { ...prev };
      for (const b of batches) {
        if (next[b.id] === undefined) next[b.id] = true;
      }
      return next;
    });
  }, [batches]);

  useEffect(() => {
    setOpenReqs((prev) => {
      const next = { ...prev };
      for (const set of setsById.values()) {
        if (set.stories.length > 0 && next[set.id] === undefined) next[set.id] = true;
      }
      return next;
    });
  }, [setsById]);

  const chronologicalIndex = useMemo(() => {
    const asc = [...batches].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
    );
    return new Map(asc.map((b, i) => [b.id, i + 1]));
  }, [batches]);

  const toggleBatch = useCallback((id: string) => {
    setOpenBatches((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const toggleReq = useCallback((id: string) => {
    setOpenReqs((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const isReqActive = (id: string) =>
    selection?.kind === "requirement" && selection.requirementId === id;
  const isStoryActive = (reqId: string, storyId: string) =>
    selection?.kind === "story" &&
    selection.requirementId === reqId &&
    selection.storyId === storyId;
  return (
    <nav
      className="discovery-set-list-nav flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-surface"
      aria-label="Discovery tree"
    >
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ListTree className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Discovery</h3>
          </div>
          {onCollapsePanel ? (
            <button
              type="button"
              className="m3-btn-icon h-7 w-7 shrink-0 text-muted hover:text-foreground"
              aria-label="Minimize discovery panel"
              title="Minimize panel"
              onClick={onCollapsePanel}
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <CursorDiscoveryPanel
          journeyId={journeyId}
          journeyTitle={journeyTitle}
          compact
          minimal={mapScopeMode}
          scope={scope}
          mapReady={mapReady}
          onStartFromMap={onStartFromMap}
        />
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <p className="text-xs text-muted">
          {mapScopeMode
            ? "Select a requirement to view and edit."
            : "Select a requirement to edit."}
        </p>
      </div>

      <div className="overlay-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {batches.length === 0 && !mapScopeMode ? (
          <p className="px-2 py-4 text-center text-[11px] leading-snug text-muted">No sets yet.</p>
        ) : (
          <div className="discovery-tree-modern">
            <ul className="discovery-tree">
              {batches.map((batch) => {
                const batchOpen = openBatches[batch.id] ?? true;
                const setNumber = chronologicalIndex.get(batch.id) ?? 0;
                const hasChildren = batch.requirementIds.length > 0;
                return (
                  <li key={batch.id} className="discovery-tree-set">
                    <TreeItem
                      kind="set"
                      badge="Discovery set"
                      title={`Set ${setNumber}`}
                      meta={`${batch.requirementIds.length} requirement${batch.requirementIds.length === 1 ? "" : "s"}${batch.label ? ` · ${batch.label}` : ""}`}
                      onClick={() => hasChildren && toggleBatch(batch.id)}
                      icon={<Layers className="h-full w-full" />}
                      chevron={
                        hasChildren ? (
                          <TreeChevron
                            open={batchOpen}
                            label={`${batchOpen ? "Collapse" : "Expand"} discovery set ${setNumber}`}
                            onClick={() => toggleBatch(batch.id)}
                          />
                        ) : (
                          <span className="discovery-tree-chevron--spacer" aria-hidden />
                        )
                      }
                      trailing={
                        <div className="flex shrink-0 items-center self-center pr-0.5">
                          <SetBatchMenu
                            open={menuBatchId === batch.id}
                            onOpen={() => setMenuBatchId(batch.id)}
                            onClose={() => setMenuBatchId(null)}
                            disabled={deletingBatch}
                            onRequestDelete={() => setDeleteTarget({ batch, setNumber })}
                          />
                        </div>
                      }
                    />

                    <DiscoveryTreeReveal open={batchOpen && hasChildren}>
                      <div className="discovery-tree-children">
                        {batch.requirementIds.map((reqId, reqIndex) => {
                          const set = setsById.get(reqId);
                          if (!set) return null;
                          const reqOpen = openReqs[set.id] ?? set.stories.length === 0;
                          const hasStories = set.stories.length > 0;
                          const reqActive = isReqActive(set.id);
                          return (
                            <div key={`req-${batch.id}-${reqId}-${reqIndex}`}>
                              <TreeItem
                                kind="req"
                                active={reqActive}
                                badge="Requirement"
                                title={`[${set.tag}] ${set.title}`}
                                onClick={(e) => {
                                  onSelect(
                                    { kind: "requirement", requirementId: set.id },
                                    e.currentTarget
                                  );
                                  if (hasStories) setOpenReqs((p) => ({ ...p, [set.id]: true }));
                                }}
                                icon={<ScrollText className="h-full w-full" />}
                                chevron={
                                  hasStories ? (
                                    <TreeChevron
                                      open={reqOpen}
                                      label={`${reqOpen ? "Collapse" : "Expand"} user stories`}
                                      onClick={() => toggleReq(set.id)}
                                    />
                                  ) : (
                                    <span className="discovery-tree-chevron--spacer" aria-hidden />
                                  )
                                }
                                trailing={
                                  onDeleteRequirement ? (
                                    <div className="flex shrink-0 items-center self-center pr-0.5">
                                      <TreeItemMenu
                                        open={menuReqId === set.id}
                                        onOpen={() => setMenuReqId(set.id)}
                                        onClose={() => setMenuReqId(null)}
                                        disabled={deletingBatch}
                                        label="Requirement options"
                                        onRequestDelete={() =>
                                          setDeleteReqTarget({ id: set.id, title: set.title })
                                        }
                                      />
                                    </div>
                                  ) : null
                                }
                              />
                              <DiscoveryTreeReveal open={reqOpen && hasStories}>
                                <div className="discovery-tree-children discovery-tree-stories">
                                  {set.stories.map((story, storyIndex) => (
                                    <TreeItem
                                      key={`story-${set.id}-${story.id}-${storyIndex}`}
                                      kind="story"
                                      active={isStoryActive(set.id, story.id)}
                                      badge="User story"
                                      title={story.title}
                                      onClick={(e) =>
                                        onSelect(
                                          {
                                            kind: "story",
                                            requirementId: set.id,
                                            storyId: story.id,
                                          },
                                          e.currentTarget
                                        )
                                      }
                                      icon={<FileText className="h-full w-full" />}
                                      chevron={<span className="discovery-tree-chevron--spacer" aria-hidden />}
                                    />
                                  ))}
                                </div>
                              </DiscoveryTreeReveal>
                            </div>
                          );
                        })}
                      </div>
                    </DiscoveryTreeReveal>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <BlurModal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete discovery set?"
        size="md"
        dimBackdrop
      >
        {deleteTarget ? (
          <div className="space-y-4 p-1">
            <p className="text-sm text-muted">
              Remove <strong className="text-foreground">set {deleteTarget.setNumber}</strong> and{" "}
              {deleteTarget.batch.requirementIds.length} requirement
              {deleteTarget.batch.requirementIds.length === 1 ? "" : "s"} with linked user
              stories? This cannot be undone.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-container"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingBatch}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                onClick={() => {
                  onDeleteBatch(deleteTarget.batch);
                  setDeleteTarget(null);
                  setMenuBatchId(null);
                }}
              >
                Delete set
              </button>
            </div>
          </div>
        ) : null}
      </BlurModal>

      <BlurModal
        open={deleteReqTarget != null}
        onClose={() => setDeleteReqTarget(null)}
        title="Delete requirement?"
        size="md"
        dimBackdrop
      >
        {deleteReqTarget ? (
          <div className="space-y-4 p-1">
            <p className="text-sm text-muted">
              This removes <span className="font-medium text-foreground">{deleteReqTarget.title}</span>{" "}
              and its user stories. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-foreground/5"
                onClick={() => setDeleteReqTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingBatch}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                onClick={() => {
                  onDeleteRequirement?.(deleteReqTarget.id);
                  setDeleteReqTarget(null);
                  setMenuReqId(null);
                }}
              >
                Delete requirement
              </button>
            </div>
          </div>
        ) : null}
      </BlurModal>
    </nav>
  );
}

function TreeItemMenu({
  open,
  onOpen,
  onClose,
  onRequestDelete,
  disabled,
  label,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRequestDelete: () => void;
  disabled?: boolean;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        className="m3-btn-icon h-7 w-7 text-muted hover:text-foreground"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (open) onClose();
          else onOpen();
        }}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-0.5 min-w-[9.5rem] rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => {
              onClose();
              onRequestDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SetBatchMenu({
  open,
  onOpen,
  onClose,
  onRequestDelete,
  disabled,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRequestDelete: () => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        className="m3-btn-icon h-7 w-7 text-muted hover:text-foreground"
        aria-label="Set options"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (open) onClose();
          else onOpen();
        }}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-0.5 min-w-[9.5rem] rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => {
              onClose();
              onRequestDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete set
          </button>
        </div>
      ) : null}
    </div>
  );
}