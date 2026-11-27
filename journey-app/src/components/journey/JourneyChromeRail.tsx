"use client";

import { ChevronLeft, ChevronRight, Gauge, User } from "lucide-react";
import { PersonaRailPanel, type JourneyPersona } from "@/components/journey/PersonaRailPanel";
import type { JourneyInsights } from "@/lib/journey/buildJourneyInsights";
import { JourneyInsightsPanel } from "@/components/journey/JourneyInsightsPanel";
import { JourneyChromeRailScroll } from "@/components/journey/JourneyChromeRailScroll";
import { cn } from "@/lib/utils";
import { APP_HEADER_JOURNEY_PX } from "@/lib/layout/appHeader";
import { useJourneyChrome } from "@/components/journey/JourneyChromeContext";

export function JourneyChromeRail({
  journeyId,
  insights,
  personas,
}: {
  journeyId: string;
  insights: JourneyInsights;
  personas: JourneyPersona[];
}) {
  const { collapsed, toggleCollapsed, railWidth: width } = useJourneyChrome();

  return (
    <aside
      className={cn(
        "fixed z-50 flex min-w-0 flex-col overflow-x-hidden border-r border-border bg-surface shadow-[var(--elevation-2)] transition-[width] duration-200",
        collapsed ? "items-center px-1.5" : "px-0"
      )}
      style={{
        top: APP_HEADER_JOURNEY_PX,
        left: 0,
        width,
        height: `calc(100dvh - ${APP_HEADER_JOURNEY_PX}px)`,
      }}
      aria-label="Journey tools"
    >
      {!collapsed ? (
        <div className="flex w-full shrink-0 items-center px-3 pt-2 pb-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="m3-btn-icon shrink-0 border border-border hover:bg-surface-container"
            title="Collapse panel"
            aria-label="Collapse panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mt-2 mb-2 m3-btn-icon shrink-0 border border-border hover:bg-surface-container"
          title="Expand panel"
          aria-label="Expand panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {!collapsed && (
        <JourneyChromeRailScroll>
          <PersonaRailPanel journeyId={journeyId} personas={personas} readOnly />
          <JourneyInsightsPanel journeyId={journeyId} insights={insights} compact />
        </JourneyChromeRailScroll>
      )}

      {collapsed && (
        <div className="flex flex-col gap-2 items-center mt-2 flex-1 min-h-0">
          <div
            className="flex h-9 w-9 flex-col items-center justify-center rounded-md border border-border bg-surface text-brand"
            title={`${personas.length} persona(s)`}
          >
            <User className="h-3.5 w-3.5" aria-hidden />
            <span className="text-[9px] font-bold leading-none">{personas.length}</span>
          </div>
          <div
            className="flex h-9 w-9 flex-col items-center justify-center rounded-md border border-border bg-brand/5 text-brand"
            title={`Journey insights — ${insights.coverageScore}% · ${insights.coverageLabel}`}
          >
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            <span className="text-[9px] font-bold leading-none">{insights.coverageScore}%</span>
          </div>
        </div>
      )}
    </aside>
  );
}