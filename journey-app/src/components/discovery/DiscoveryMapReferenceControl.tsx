"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import { resolveMapFocusStepId, resolveMapHighlightText } from "@/lib/discovery/resolveMapFocusStepId";
import {
  DiscoveryMapReferenceModal,
  type DiscoveryMapPreview,
} from "@/components/discovery/DiscoveryMapReferenceModal";
import { cn } from "@/lib/utils";

export function DiscoveryMapReferenceControl({
  references,
  steps,
  mapPreview,
  className,
}: {
  references?: DiscoveryReference;
  steps: DiscoveryStepOption[];
  mapPreview?: DiscoveryMapPreview | null;
  className?: string;
}) {
  const ref = references ?? {};
  const [mapOpen, setMapOpen] = useState(false);
  const [focusStepId, setFocusStepId] = useState<string | null>(() =>
    resolveMapFocusStepId(ref, steps)
  );

  useEffect(() => {
    setFocusStepId(resolveMapFocusStepId(ref, steps));
  }, [ref.stepId, ref.painId, steps]);

  const contextLabel = ref.phaseTitle ?? ref.stepTitle ?? "Linked step";
  const focusHighlightText = useMemo(
    () => resolveMapHighlightText(ref),
    [ref.painDescription, ref.opportunity, ref.stepKind, ref.userAction, ref.stepTitle]
  );

  const tooltip = useMemo(() => {
    const parts: string[] = ["View linked step on the journey map."];
    if (ref.stepTitle || ref.phaseTitle) {
      parts.push(`Step: ${ref.stepTitle ?? ref.phaseTitle}`);
    }
    if (ref.painDescription?.trim()) {
      parts.push(`Pain: ${ref.painDescription.slice(0, 120)}`);
    }
    return parts.join("\n");
  }, [ref.stepTitle, ref.phaseTitle, ref.painDescription]);

  const canOpen = Boolean(mapPreview && mapPreview.steps.length > 0);

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-brand hover:bg-surface-container disabled:opacity-40",
          className
        )}
        aria-label="View on map"
        title={canOpen ? tooltip : "Map preview unavailable"}
        disabled={!canOpen}
        onClick={() => setMapOpen(true)}
      >
        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
        View on map
      </button>

      {mapPreview ? (
        <DiscoveryMapReferenceModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          journeyId={mapPreview.journeyId}
          journeyTitle={mapPreview.journeyTitle}
          steps={mapPreview.steps}
          phaseTitles={mapPreview.phaseTitles}
          flowLinks={mapPreview.flowLinks}
          focusStepId={focusStepId}
          focusHighlightText={focusHighlightText}
          onFocusStepId={setFocusStepId}
          contextLabel={contextLabel}
        />
      ) : null}
    </>
  );
}