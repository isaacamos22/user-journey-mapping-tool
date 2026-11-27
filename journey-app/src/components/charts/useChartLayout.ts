"use client";

import { useEffect, useState, type RefObject } from "react";

export type ChartLayoutSize = "compact" | "default" | "lg";

export function chartLayoutSize(width: number): ChartLayoutSize {
  if (width < 400) return "compact";
  if (width < 620) return "default";
  return "lg";
}

/** Observes container width so charts can tighten axes before labels overlap. */
export function useChartLayout(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return { width, size: chartLayoutSize(width) };
}

export function pickChartSize(
  explicit: ChartLayoutSize | undefined,
  compact: boolean | undefined,
  observed: ChartLayoutSize
): ChartLayoutSize {
  if (explicit) return explicit;
  if (compact) return "compact";
  return observed;
}