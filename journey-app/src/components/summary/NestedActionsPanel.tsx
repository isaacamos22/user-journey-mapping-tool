import type { NestedActionView, NestedPhaseView } from "@/lib/journey/buildSummaryMetrics";
import { painSeverityColor, painSeverityLabel } from "@/lib/charts/chartSemantics";
import { SummaryTile } from "@/components/summary/SummaryTile";
import { SummaryStepReference } from "@/components/summary/SummaryStepReference";
import type { JourneyCoachTab } from "@/lib/completeness/journeyCoach";

function actionCoachTab(action: NestedActionView): JourneyCoachTab {
  if (action.painMax > 0) return "pains";
  if (action.feelingAvgFrustration != null) return "feelings";
  return "details";
}

function frustrationChip(score: number | null) {
  if (score == null) return null;
  const tone =
    score >= 5
      ? "text-red-700 bg-red-50 border-red-200"
      : score <= 3
        ? "text-teal-800 bg-teal-50 border-teal-200"
        : "text-amber-800 bg-amber-50 border-amber-200";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${tone}`}>
      Frustration {score.toFixed(1)}
    </span>
  );
}

export function NestedActionsPanel({
  phases,
  tiled,
  className,
  journeyId,
}: {
  phases: NestedPhaseView[];
  tiled?: boolean;
  className?: string;
  journeyId?: string;
}) {
  const body = (
    <div
      className={
        tiled
          ? "grid gap-3 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 max-h-[min(32rem,58vh)] overflow-y-auto pr-1"
          : "space-y-4"
      }
    >
      {phases.map((ph) => (
        <section
          key={ph.id}
          className={tiled ? "rounded-lg border border-border/70 bg-surface-container/40 p-3" : "space-y-2"}
        >
          <h4 className={`summary-tile-title text-brand ${tiled ? "mb-2" : ""}`}>{ph.title}</h4>
          <div className={tiled ? "space-y-1.5" : "grid gap-2"}>
            {ph.steps.map((step) => (
              <article
                key={step.id}
                className={
                  tiled
                    ? "rounded-lg border border-border/60 bg-white/80 px-3 py-2"
                    : "rounded-lg border border-border/80 bg-white/60 p-3"
                }
              >
                {journeyId ? (
                  <SummaryStepReference journeyId={journeyId} stepId={step.id} tab="details">
                    <p className={`m3-body font-semibold ${tiled ? "leading-snug" : ""}`}>
                      {step.userAction || step.title}
                    </p>
                  </SummaryStepReference>
                ) : (
                  <p className={`m3-body font-semibold ${tiled ? "leading-snug" : ""}`}>
                    {step.userAction || step.title}
                  </p>
                )}
                {step.actions.length ? (
                  <ul className={`${tiled ? "mt-2 space-y-2" : "mt-2 flex flex-col gap-1.5"}`}>
                    {step.actions.map((a) => {
                      const inner = (
                        <>
                          <p className="m3-body leading-snug">{a.userAction || a.title}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {a.painMax > 0 ? (
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-md text-white shrink-0"
                                style={{ backgroundColor: painSeverityColor(a.painMax) }}
                              >
                                Pain · {painSeverityLabel(a.painMax)}
                              </span>
                            ) : null}
                            {frustrationChip(a.feelingAvgFrustration)}
                            {a.assumed ? (
                              <span className="text-xs px-2 py-0.5 rounded-md border border-dashed border-slate-300 text-muted shrink-0">
                                Assumed
                              </span>
                            ) : null}
                          </div>
                        </>
                      );
                      const shellClass = tiled
                        ? "rounded-lg border border-border/50 bg-slate-50/90 px-3 py-2 hover:border-brand/30"
                        : "rounded-md bg-slate-50/80 px-2 py-1.5";
                      return (
                        <li key={a.id}>
                          {journeyId ? (
                            <SummaryStepReference
                              journeyId={journeyId}
                              stepId={a.id}
                              tab={actionCoachTab(a)}
                              field={a.painMax > 0 ? "pain" : undefined}
                              className={shellClass}
                            >
                              {inner}
                            </SummaryStepReference>
                          ) : (
                            <div className={shellClass}>{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : tiled ? null : (
                  <p className="text-xs text-muted mt-1">No nested actions on this step.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  if (tiled) {
    return (
      <SummaryTile title="Nested actions" hint="Click an action to open the editor" className={className}>
        {body}
      </SummaryTile>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <header>
        <h3 className="summary-tile-title">Nested actions</h3>
        <p className="summary-tile-hint mt-0.5">Per-phase flow with pain severity and feeling signals on each action.</p>
      </header>
      {body}
    </section>
  );
}