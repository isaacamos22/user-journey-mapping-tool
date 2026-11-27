"use client";

import Link from "next/link";
import { Map } from "lucide-react";
import { BlurModal } from "@/components/ui/BlurModal";
import { JourneyCanvas, type CanvasStep } from "@/components/journey/JourneyCanvas";
import { JourneyPhaseTimeline } from "@/components/journey/JourneyPhaseTimeline";
import type { FlowLink } from "@/lib/journey/flowLinks";
import type { MapPainEngagement } from "@/lib/journey/mapEngagementTypes";

export type DiscoveryMapPreview = {
  journeyId: string;
  journeyTitle: string;
  steps: CanvasStep[];
  phaseTitles: string[];
  flowLinks: FlowLink[];
  painEngagement?: MapPainEngagement;
};

export function DiscoveryMapReferenceModal({
  open,
  onClose,
  journeyId,
  journeyTitle,
  steps,
  phaseTitles,
  flowLinks,
  focusStepId,
  focusHighlightText,
  onFocusStepId,
  contextLabel,
}: {
  open: boolean;
  onClose: () => void;
  journeyId: string;
  journeyTitle: string;
  steps: CanvasStep[];
  phaseTitles: string[];
  flowLinks: FlowLink[];
  focusStepId: string | null;
  focusHighlightText?: string | null;
  onFocusStepId: (id: string | null) => void;
  contextLabel?: string;
}) {
  return (
    <BlurModal
      open={open}
      onClose={onClose}
      title={contextLabel ? `Map · ${contextLabel}` : "Map reference"}
      size="2xl"
      fixedShell
      dimBackdrop
    >
      <div className="flex h-[min(74vh,680px)] min-h-[320px] flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted truncate">{journeyTitle}</p>
          <Link
            href={
              focusStepId
                ? `/journeys/${journeyId}/map?focus=${encodeURIComponent(focusStepId)}`
                : `/journeys/${journeyId}/map`
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            onClick={onClose}
          >
            <Map className="h-3.5 w-3.5" aria-hidden />
            Open full map
          </Link>
        </div>
        <JourneyPhaseTimeline
          className="w-full min-w-0 shrink-0"
          steps={steps}
          phaseTitles={phaseTitles}
          focusStepId={focusStepId}
          onFocusPhase={onFocusStepId}
        />
        <div className="relative min-h-0 flex-1 w-full overflow-hidden rounded-xl bg-[var(--journey-map-canvas)]">
          {steps.length > 0 ? (
            <JourneyCanvas
              fill
              steps={steps}
              focusStepId={focusStepId}
              focusHighlightText={focusHighlightText}
              phaseTitles={phaseTitles}
              flowLinks={flowLinks}
              className="absolute inset-0 h-full min-h-0 border-0"
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted">No map steps to preview.</p>
          )}
        </div>
      </div>
    </BlurModal>
  );
}