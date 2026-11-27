"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Heart, MessageSquare, Plus, X } from "lucide-react";
import { DiscoveryTreeRail } from "@/components/discovery/DiscoveryTreeRail";
import { JourneyCanvas, type DiscoveryScopePickHandlers } from "@/components/journey/JourneyCanvas";
import { JourneyPhaseTimeline } from "@/components/journey/JourneyPhaseTimeline";
import type { DiscoveryMapPreview } from "@/components/discovery/DiscoveryMapReferenceModal";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import { buildCursorDiscoveryPrompt } from "@/lib/discovery/cursorDiscoveryPrompt";
import {
  scopeTargetFromOpportunityBullet,
  scopeTargetFromPainBullet,
  discoveryRequirementCount,
  scopeTargetsForFocus,
  enrichScopeTargetWithEngagement,
  type DiscoveryScopeTarget,
} from "@/lib/discovery/discoveryScope";
import { DiscoveryScopeFloatingPanel } from "@/components/discovery/DiscoveryScopeFloatingPanel";
import { ExportMenu } from "@/components/journey/ExportMenu";
import { cn } from "@/lib/utils";
import { emptyMapEngagement, type MapEngagement } from "@/lib/journey/mapEngagementTypes";

function FacilitatorScopeMarkers({ target }: { target: DiscoveryScopeTarget }) {
  const notes = target.facilitatorNotes?.length ?? 0;
  if (!target.facilitatorHearted && notes === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-label="Facilitator map signals">
      {target.facilitatorHearted ? (
        <Heart className="h-3 w-3 fill-red-600 text-red-600" aria-hidden />
      ) : null}
      {notes > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-brand" title={`${notes} facilitator note(s)`}>
          <MessageSquare className="h-3 w-3" aria-hidden />
          <span className="tabular-nums">{notes}</span>
        </span>
      ) : null}
    </span>
  );
}

