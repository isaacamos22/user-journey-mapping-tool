"use client";

import { useEffect, type RefObject } from "react";
import {
  mapViewTypographicScale,
  type MapDetailLevel,
} from "@/lib/journey/mapDetailLevel";

/** Sets `--map-readability-scale` from view tier only (not viewport zoom). */
export function useMapViewReadabilityScale(
  canvasRef: RefObject<HTMLElement | null>,
  viewLevel: MapDetailLevel
) {
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.style.setProperty(
      "--map-readability-scale",
      String(mapViewTypographicScale(viewLevel))
    );
  }, [canvasRef, viewLevel]);
}