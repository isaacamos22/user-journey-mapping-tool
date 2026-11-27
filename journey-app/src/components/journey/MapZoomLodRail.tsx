"use client";

import { useMemo } from "react";
import { Panel, useStore } from "reactflow";
import { cn } from "@/lib/utils";
import { useMapCanvas } from "@/components/journey/mapCanvasContext";
import { MAP_ZOOM_TIER_STOPS, type MapDetailLevel } from "@/lib/journey/mapDetailLevel";

function activeStopIndex(detailLevel: MapDetailLevel): number {
  return MAP_ZOOM_TIER_STOPS.findIndex((s) => s.level === detailLevel);
}

export function MapZoomLodRail() {
  const ctx = useMapCanvas();
  const zoom = useStore((s) => s.transform[2]);
  const detailLevel = ctx?.detailLevel ?? "detail";
  const tierTransition = ctx?.tierTransition ?? "idle";
  const setViewLevel = ctx?.setViewLevel;

  const activeIndex = useMemo(() => {
    const idx = activeStopIndex(detailLevel);
    return idx >= 0 ? idx : 0;
  }, [detailLevel]);

  return (
    <Panel position="top-left" className="journey-map-zoom-lod-rail nopan nodrag">
      <header className="journey-map-zoom-lod-rail-head">
        <span className="journey-map-zoom-lod-rail-kicker">View</span>
        <span className="journey-map-zoom-lod-rail-zoom tabular-nums" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
      </header>

      <div
        className={cn(
          "journey-map-zoom-lod-segments",
          tierTransition !== "idle" && "journey-map-zoom-lod-segments--transitioning"
        )}
        role="listbox"
        aria-label="Map detail level"
        style={{ ["--lod-active" as string]: String(activeIndex) }}
      >
        <div className="journey-map-zoom-lod-segments-thumb" aria-hidden />
        {MAP_ZOOM_TIER_STOPS.map((stop) => {
          const isActive = stop.level === detailLevel;
          return (
            <button
              key={stop.level}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={`${stop.label}: ${stop.hint}`}
              title={stop.hint}
              className={cn("journey-map-zoom-lod-segment", isActive && "journey-map-zoom-lod-segment--active")}
              onClick={() => {
                if (!isActive) setViewLevel?.(stop.level);
              }}
            >
              <span className="journey-map-zoom-lod-segment-label">{stop.label}</span>
              <span className="journey-map-zoom-lod-segment-hint">{stop.hint}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}