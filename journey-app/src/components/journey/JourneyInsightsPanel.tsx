"use client";

import { Lightbulb, MapPin } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { JourneyInsights } from "@/lib/journey/buildJourneyInsights";
import { painSeverityColor, painSeverityLabel } from "@/lib/charts/chartSemantics";
import { completenessBarColor, completenessTrackColor } from "@/lib/completeness/completenessColors";
import { isJourneyMapCanvasPath } from "@/lib/navigation/journeySegment";
import { cn } from "@/lib/utils";

const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wide text-on-surface-variant";

export function JourneyInsightsPanel({
  journeyId,
  insights,
  compact = false,
}: {
  journeyId: string;
  insights: JourneyInsights;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const barColor = completenessBarColor(insights.coverageScore);
  const trackColor = completenessTrackColor(insights.coverageScore);
  const focusStepOnMap = (stepId: string, title: string) => {
    if (!isJourneyMapCanvasPath(pathname)) {
      router.push(`/journeys/${journeyId}/map?focus=${encodeURIComponent(stepId)}`);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("journey:map-focus-step", { detail: { stepId, title } })
    );
  };

  return (
    <div className={cn("m3-panel m3-panel-tonal min-w-0 w-full max-w-full", compact ? "p-3" : "mt-3 p-4")}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-foreground">Journey insights</h3>
        <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {insights.coverageLabel}
        </span>
      </div>

      <CoverageBar score={insights.coverageScore} barColor={barColor} trackColor={trackColor} />

      <dl className="mt-3 mb-4 grid grid-cols-3 gap-1.5 text-xs">
        {insights.kpis.phases === insights.kpis.steps ? (
          <Metric
            label="Phase columns"
            value={insights.kpis.phases}
            title="Workshop columns — one phase card on the map per column"
          />
        ) : (
          <>
            <Metric
              label="Phase columns"
              value={insights.kpis.phases}
              title="Phase headers in the journey"
            />
            <Metric
              label="Phase cards"
              value={insights.kpis.steps}
              title="Root steps on the map (should match phase columns)"
            />
          </>
        )}
        <Metric label="User actions" value={insights.kpis.nestedActions} />
      </dl>

      {insights.painHotspots.length > 0 ? (
        <section aria-labelledby="insights-pain-hotspots">
          <h4 id="insights-pain-hotspots" className={cn(SECTION_LABEL, "mb-2")}>
            Friction on map
          </h4>
          <ul className="space-y-1.5">
            {insights.painHotspots.map((h) => {
              const color = painSeverityColor(h.severity);
              return (
                <li key={h.stepId}>
                  <button
                    type="button"
                    onClick={() => focusStepOnMap(h.stepId, h.phaseTitle)}
                    aria-label={`Show on map: ${h.phaseTitle}, ${painSeverityLabel(h.severity)} friction`}
                    className="group flex w-full items-center gap-2 rounded-lg bg-surface px-2 py-2 text-left transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums"
                      style={{ backgroundColor: `${color}22`, color }}
                      aria-hidden
                    >
                      {h.severity}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-snug text-foreground line-clamp-1">
                        {h.phaseTitle}
                      </span>
                      <span className="block text-[11px] leading-snug text-on-surface-variant line-clamp-1">
                        {h.snippet}
                      </span>
                    </span>
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-brand opacity-70 group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {insights.kpis.opportunities > 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-950">
          <Lightbulb className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <p className="text-xs font-medium leading-snug">
            {insights.kpis.opportunities} journey-level opportunit{insights.kpis.opportunities === 1 ? "y" : "ies"}{" "}
            captured
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, title }: { label: string; value: number; title?: string }) {
  return (
    <div
      className="rounded-lg border border-border bg-surface px-2 py-2 text-center"
      title={title}
    >
      <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
      <dd className="text-sm font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function CoverageBar({
  score,
  barColor,
  trackColor,
}: {
  score: number;
  barColor: string;
  trackColor: string;
}) {
  return (
    <div>
      <div
        className="mb-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: trackColor }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Journey map coverage"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-xl font-bold tabular-nums leading-none" style={{ color: barColor }}>
        {score}%
        <span className="ml-1.5 text-xs font-normal text-on-surface-variant"> map coverage</span>
      </p>
    </div>
  );
}