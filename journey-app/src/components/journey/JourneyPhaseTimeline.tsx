"use client";

import { useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasStep } from "@/components/journey/JourneyCanvas";

export type PhaseNavItem = {
  title: string;
  rootStepId: string;
  index: number;
};

export function buildPhaseNav(steps: CanvasStep[], phaseTitles?: string[]): PhaseNavItem[] {
  const roots = steps
    .filter((s) => !s.parentStepId)
    .sort((a, b) => a.order - b.order);

  const titles =
    phaseTitles?.length ?
      phaseTitles
    : (() => {
        const seen = new Set<string>();
        const order: string[] = [];
        for (const s of roots) {
          if (seen.has(s.phaseTitle)) continue;
          seen.add(s.phaseTitle);
          order.push(s.phaseTitle);
        }
        return order;
      })();

  return titles
    .map((title, index) => {
      const root = roots.find((r) => r.phaseTitle === title) ?? roots[index];
      if (!root) return null;
      return { title, rootStepId: root.id, index };
    })
    .filter((x): x is PhaseNavItem => Boolean(x));
}

export function activePhaseIndex(
  focusStepId: string | null | undefined,
  steps: CanvasStep[],
  nav: PhaseNavItem[]
): number {
  if (!nav.length) return 0;
  if (!focusStepId) return 0;
  const step = steps.find((s) => s.id === focusStepId);
  const phaseTitle = step?.phaseTitle;
  if (!phaseTitle) return 0;
  const idx = nav.findIndex((p) => p.title === phaseTitle);
  return idx >= 0 ? idx : 0;
}

type JourneyPhaseTimelineProps = {
  steps: CanvasStep[];
  phaseTitles?: string[];
  focusStepId: string | null;
  onFocusPhase: (rootStepId: string) => void;
  className?: string;
};

export function JourneyPhaseTimeline({
  steps,
  phaseTitles,
  focusStepId,
  onFocusPhase,
  className,
}: JourneyPhaseTimelineProps) {
  const nav = useMemo(() => buildPhaseNav(steps, phaseTitles), [steps, phaseTitles]);
  const current = activePhaseIndex(focusStepId, steps, nav);

  const goTo = useCallback(
    (index: number) => {
      const item = nav[index];
      if (!item) return;
      onFocusPhase(item.rootStepId);
    },
    [nav, onFocusPhase]
  );

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  const next = useCallback(() => {
    if (current < nav.length - 1) goTo(current + 1);
  }, [current, goTo, nav.length]);

  if (nav.length < 2) return null;

  return (
    <nav
      className={cn("journey-phase-timeline", className)}
      aria-label="Journey phases"
    >
      <button
        type="button"
        onClick={prev}
        disabled={current <= 0}
        className="journey-phase-timeline-arrow"
        aria-label="Previous phase"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </button>

      <div className="journey-phase-timeline-rail overlay-scrollbar">
        <ol className="journey-phase-timeline-track">
          {nav.map((item, i) => {
            const active = i === current;
            return (
              <li key={item.rootStepId} className="journey-phase-timeline-step">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn("journey-phase-timeline-segment", active && "is-active")}
                  aria-current={active ? "step" : undefined}
                  title={item.title}
                >
                  <span className="journey-phase-timeline-segment-label">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        onClick={next}
        disabled={current >= nav.length - 1}
        className="journey-phase-timeline-arrow"
        aria-label="Next phase"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </button>
    </nav>
  );
}