"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HEIGHT_BUCKET_PX = 8;
const DEBOUNCE_MS = 48;
const LAYOUT_HEIGHT_DEBOUNCE_MS = 180;

function bucketHeight(h: number): number {
  return Math.ceil(h / HEIGHT_BUCKET_PX) * HEIGHT_BUCKET_PX;
}

export type MapNodeHeightsResult = {
  heights: Record<string, number>;
  /** Re-read DOM heights after expand/collapse (allows cards to shrink). */
  requestRemeasure: () => void;
};

/** Measures rendered map card heights; tracks expand/collapse shrink as well as growth. */
export function useMapNodeHeights(
  stepIds: string[],
  resetKey: string,
  measureEnabled = true,
  surfaceSelector = ".journey-canvas",
  /** Stacked LOD: measure on settle / explicit remeasure only (avoids layout↔DOM feedback). */
  measureOnRequestOnly = false
): MapNodeHeightsResult {
  const idSet = useMemo(() => new Set(stepIds), [stepIds]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const rafRef = useRef(0);
  const debounceRef = useRef(0);
  const heightsRef = useRef(heights);
  const measureEnabledRef = useRef(measureEnabled);
  heightsRef.current = heights;
  measureEnabledRef.current = measureEnabled;

  useEffect(() => {
    setHeights({});
    heightsRef.current = {};
  }, [resetKey]);

  useEffect(() => {
    if (measureEnabled) return;
    cancelAnimationFrame(rafRef.current);
    window.clearTimeout(debounceRef.current);
  }, [measureEnabled]);

  const applyHeights = useCallback(
    (raw: Record<string, number>) => {
      if (!measureEnabledRef.current) return;
      const prev = heightsRef.current;
      const merged: Record<string, number> = { ...prev };
      let changed = false;
      for (const id of idSet) {
        const h = raw[id];
        if (h == null || h <= 0) continue;
        const next = bucketHeight(h);
        if (next !== prev[id]) {
          merged[id] = next;
          changed = true;
        }
      }
      if (!changed) return;
      heightsRef.current = merged;
      setHeights(merged);
    },
    [idSet]
  );

  const readHeights = useCallback((): Record<string, number> => {
    const root = document.querySelector(surfaceSelector);
    if (!root) return {};
    const next: Record<string, number> = {};
    root.querySelectorAll(".react-flow__node-journeyStep").forEach((nodeEl) => {
      const id = nodeEl.getAttribute("data-id");
      if (!id || !idSet.has(id)) return;
      const card = nodeEl.querySelector(".journey-map-node") as HTMLElement | null;
      const h = Math.ceil(card?.offsetHeight ?? (nodeEl as HTMLElement).offsetHeight);
      if (h > 0) next[id] = h;
    });
    return next;
  }, [idSet, surfaceSelector]);

  const collect = useCallback(
    (immediate = false) => {
      if (!measureEnabledRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!measureEnabledRef.current) return;
        const next = readHeights();
        window.clearTimeout(debounceRef.current);
        if (immediate) {
          applyHeights(next);
        } else {
          debounceRef.current = window.setTimeout(() => applyHeights(next), DEBOUNCE_MS);
        }
      });
    },
    [applyHeights, readHeights]
  );

  useEffect(() => {
    if (!measureEnabled) return;
    if (measureOnRequestOnly) return;

    const root = document.querySelector(surfaceSelector);
    if (!root) return;

    const observed = new WeakSet<Element>();
    const ro = new ResizeObserver(() => collect(false));

    const watchNodes = () => {
      root.querySelectorAll(".react-flow__node-journeyStep").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        const card = el.querySelector(".journey-map-node");
        const inner = el.querySelector(".group");
        ro.observe(el);
        if (card) ro.observe(card);
        if (inner && inner !== card) ro.observe(inner);
      });
    };

    const mo = new MutationObserver(() => {
      watchNodes();
      collect(false);
    });
    mo.observe(root, { childList: true, subtree: true });
    watchNodes();
    collect(false);

    return () => {
      mo.disconnect();
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(debounceRef.current);
    };
  }, [collect, surfaceSelector, idSet, measureEnabled, measureOnRequestOnly]);

  const requestRemeasure = useCallback(() => {
    if (!measureEnabledRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => collect(true));
    });
  }, [collect]);

  return { heights, requestRemeasure };
}

/** Debounce height map so graph relayout batches (reduces visible card stepping). */
export function useDebouncedLayoutHeights(
  heights: Record<string, number>,
  enabled: boolean,
  ms = LAYOUT_HEIGHT_DEBOUNCE_MS
): Record<string, number> {
  const [debounced, setDebounced] = useState(heights);
  const heightsRef = useRef(heights);
  heightsRef.current = heights;

  useEffect(() => {
    if (!enabled) {
      setDebounced(heights);
      return;
    }
    if (Object.keys(heights).length === 0) {
      setDebounced({});
      return;
    }
    const t = window.setTimeout(() => setDebounced(heightsRef.current), ms);
    return () => window.clearTimeout(t);
  }, [heights, enabled, ms]);

  return enabled ? debounced : heights;
}