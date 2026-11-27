"use client";

import { createContext, useContext } from "react";
import type { CanvasStep, DiscoveryScopePickHandlers, MapCanvasEngagement } from "@/components/journey/JourneyCanvas";
import type { MapDetailLevel, MapTierTransition } from "@/lib/journey/mapDetailLevel";

export type MapCanvasContextValue = {
  getStep: (id: string) => CanvasStep | undefined;
  childCount: (parentId: string) => number;
  focusHighlightText?: string | null;
  discoveryScopePick?: DiscoveryScopePickHandlers | null;
  mapEngagement?: MapCanvasEngagement;
  detailLevel?: MapDetailLevel;
  layoutDetailLevel?: MapDetailLevel;
  tierTransition?: MapTierTransition;
  /** Switch detail / combined / overview without changing viewport zoom. */
  setViewLevel?: (level: MapDetailLevel) => void;
  onSelectStep?: (stepId: string) => void;
  /** After phase-card sections expand/collapse, re-measure so action lanes move up. */
  requestLayoutRemeasure?: () => void;
};

const MapCanvasContext = createContext<MapCanvasContextValue | null>(null);

export function MapCanvasProvider({
  value,
  children,
}: {
  value: MapCanvasContextValue;
  children: React.ReactNode;
}) {
  return <MapCanvasContext.Provider value={value}>{children}</MapCanvasContext.Provider>;
}

export function useMapCanvas(): MapCanvasContextValue | null {
  return useContext(MapCanvasContext);
}