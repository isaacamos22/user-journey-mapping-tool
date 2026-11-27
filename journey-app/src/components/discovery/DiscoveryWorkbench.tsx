"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { CursorDiscoveryPanel } from "@/components/discovery/CursorDiscoveryPanel";
import { DiscoveryMapScopeFlow } from "@/components/discovery/DiscoveryMapScopeFlow";
import type { DiscoveryScopeTarget } from "@/lib/discovery/discoveryScope";
import {
  RequirementDiscoveryCard,
  type DiscoveryRequirementRecord,
} from "@/components/discovery/RequirementDiscoveryCard";
import { UserStoryDiscoveryCard } from "@/components/discovery/UserStoryDiscoveryCard";
import {
  DiscoverySetList,
  discoverySetSummary,
  type DiscoverySelection,
} from "@/components/discovery/DiscoverySetList";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import { groupDiscoveryBatches, type DiscoveryBatchMeta } from "@/lib/discovery/groupDiscoveryBatches";
import { dedupeDiscoveryRequirements } from "@/lib/discovery/dedupeRequirements";
import { deleteDiscoveryBatch } from "@/lib/actions/journey";
import type { DiscoveryMapPreview } from "@/components/discovery/DiscoveryMapReferenceModal";
import { ChevronRight, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { emptyMapEngagement, type MapEngagement } from "@/lib/journey/mapEngagementTypes";

export function DiscoveryWorkbench({
  journeyId,
  journeyTitle,
  requirements,
  steps,
  createdAtById,
  mapPreview,
}: {
  journeyId: string;
  journeyTitle: string;
  requirements: DiscoveryRequirementRecord[];
  steps: DiscoveryStepOption[];
  createdAtById?: Record<string, string>;
  mapPreview?: DiscoveryMapPreview | null;
}) {
  const router = useRouter();
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(() => dedupeDiscoveryRequirements(requirements));
  const [discoveryScope, setDiscoveryScope] = useState<DiscoveryScopeTarget[]>([]);
  const [liveMapEngagement, setLiveMapEngagement] = useState<MapEngagement>(
    () => mapPreview?.painEngagement ?? emptyMapEngagement()
  );
  const hasMapSteps = Boolean(mapPreview?.steps.length);

  useEffect(() => {
    setLiveMapEngagement(mapPreview?.painEngagement ?? emptyMapEngagement());
  }, [mapPreview?.painEngagement]);
  /** Land on the journey map when steps exist; discovery tree stays collapsed until opened. */
  const [mapScopeMode, setMapScopeMode] = useState(() => hasMapSteps);
  const [treeCollapsed, setTreeCollapsed] = useState(() => hasMapSteps || requirements.length === 0);
  const [, startDelete] = useTransition();

  const mapScopeModeRef = useRef(mapScopeMode);
  useEffect(() => {
    if (mapScopeMode && !mapScopeModeRef.current) {
      setTreeCollapsed(true);
    }
    mapScopeModeRef.current = mapScopeMode;
  }, [mapScopeMode]);

  useEffect(() => {
    setItems(dedupeDiscoveryRequirements(requirements));
  }, [requirements]);

  const batchMetas = useMemo(
    () =>
      groupDiscoveryBatches(
        items.map((r) => ({
          id: r.id,
          createdAt: createdAtById?.[r.id],
          synthesisBatchId: r.synthesisBatchId,
        }))
      ),
    [items, createdAtById]
  );

  const setsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof discoverySetSummary>>();
    for (const r of items) map.set(r.id, discoverySetSummary(r));
    return map;
  }, [items]);

  const [selection, setSelection] = useState<DiscoverySelection | null>(() => {
    const first = items[0];
    return first ? { kind: "requirement", requirementId: first.id } : null;
  });

  useEffect(() => {
    setSelection((prev) => {
      if (!items.length) return null;
      if (!prev) return null;
      const req = items.find((r) => r.id === prev.requirementId);
      if (!req) return null;
      if (prev.kind === "story" && !req.stories.some((s) => s.id === prev.storyId)) {
        return { kind: "requirement", requirementId: req.id };
      }
      return prev;
    });
  }, [items]);

  const detailScrollRef = useRef<HTMLDivElement>(null);
  const [detailGenieStyle, setDetailGenieStyle] = useState<CSSProperties | undefined>(undefined);
  const [detailEnterToken, setDetailEnterToken] = useState(0);

  const closeDetailViewer = useCallback(() => {
    setSelection(null);
    setDetailGenieStyle(undefined);
    setDetailEnterToken(0);
    if (hasMapSteps) {
      setMapScopeMode(true);
      setTreeCollapsed(true);
    }
  }, [hasMapSteps]);

  const selectItem = useCallback((next: DiscoverySelection, originEl?: HTMLElement) => {
    if (originEl && detailScrollRef.current) {
      const o = originEl.getBoundingClientRect();
      const v = detailScrollRef.current.getBoundingClientRect();
      setDetailGenieStyle({
        ["--genie-origin-x" as string]: `${o.left + o.width / 2 - v.left}px`,
        ["--genie-origin-y" as string]: `${o.top + o.height / 2 - v.top}px`,
      });
      setDetailEnterToken((t) => t + 1);
    }
    setSelection(next);
    setMapScopeMode((inMapScope) => {
      if (inMapScope) setTreeCollapsed(false);
      return inMapScope ? false : inMapScope;
    });
    detailScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const activeRequirement = useMemo(() => {
    if (!selection) return null;
    return items.find((r) => r.id === selection.requirementId) ?? null;
  }, [items, selection]);

  const activeStory = useMemo(() => {
    if (selection?.kind !== "story" || !activeRequirement) return null;
    return activeRequirement.stories.find((s) => s.id === selection.storyId) ?? null;
  }, [selection, activeRequirement]);

  const onMetaChange = useCallback((id: string, patch: Partial<DiscoveryRequirementRecord>) => {
    setItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              body: patch.body ? { ...r.body, ...patch.body } : r.body,
            }
          : r
      )
    );
  }, []);

  const onStoryMetaChange = useCallback(
    (requirementId: string, storyId: string, patch: { title?: string }) => {
      setItems((prev) =>
        prev.map((r) =>
          r.id === requirementId
            ? { ...r, stories: r.stories.map((s) => (s.id === storyId ? { ...s, ...patch } : s)) }
            : r
        )
      );
    },
    []
  );

  const handleDeleteBatch = useCallback(
    (batch: DiscoveryBatchMeta) => {
      setDeletingBatch(true);
      setError(null);
      startDelete(async () => {
        try {
          const idSet = new Set(batch.requirementIds);
          await deleteDiscoveryBatch(journeyId, batch.id, batch.requirementIds);
          setItems((prev) => {
            const next = prev.filter((r) => !idSet.has(r.id));
            setSelection((sel) => {
              if (!sel || !idSet.has(sel.requirementId)) return sel;
              return next[0] ? { kind: "requirement", requirementId: next[0].id } : null;
            });
            return next;
          });
          router.refresh();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Could not delete this generation.";
          setError(msg === "Forbidden" ? "You do not have permission to delete this set." : msg);
        } finally {
          setDeletingBatch(false);
        }
      });
    },
    [journeyId, router, startDelete]
  );

  const handleDeleteRequirement = useCallback(
    (requirementId: string) => {
      setDeletingBatch(true);
      setError(null);
      startDelete(async () => {
        try {
          await deleteDiscoveryBatch(journeyId, "legacy:requirement", [requirementId]);
          setItems((prev) => {
            const next = prev.filter((r) => r.id !== requirementId);
            setSelection((sel) => {
              if (!sel || sel.requirementId !== requirementId) return sel;
              return next[0] ? { kind: "requirement", requirementId: next[0].id } : null;
            });
            return next;
          });
          router.refresh();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Could not delete this requirement.";
          setError(msg === "Forbidden" ? "You do not have permission to delete." : msg);
        } finally {
          setDeletingBatch(false);
        }
      });
    },
    [journeyId, router, startDelete]
  );

  const detailEnterVariant =
    detailGenieStyle && detailEnterToken > 0 ? ("genie" as const) : ("default" as const);
  const closeViewer = hasMapSteps || items.length > 0 ? closeDetailViewer : undefined;

  const discoverySetList = (
    <DiscoverySetList
      batches={batchMetas}
      setsById={setsById}
      selection={selection}
      onSelect={selectItem}
      onDeleteBatch={handleDeleteBatch}
      onDeleteRequirement={handleDeleteRequirement}
      deletingBatch={deletingBatch}
      error={error}
      journeyId={journeyId}
      journeyTitle={journeyTitle}
      scope={discoveryScope}
      mapReady={Boolean(mapPreview?.steps.length)}
      onStartFromMap={() => {
        setMapScopeMode(true);
        setTreeCollapsed(true);
      }}
      mapScopeMode={mapScopeMode}
      onCollapsePanel={() => setTreeCollapsed(true)}
      mapEngagement={liveMapEngagement}
      stepOptions={steps}
      canvasSteps={mapPreview?.steps}
    />
  );

  const renderViewer = () => {
    if (mapScopeMode && mapPreview && mapPreview.steps.length === 0) {
      return (
        <p className="m3-body-muted rounded-xl border border-dashed border-border p-8 text-center text-sm">
          Import or add journey steps first, then pick pains and opportunities on the map.
        </p>
      );
    }
    if (mapScopeMode && mapPreview?.steps.length) {
      return (
        <DiscoveryMapScopeFlow
          journeyId={journeyId}
          journeyTitle={journeyTitle}
          mapPreview={mapPreview}
          stepOptions={steps}
          scope={discoveryScope}
          onScopeChange={setDiscoveryScope}
          showDoneLink={items.length > 0}
          onDone={() => {
            setMapScopeMode(false);
            setTreeCollapsed(false);
          }}
          onExpandDiscoveryTree={() => setTreeCollapsed(false)}
          onCollapseDiscoveryTree={() => setTreeCollapsed(true)}
          treeCollapsed={treeCollapsed}
          discoveryTreePanel={discoverySetList}
          onMapEngagementChange={setLiveMapEngagement}
        />
      );
    }
    if (items.length === 0) {
      return (
        <CursorDiscoveryPanel
          journeyId={journeyId}
          journeyTitle={journeyTitle}
          scope={discoveryScope}
          mapEngagement={liveMapEngagement}
          stepOptions={steps}
          canvasSteps={mapPreview?.steps}
        />
      );
    }
    if (!selection || !activeRequirement) {
      return (
        <p className="flex min-h-[12rem] items-center justify-center text-sm text-muted">
          Select a requirement or user story in the tree.
        </p>
      );
    }
    if (selection?.kind === "story" && activeStory) {
      return (
        <div
          className="discovery-detail-genie-host"
          style={detailGenieStyle}
          key={`story-${activeStory.id}-${detailEnterToken}`}
        >
          <UserStoryDiscoveryCard
            journeyId={journeyId}
            record={activeStory}
            steps={steps}
            mapPreview={mapPreview}
            enterVariant={detailEnterVariant}
            onCloseViewer={closeViewer}
            onMetaChange={(storyId, patch) =>
              onStoryMetaChange(activeRequirement.id, storyId, patch)
            }
            parentRequirement={{
              tag: activeRequirement.tag,
              title: activeRequirement.title,
              onOpen: () => selectItem({ kind: "requirement", requirementId: activeRequirement.id }),
            }}
          />
        </div>
      );
    }
    return (
      <div
        className="discovery-detail-genie-host"
        style={detailGenieStyle}
        key={`req-${activeRequirement.id}-${detailEnterToken}`}
      >
        <RequirementDiscoveryCard
          journeyId={journeyId}
          record={activeRequirement}
          steps={steps}
          mapPreview={mapPreview}
          enterVariant={detailEnterVariant}
          onCloseViewer={closeViewer}
          onMetaChange={onMetaChange}
        />
      </div>
    );
  };

  return (
    <div
      className={cn(
        "discovery-workbench discovery-workbench--immersive h-full min-h-0 flex-1",
        treeCollapsed && "discovery-workbench--tree-collapsed",
        mapScopeMode && "discovery-workbench--map-scope"
      )}
    >
      <aside
        className={cn(
          "discovery-workbench__tree",
          treeCollapsed && "discovery-workbench__tree--collapsed",
          mapScopeMode && "discovery-workbench__tree--map-hidden"
        )}
        aria-label="Discovery navigation"
      >
        {treeCollapsed ? (
          <div className="discovery-workbench__tree-rail">
            <button
              type="button"
              className="m3-btn-icon h-9 w-9 shrink-0 text-muted hover:text-foreground"
              aria-label="Expand discovery panel"
              title="Show discovery tree"
              onClick={() => setTreeCollapsed(false)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <ListTree className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          </div>
        ) : !mapScopeMode ? (
          discoverySetList
        ) : null}
      </aside>

      <main
        ref={detailScrollRef}
        className={cn(
          "discovery-workbench__viewer overlay-scrollbar",
          mapScopeMode && "flex min-h-0 flex-1 flex-col"
        )}
        aria-label="Discovery editor"
      >
        {renderViewer()}
      </main>
    </div>
  );
}