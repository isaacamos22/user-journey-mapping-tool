"use client";

import { useCallback, useRef, useState } from "react";
import type { MapDetailLevel, MapTierTransition } from "@/lib/journey/mapDetailLevel";

/**
 * Manual map view LOD (detail / compact / overview). Instant layout — no staged CSS window.
 */
export function useMapDetailLevel(onViewLevelApplied?: () => void) {
  const settledRef = useRef(onViewLevelApplied);
  settledRef.current = onViewLevelApplied;

  const [detailLevel, setDetailLevel] = useState<MapDetailLevel>("detail");
  const [layoutDetailLevel, setLayoutDetailLevel] = useState<MapDetailLevel>("detail");
  const tierRef = useRef<MapDetailLevel>("detail");

  const setViewLevel = useCallback((next: MapDetailLevel) => {
    if (next === tierRef.current) return;

    tierRef.current = next;
    setDetailLevel(next);
    setLayoutDetailLevel(next);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => settledRef.current?.());
    });
  }, []);

  const tierTransition: MapTierTransition = "idle";

  return {
    detailLevel,
    layoutDetailLevel,
    tierTransition,
    setViewLevel,
  };
}