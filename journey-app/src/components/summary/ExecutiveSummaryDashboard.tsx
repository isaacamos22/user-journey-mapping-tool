"use client";

import { EmotionSparkline } from "@/components/charts/EmotionSparkline";
import { PainHeatmap } from "@/components/charts/PainHeatmap";
import { CompletenessDonut } from "@/components/charts/CompletenessDonut";
import { PhaseInsightChart } from "@/components/charts/PhaseInsightChart";
import { SummaryKpiStrip } from "@/components/summary/SummaryKpiStrip";
import { SectionCompletenessBars } from "@/components/summary/SectionCompletenessBars";
import { NestedActionsPanel } from "@/components/summary/NestedActionsPanel";
import { SummaryTile } from "@/components/summary/SummaryTile";
import { useSummaryStepModal } from "@/components/summary/SummaryStepModalHost";
import type {
  SummaryEmotionPoint,
  SummaryPainRow,
  SummaryPhaseInsight,
  SummaryKpis,
  NestedPhaseView,
} from "@/lib/journey/buildSummaryMetrics";
import type { CompletenessResult } from "@/lib/completeness/scoreJourney";

export type ExecutiveSummaryDashboardProps = {
  journeyId: string;
  emotionData: SummaryEmotionPoint[];
  painData: SummaryPainRow[];
  phaseInsights: SummaryPhaseInsight[];
  kpis: SummaryKpis;
  nestedPhases: NestedPhaseView[];
  completeness: Pick<CompletenessResult, "score" | "depth" | "gaps" | "bySection">;
};

export function ExecutiveSummaryDashboard({
  journeyId,
  emotionData,
  painData,
  phaseInsights,
  kpis,
  nestedPhases,
  completeness,
}: ExecutiveSummaryDashboardProps) {
  const { openStep } = useSummaryStepModal();
  const topGaps = completeness.gaps.filter((g) => g.severity === "warn").slice(0, 3);
  const showPhase = phaseInsights.some((p) => p.avgFrustration > 0 || p.avgPainSeverity > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="summary-page-lead">
        Click a chart point, pain bar, or nested action to open the step editor here.
      </p>

      <SummaryKpiStrip kpis={kpis} dense />

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <SummaryTile
          title="Emotion trend"
          hint="Click a point → feelings tab"
          className="min-w-0"
        >
          <EmotionSparkline
            data={emotionData}
            onStepSelect={(stepId) => openStep(stepId, "feelings")}
          />
        </SummaryTile>

        <SummaryTile title="Pain heatmap" hint="Click a bar → pains tab" className="min-w-0">
          <PainHeatmap
            data={painData}
            onStepSelect={(stepId) => openStep(stepId, "pains", "pain")}
          />
        </SummaryTile>
      </div>

      <div
        className={
          showPhase ? "grid min-w-0 gap-4 xl:grid-cols-2" : "grid min-w-0 grid-cols-1 gap-4"
        }
      >
        <SummaryTile title="Journey completeness" className="min-w-0">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="flex shrink-0 justify-center xl:justify-start">
              <CompletenessDonut score={completeness.score} depth={completeness.depth} size="md" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <SectionCompletenessBars bySection={completeness.bySection} />
              {topGaps.length ? (
                <div>
                <p className="summary-tile-hint font-semibold mb-1">Priority gaps</p>
                <ul className="space-y-2 summary-tile-hint text-foreground leading-snug">
                    {topGaps.map((g) => (
                      <li key={g.id} className="flex flex-col gap-0.5">
                        <span className="flex gap-2">
                          <span className="text-amber-600 shrink-0">●</span>
                          <span>{g.message}</span>
                        </span>
                        {g.coach?.stepId ? (
                          <button
                            type="button"
                            className="summary-link-button mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-brand/12 px-2 py-1 hover:bg-brand/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            onClick={() =>
                              openStep(g.coach!.stepId!, g.coach!.tab ?? "details", g.coach!.field)
                            }
                          >
                            Open step
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </SummaryTile>

        {showPhase ? (
          <SummaryTile
            title="Phase comparison"
            hint="Average frustration and pain severity"
            className="min-w-0"
          >
            <PhaseInsightChart data={phaseInsights} />
          </SummaryTile>
        ) : null}
      </div>

      <NestedActionsPanel
        phases={nestedPhases}
        tiled
        journeyId={journeyId}
        className="min-w-0 w-full"
      />
    </div>
  );
}