export function DiscoveryMapScopeFlow({
  journeyId,
  journeyTitle,
  mapPreview,
  stepOptions,
  scope,
  onScopeChange,
  onDone,
  showDoneLink,
  onExpandDiscoveryTree,
  onCollapseDiscoveryTree,
  treeCollapsed = true,
  discoveryTreePanel,
  onMapEngagementChange,
}: {
  journeyId: string;
  journeyTitle: string;
  mapPreview: DiscoveryMapPreview;
  stepOptions: DiscoveryStepOption[];
  scope: DiscoveryScopeTarget[];
  onScopeChange: (next: DiscoveryScopeTarget[]) => void;
  onDone?: () => void;
  showDoneLink?: boolean;
  onExpandDiscoveryTree?: () => void;
  onCollapseDiscoveryTree?: () => void;
  treeCollapsed?: boolean;
  discoveryTreePanel?: ReactNode;
  onMapEngagementChange?: (next: MapEngagement) => void;
}) {
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  const [viewportPhaseRootId, setViewportPhaseRootId] = useState<string | null>(null);

  const setMapFocus = useCallback((stepId: string) => {
    setFocusStepId(stepId);
    setViewportPhaseRootId(null);
  }, []);
  const [scopePanelExpanded, setScopePanelExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [painEngagement, setPainEngagement] = useState<MapEngagement>(
    () => mapPreview.painEngagement ?? emptyMapEngagement()
  );

  const updatePainEngagement = useCallback(
    (next: MapEngagement) => {
      setPainEngagement(next);
      onMapEngagementChange?.(next);
    },
    [onMapEngagementChange]
  );

  const selectedIds = useMemo(() => new Set(scope.map((t) => t.id)), [scope]);

  const addTarget = useCallback(
    (t: DiscoveryScopeTarget) => {
      if (scope.some((x) => x.id === t.id)) return;
      onScopeChange([...scope, t]);
      setScopePanelExpanded(true);
    },
    [scope, onScopeChange]
  );

  const removeTarget = useCallback(
    (id: string) => {
      onScopeChange(scope.filter((t) => t.id !== id));
    },
    [scope, onScopeChange]
  );

  const focusedCandidates = useMemo(
    () =>
      scopeTargetsForFocus(focusStepId, stepOptions, mapPreview.steps, painEngagement).map((t) =>
        enrichScopeTargetWithEngagement(t, painEngagement)
      ),
    [focusStepId, stepOptions, mapPreview.steps, painEngagement]
  );

  const focusCardTitle = useMemo(() => {
    if (!focusStepId) return null;
    const s = mapPreview.steps.find((x) => x.id === focusStepId);
    if (!s) return null;
    return s.parentStepId ? s.userAction || s.title : s.title;
  }, [focusStepId, mapPreview.steps]);

  const scopePick = useMemo((): DiscoveryScopePickHandlers => {
    const { steps } = mapPreview;
    return {
      onPickPain: (stepId, text) => {
        const t = scopeTargetFromPainBullet(stepId, text, stepOptions, steps, painEngagement);
        if (t) addTarget(t);
      },
      onPickOpportunity: (stepId, text) => {
        const t = scopeTargetFromOpportunityBullet(stepId, text, stepOptions, steps, painEngagement);
        if (t) addTarget(t);
      },
    };
  }, [mapPreview, stepOptions, focusedCandidates, addTarget, painEngagement]);

  const requirementCount = useMemo(() => discoveryRequirementCount(scope), [scope]);

  const prompt = useMemo(
    () =>
      buildCursorDiscoveryPrompt(
        { id: journeyId, title: journeyTitle },
        scope,
        {
          mapEngagement: painEngagement,
          stepOptions,
          canvasSteps: mapPreview.steps,
        }
      ),
    [journeyId, journeyTitle, scope, painEngagement, stepOptions, mapPreview.steps]
  );

  const copyPrompt = async () => {
    if (!scope.length) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const discoveryPanelOpen = scopePanelExpanded && !treeCollapsed;
  const showTreeColumn = scopePanelExpanded;

  const setScopeExpanded = (next: boolean) => {
    setScopePanelExpanded(next);
    if (!next) {
      window.setTimeout(() => onCollapseDiscoveryTree?.(), 380);
    }
  };

  return (
    <div className="discovery-map-scope-flow flex h-full min-h-0 w-full flex-1 flex-col">
      <div className="journey-map-phase-toolbar flex w-full min-w-0 shrink-0 items-stretch border-b border-border bg-surface">
        <JourneyPhaseTimeline
          className="journey-phase-timeline--dock min-w-0 flex-1"
          steps={mapPreview.steps}
          phaseTitles={mapPreview.phaseTitles}
          focusStepId={viewportPhaseRootId ?? focusStepId}
          onFocusPhase={setMapFocus}
        />
        <div className="flex w-11 shrink-0 items-center justify-center border-l border-border py-1">
          <ExportMenu
            journeyId={journeyId}
            journeyTitle={journeyTitle}
            captureId="map-capture"
          />
        </div>
      </div>

      <div className="discovery-map-body min-h-0 w-full flex-1">
        <div id="map-capture" className="discovery-map-main">
        <section
          className="absolute inset-0 bg-[var(--journey-map-canvas)]"
          aria-label="Interactive journey map"
        >
          <JourneyCanvas
            fill
            steps={mapPreview.steps}
            phaseTitles={mapPreview.phaseTitles}
            flowLinks={mapPreview.flowLinks}
            focusStepId={focusStepId}
            discoveryScopePick={scopePick}
            mapEngagement={{
              journeyId,
              state: painEngagement,
              onChange: updatePainEngagement,
            }}
            onSelectStep={setMapFocus}
            onViewportPhaseRootId={setViewportPhaseRootId}
            className="absolute inset-0 h-full border-0"
          />
        </section>
        </div>

        <DiscoveryScopeFloatingPanel
          expanded={scopePanelExpanded}
          onExpandedChange={setScopeExpanded}
          scopeCount={scope.length}
          header={
            <>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-semibold text-foreground">
                  Discovery scope
                  {scope.length > 0 ? ` · ${requirementCount} requirement${requirementCount === 1 ? "" : "s"}` : ""}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {showDoneLink && onDone ? (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-brand hover:underline"
                      onClick={onDone}
                    >
                      Back to requirements
                    </button>
                  ) : null}
                  {focusStepId ? (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-muted hover:text-foreground"
                      onClick={() => setFocusStepId(null)}
                    >
                      Unfocus
                    </button>
                  ) : null}
                  {scope.length > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-brand hover:underline"
                      onClick={() => onScopeChange([])}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          }
          footer={
            <div className="mt-auto shrink-0 border-t border-border pt-3">
              <button
                type="button"
                disabled={!scope.length}
                onClick={() => void copyPrompt()}
                title={scope.length ? "Copy discovery prompt to clipboard" : "Add scope to generate the prompt"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy prompt for Cursor"}
              </button>
              {!scope.length ? (
                <p className="mt-1.5 text-center text-[10px] text-muted">Add scope to generate the prompt.</p>
              ) : null}
            </div>
          }
        >
            {focusStepId && focusedCandidates.length > 0 ? (
              <div className="space-y-1.5 border-b border-border pb-3">
                <p className="text-[11px] text-muted line-clamp-2" title={focusCardTitle ?? undefined}>
                  Map: <span className="text-foreground">{focusCardTitle}</span>
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto overlay-scrollbar">
                  {focusedCandidates.map((c) => {
                    const inScope = selectedIds.has(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={inScope}
                          onClick={() => addTarget(c)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-snug transition-colors",
                            inScope
                              ? "border-brand/30 bg-brand/5 text-muted"
                              : "border-border bg-surface hover:border-brand/35 hover:bg-brand/5"
                          )}
                        >
                          <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                          <span className="min-w-0 flex-1">{c.label}</span>
                          <FacilitatorScopeMarkers target={c} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {scope.length === 0 ? (
              <p className="text-xs text-muted">
                {focusStepId ? "Add with + or click friction on the map." : "Click a map card or friction bullet."}
              </p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overlay-scrollbar">
                {scope.map((t, i) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px]"
                  >
                    <span className="mt-px w-4 shrink-0 tabular-nums text-[10px] font-medium text-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{t.label}</span>
                    <FacilitatorScopeMarkers target={enrichScopeTargetWithEngagement(t, painEngagement)} />
                    <button
                      type="button"
                      className="m3-btn-icon shrink-0"
                      aria-label="Remove from scope"
                      onClick={() => removeTarget(t.id)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </DiscoveryScopeFloatingPanel>

        <aside
          className={cn(
            "discovery-map-tree-aside discovery-map-tree-aside--overlay flex h-full min-h-0 flex-col",
            !showTreeColumn && "discovery-map-tree-aside--off-screen",
            discoveryPanelOpen
              ? "discovery-map-tree-aside--open overflow-hidden"
              : "discovery-map-tree-aside--rail overflow-visible"
          )}
          aria-label="Discovery tree"
          aria-hidden={!showTreeColumn}
        >
          {discoveryPanelOpen && discoveryTreePanel ? (
            <div className="discovery-map-tree-aside__inner flex h-full min-h-0 flex-col">
              {discoveryTreePanel}
            </div>
          ) : onExpandDiscoveryTree ? (
            <DiscoveryTreeRail variant="column" onExpand={onExpandDiscoveryTree} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}