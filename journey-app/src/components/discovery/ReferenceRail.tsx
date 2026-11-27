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

export type { DiscoveryMapPreview };

export function ReferenceRail({
  references,
  steps,
  mapPreview,
  className,
}: {
  references?: DiscoveryReference;
  steps: DiscoveryStepOption[];
  onChange?: (refs: DiscoveryReference) => void;
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

  return (
    <>
      <aside
        className={cn(
          "m3-panel m3-panel-tonal flex h-fit flex-col gap-3 p-3 text-sm",
          className
        )}
      >
        <h3 className="m3-eyebrow text-brand">Map reference</h3>

        {mapPreview && mapPreview.steps.length > 0 ? (
          <button
            type="button"
            className="flex w-full flex-col gap-2 rounded-lg border border-brand/25 bg-brand/5 p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/10"
            onClick={() => setMapOpen(true)}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              View on map
            </span>
            <span className="text-xs text-on-surface-variant line-clamp-2">
              {ref.stepTitle || ref.phaseTitle
                ? `Focus: ${ref.stepTitle ?? ref.phaseTitle}${ref.painDescription ? ` — ${ref.painDescription.slice(0, 56)}…` : ""}`
                : "Open the map to inspect anchors from discovery."}
            </span>
          </button>
        ) : (
          <p className="text-xs text-muted rounded-md border border-dashed border-border p-2">
            Map preview unavailable — refresh the journey page to verify layout.
          </p>
        )}

        <div className="space-y-1.5 text-xs">
          <RefRow label="Phase" value={ref.phaseTitle} />
          <RefRow label="Step" value={ref.stepTitle} />
          <RefRow label="Pain" value={ref.painDescription} />
          <RefRow label="User action" value={ref.userAction ?? undefined} />
        </div>
      </aside>

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

function RefRow({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <p>
      <span className="font-semibold text-muted">{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  );
}