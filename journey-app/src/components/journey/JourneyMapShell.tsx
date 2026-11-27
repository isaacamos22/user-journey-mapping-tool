"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExportMenu } from "@/components/journey/ExportMenu";
import { JourneyCanvas, type CanvasStep } from "@/components/journey/JourneyCanvas";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";
import { JourneyPhaseTimeline } from "@/components/journey/JourneyPhaseTimeline";
import type { FlowLink } from "@/lib/journey/flowLinks";
import { useJourneyChrome } from "@/components/journey/JourneyChromeContext";
export function JourneyMapShell({
  journeyId,
  journeyTitle,
  steps,
  phaseTitles,
  flowLinks = [],
  painEngagement,
}: {
  journeyId: string;
  journeyTitle: string;
  steps: CanvasStep[];
  phaseTitles?: string[];
  flowLinks?: FlowLink[];
  painEngagement: MapEngagement;
}) {
  const [engagement, setEngagement] = useState(painEngagement);
  const { setCollapsed } = useJourneyChrome();
  const searchParams = useSearchParams();
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  const [viewportPhaseRootId, setViewportPhaseRootId] = useState<string | null>(null);

  const setMapFocus = useCallback((stepId: string) => {
    setFocusStepId(stepId);
    setViewportPhaseRootId(null);
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get("focus");
    if (!fromQuery) return;
    setFocusStepId((prev) => (prev === fromQuery ? prev : fromQuery));
    setViewportPhaseRootId(null);
  }, [searchParams]);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const stepId = (e as CustomEvent<{ stepId?: string }>).detail?.stepId;
      if (!stepId) return;
      setMapFocus(stepId);
    };
    window.addEventListener("journey:map-focus-step", onFocus);
    return () => window.removeEventListener("journey:map-focus-step", onFocus);
  }, [setMapFocus]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => {
      if (mq.matches) setCollapsed(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [setCollapsed]);

  return (
    <div className="journey-map-shell flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div className="journey-map-phase-toolbar flex w-full min-w-0 shrink-0 items-stretch border-b border-border bg-surface">
        <JourneyPhaseTimeline
          className="journey-phase-timeline--dock min-w-0 flex-1"
          steps={steps}
          phaseTitles={phaseTitles}
          focusStepId={viewportPhaseRootId ?? focusStepId}
          onFocusPhase={setMapFocus}
        />
        <div className="flex w-11 shrink-0 items-center justify-center border-l border-border py-1">
          <ExportMenu journeyId={journeyId} journeyTitle={journeyTitle} captureId="map-capture" />
        </div>
      </div>
      <div
        id="map-capture"
        className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-[var(--journey-map-canvas)]"
      >
        <JourneyCanvas
          fill
          steps={steps}
          focusStepId={focusStepId}
          phaseTitles={phaseTitles}
          flowLinks={flowLinks}
          mapEngagement={{ journeyId, state: engagement, onChange: setEngagement }}
          onSelectStep={setMapFocus}
          onViewportPhaseRootId={setViewportPhaseRootId}
          className="absolute inset-0 h-full min-h-0 rounded-none border-0"
        />
      </div>
    </div>
  );
}