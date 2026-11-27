"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { JourneyCanvasSelectionProvider, useJourneyCanvasSelection } from "@/components/journey/JourneyCanvasSelectionContext";
import { JourneyCanvasTransformProvider } from "@/components/journey/JourneyCanvasTransformContext";
import { JOURNEY_COACH_PAN_EVENT } from "@/lib/completeness/journeyCoach";
import { MapPresenceLayer } from "@/components/journey/MapPresenceLayer";
import { useJourneyChromeOptional } from "@/components/journey/JourneyChromeContext";

export function PanZoomSurface({
  children,
  className,
  hint = "Drag to select · Drag actions to another step · Scroll to zoom · Middle-click pan",
  variant = "grid",
  initialFit = false,
}: {
  children: React.ReactNode;
  className?: string;
  hint?: string;
  variant?: "grid" | "white";
  /** Center and scale journey map content on first layout (workspace). */
  initialFit?: boolean;
}) {
  return (
    <JourneyCanvasSelectionProvider>
      <PanZoomSurfaceInner
        className={className}
        hint={hint}
        variant={variant}
        initialFit={initialFit}
      >
        {children}
      </PanZoomSurfaceInner>
    </JourneyCanvasSelectionProvider>
  );
}

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: DOMRect
) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/** Pinch / trackpad deltas are usually small pixel steps; line mode mouse wheel is not. */
function wheelDeltaYPixels(e: WheelEvent): number {
  switch (e.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return e.deltaY * 16;
    case WheelEvent.DOM_DELTA_PAGE:
      return e.deltaY * (typeof window !== "undefined" ? window.innerHeight : 800);
    default:
      return e.deltaY;
  }
}

function pinchWheelZoomFactor(e: WheelEvent): number {
  const dy = wheelDeltaYPixels(e);
  const clamped = Math.max(-140, Math.min(140, dy));
  const factor = 1 - clamped * 0.0075;
  return Math.max(0.78, Math.min(1.28, factor));
}

/** Mouse wheel (line mode) and trackpad scroll — zoom only, no pan. */
function scrollWheelZoomFactor(e: WheelEvent): number {
  const dy = wheelDeltaYPixels(e);
  const clamped = Math.max(-160, Math.min(160, dy));
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return Math.exp(-e.deltaY * 0.002);
  }
  const factor = 1 - clamped * 0.0045;
  return Math.max(0.82, Math.min(1.18, factor));
}

function localOffsetWithin(ancestor: HTMLElement, el: HTMLElement) {
  let left = 0;
  let top = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== ancestor) {
    left += cur.offsetLeft;
    top += cur.offsetTop;
    const parent = cur.offsetParent as HTMLElement | null;
    if (!parent || !ancestor.contains(parent)) break;
    cur = parent;
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}

function PanZoomSurfaceInner({
  children,
  className,
  hint,
  variant,
  initialFit,
}: {
  children: React.ReactNode;
  className?: string;
  hint: string;
  variant: "grid" | "white";
  initialFit: boolean;
}) {
  const chrome = useJourneyChromeOptional();
  const hintInsetLeft = (chrome?.railWidth ?? 0) + 12;
  const hintMaxWidth = chrome
    ? `min(420px, calc(100vw - ${chrome.railWidth + 120}px))`
    : "min(420px, 70vw)";

  const containerRef = useRef<HTMLDivElement>(null);
  const contentLayerRef = useRef<HTMLDivElement>(null);
  const didInitialFitRef = useRef(false);
  const [scale, setScale] = useState(0.92);
  const [pan, setPan] = useState({ x: 48, y: 32 });
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  const transformTargetRef = useRef({ scale: 0.92, pan: { x: 48, y: 32 } });
  const zoomAnimRef = useRef<number | null>(null);
  const panDragging = useRef(false);
  const selectDragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const selectStart = useRef({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const { selectedIds, setSelectedIds, clearSelection } = useJourneyCanvasSelection();
  const shiftAdditiveRef = useRef(false);
  const selectionAtMarqueeStartRef = useRef<Set<string>>(new Set());
  const marqueeRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  scaleRef.current = scale;
  panRef.current = pan;

  const clampScale = (s: number) => Math.min(1.6, Math.max(0.35, s));

  const prefersReducedMotion = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const applyTransformNow = useCallback((nextScale: number, nextPan: { x: number; y: number }) => {
    if (zoomAnimRef.current !== null) {
      cancelAnimationFrame(zoomAnimRef.current);
      zoomAnimRef.current = null;
    }
    scaleRef.current = nextScale;
    panRef.current = nextPan;
    transformTargetRef.current = { scale: nextScale, pan: nextPan };
    setScale(nextScale);
    setPan(nextPan);
  }, []);

  const runZoomAnimation = useCallback(() => {
    const step = () => {
      const target = transformTargetRef.current;
      const s = scaleRef.current;
      const p = panRef.current;
      const t = 0.28;
      const nextScale = s + (target.scale - s) * t;
      const nextPan = {
        x: p.x + (target.pan.x - p.x) * t,
        y: p.y + (target.pan.y - p.y) * t,
      };
      const scaleDone = Math.abs(nextScale - target.scale) < 0.0008;
      const panDone =
        Math.abs(nextPan.x - target.pan.x) < 0.35 && Math.abs(nextPan.y - target.pan.y) < 0.35;
      const finalScale = scaleDone ? target.scale : nextScale;
      const finalPan = panDone ? target.pan : nextPan;
      scaleRef.current = finalScale;
      panRef.current = finalPan;
      setScale(finalScale);
      setPan(finalPan);
      if (scaleDone && panDone) {
        zoomAnimRef.current = null;
        return;
      }
      zoomAnimRef.current = requestAnimationFrame(step);
    };
    if (zoomAnimRef.current !== null) return;
    zoomAnimRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    return () => {
      if (zoomAnimRef.current !== null) cancelAnimationFrame(zoomAnimRef.current);
    };
  }, []);

  const isInteractiveTarget = (target: EventTarget | null) => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    if (el.closest("input, textarea, select, a, button, [role='slider']")) return true;
    if (el.closest("[data-journey-no-drag]")) return true;
    if (el.closest("[data-journey-root-drag]")) return true;
    if (el.closest("[data-journey-sortable]")) return true;
    if (el.closest("[data-journey-step-id]")) return true;
    if (el.closest("[data-pan-zoom-chrome]")) return true;
    return false;
  };

  /** If the wheel target is inside a scrollable card/region, let the browser scroll it instead of zooming. */
  const shouldHandleWheelAsZoom = useCallback((e: WheelEvent, container: HTMLElement) => {
    let node: HTMLElement | null = e.target instanceof HTMLElement ? e.target : null;
    while (node && node !== container) {
      if (node.hasAttribute("data-journey-scroll")) {
        const canScrollY = node.scrollHeight > node.clientHeight + 1;
        const canScrollX = node.scrollWidth > node.clientWidth + 1;
        if (!canScrollY && !canScrollX) {
          node = node.parentElement;
          continue;
        }
        const atTop = node.scrollTop <= 0;
        const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
        const atLeft = node.scrollLeft <= 0;
        const atRight = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
        const down = e.deltaY > 0;
        const up = e.deltaY < 0;
        const right = e.deltaX > 0;
        const left = e.deltaX < 0;
        if (canScrollY && ((down && !atBottom) || (up && !atTop))) return false;
        if (canScrollX && ((right && !atRight) || (left && !atLeft))) return false;
      } else {
        const style = getComputedStyle(node);
        const oy = style.overflowY;
        const ox = style.overflowX;
        const scrollableY =
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          node.scrollHeight > node.clientHeight + 1;
        const scrollableX =
          (ox === "auto" || ox === "scroll" || ox === "overlay") &&
          node.scrollWidth > node.clientWidth + 1;
        if (scrollableY || scrollableX) {
          const atTop = node.scrollTop <= 0;
          const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
          const atLeft = node.scrollLeft <= 0;
          const atRight = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
          const down = e.deltaY > 0;
          const up = e.deltaY < 0;
          const right = e.deltaX > 0;
          const left = e.deltaX < 0;
          if (scrollableY && ((down && !atBottom) || (up && !atTop))) return false;
          if (scrollableX && ((right && !atRight) || (left && !atLeft))) return false;
        }
      }
      node = node.parentElement;
    }
    return true;
  }, []);

  const zoomAtPointer = useCallback(
    (clientX: number, clientY: number, factor: number, smooth = true) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const s = transformTargetRef.current.scale;
      const p = transformTargetRef.current.pan;
      const nextScale = clampScale(s * factor);
      if (nextScale === s) return;

      const worldX = (px - p.x) / s;
      const worldY = (py - p.y) / s;
      const nextPan = {
        x: px - worldX * nextScale,
        y: py - worldY * nextScale,
      };

      transformTargetRef.current = { scale: nextScale, pan: nextPan };
      if (!smooth || prefersReducedMotion()) {
        applyTransformNow(nextScale, nextPan);
        return;
      }
      runZoomAnimation();
    },
    [applyTransformNow, runZoomAnimation]
  );

  const visibleViewportCenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const railInset = chrome?.railWidth ?? 0;
    const pad = 40;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const left = railInset + pad;
    const right = vw - pad;
    const top = pad;
    const bottom = vh - pad;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + left + Math.max(0, right - left) / 2,
      y: rect.top + top + Math.max(0, bottom - top) / 2,
    };
  }, [chrome?.railWidth]);

  const zoomAtCenter = useCallback(
    (factor: number) => {
      const center = visibleViewportCenter();
      if (!center) return;
      zoomAtPointer(center.x, center.y, factor, false);
    },
    [zoomAtPointer, visibleViewportCenter]
  );

  const fitContentToView = useCallback(
    (smooth = false) => {
      const container = containerRef.current;
      const layer = contentLayerRef.current;
      if (!container || !layer) return false;

      const fitEl = layer.querySelector<HTMLElement>("[data-pan-zoom-fit-content]");
      const viewportPad = 40;
      const railInset = chrome?.railWidth ?? 0;
      const vw = container.clientWidth;
      const vh = container.clientHeight;
      if (vw < 1 || vh < 1) return false;

      const visibleLeft = railInset + viewportPad;
      const visibleRight = vw - viewportPad;
      const visibleTop = viewportPad;
      const visibleBottom = vh - viewportPad;
      const availW = Math.max(1, visibleRight - visibleLeft);
      const availH = Math.max(1, visibleBottom - visibleTop);

      let box: { left: number; top: number; width: number; height: number };
      if (fitEl && fitEl.offsetWidth > 0 && fitEl.offsetHeight > 0) {
        box = localOffsetWithin(layer, fitEl);
      } else {
        box = { left: 0, top: 0, width: layer.scrollWidth, height: layer.scrollHeight };
      }

      if (box.width < 1 || box.height < 1) return false;

      const scaleX = availW / box.width;
      const scaleY = availH / box.height;
      const nextScale = clampScale(Math.min(scaleX, scaleY, 1.05));
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const centerX = visibleLeft + availW / 2;
      const centerY = visibleTop + availH / 2;
      const nextPan = {
        x: centerX - cx * nextScale,
        y: centerY - cy * nextScale,
      };

      transformTargetRef.current = { scale: nextScale, pan: nextPan };
      if (!smooth || prefersReducedMotion()) {
        applyTransformNow(nextScale, nextPan);
        return true;
      }
      runZoomAnimation();
      return true;
    },
    [applyTransformNow, runZoomAnimation, chrome?.railWidth]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!shouldHandleWheelAsZoom(e, el)) return;
      e.preventDefault();

      const pinchZoom = e.ctrlKey || e.metaKey;
      const factor = pinchZoom ? pinchWheelZoomFactor(e) : scrollWheelZoomFactor(e);
      zoomAtPointer(e.clientX, e.clientY, factor, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAtPointer, shouldHandleWheelAsZoom]);

  const applyMarqueeSelection = useCallback(
    (box: { left: number; top: number; right: number; bottom: number }) => {
      const root = containerRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const screenBox = {
        left: rootRect.left + box.left,
        top: rootRect.top + box.top,
        right: rootRect.left + box.right,
        bottom: rootRect.top + box.bottom,
      };
      const hits = new Set<string>();
      root.querySelectorAll<HTMLElement>("[data-journey-step-id]").forEach((el) => {
        const id = el.getAttribute("data-journey-step-id");
        if (!id) return;
        if (!rectsIntersect(screenBox, el.getBoundingClientRect())) return;
        hits.add(id);
        const column = el.closest("[data-journey-step-column]");
        column?.querySelectorAll<HTMLElement>("[data-journey-step-id]").forEach((peer) => {
          const peerId = peer.getAttribute("data-journey-step-id");
          if (peerId) hits.add(peerId);
        });
      });
      if (shiftAdditiveRef.current) {
        const merged = new Set(selectionAtMarqueeStartRef.current);
        hits.forEach((id) => merged.add(id));
        setSelectedIds(merged);
      } else {
        setSelectedIds(hits);
      }
    },
    [setSelectedIds]
  );

  const onContainerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        panDragging.current = true;
        setIsPanning(true);
        last.current = { x: e.clientX, y: e.clientY };
        containerRef.current?.setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      shiftAdditiveRef.current = e.shiftKey;
      selectionAtMarqueeStartRef.current = new Set(selectedIds);

      selectDragging.current = true;
      selectStart.current = { x, y };
      const initial = { left: x, top: y, width: 0, height: 0 };
      marqueeRef.current = initial;
      setMarquee(initial);
      e.preventDefault();
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [selectedIds]
  );

  const onContainerPointerMove = useCallback((e: React.PointerEvent) => {
    if (panDragging.current) {
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      setPan((p) => {
        const next = { x: p.x + dx, y: p.y + dy };
        panRef.current = next;
        transformTargetRef.current = {
          ...transformTargetRef.current,
          pan: next,
        };
        return next;
      });
      return;
    }

    if (!selectDragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const x0 = selectStart.current.x;
    const y0 = selectStart.current.y;
    const left = Math.min(x0, x);
    const top = Math.min(y0, y);
    const width = Math.abs(x - x0);
    const height = Math.abs(y - y0);
    const next = { left, top, width, height };
    marqueeRef.current = next;
    setMarquee(next);
  }, []);

  const onContainerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }

      if (panDragging.current) {
        panDragging.current = false;
        setIsPanning(false);
        return;
      }

      if (!selectDragging.current) return;
      selectDragging.current = false;

      const box = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      if (!box || (box.width < 4 && box.height < 4)) {
        if (!shiftAdditiveRef.current) clearSelection();
        return;
      }

      applyMarqueeSelection({
        left: box.left,
        top: box.top,
        right: box.left + box.width,
        bottom: box.top + box.height,
      });
    },
    [applyMarqueeSelection, clearSelection]
  );

  const resetView = () => {
    if (!fitContentToView(true)) {
      transformTargetRef.current = { scale: 0.92, pan: { x: 48, y: 32 } };
      if (prefersReducedMotion()) {
        applyTransformNow(0.92, { x: 48, y: 32 });
        return;
      }
      runZoomAnimation();
    }
  };

  useEffect(() => {
    if (!initialFit || didInitialFitRef.current) return;
    const run = () => {
      if (fitContentToView(false)) didInitialFitRef.current = true;
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const container = containerRef.current;
    if (!container) return () => cancelAnimationFrame(id);

    const ro = new ResizeObserver(() => {
      if (didInitialFitRef.current) return;
      requestAnimationFrame(run);
    });
    ro.observe(container);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [initialFit, fitContentToView]);

  useEffect(() => {
    if (!initialFit || !didInitialFitRef.current) return;
    fitContentToView(false);
  }, [chrome?.railWidth, initialFit, fitContentToView]);

  useEffect(() => {
    const onPanToStep = (event: Event) => {
      const stepId = (event as CustomEvent<{ stepId: string }>).detail?.stepId;
      const root = containerRef.current;
      if (!stepId || !root) return;
      const el = root.querySelector<HTMLElement>(
        `[data-journey-step-id="${CSS.escape(stepId)}"]`
      );
      if (!el) return;
      const cr = root.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const dx = cr.left + cr.width / 2 - (er.left + er.width / 2);
      const dy = cr.top + cr.height / 2 - (er.top + er.height / 2);
      const s = scaleRef.current;
      const next = {
        x: panRef.current.x + dx / s,
        y: panRef.current.y + dy / s,
      };
      transformTargetRef.current = { scale: scaleRef.current, pan: next };
      if (prefersReducedMotion()) {
        applyTransformNow(scaleRef.current, next);
        return;
      }
      runZoomAnimation();
    };
    window.addEventListener(JOURNEY_COACH_PAN_EVENT, onPanToStep);
    return () => window.removeEventListener(JOURNEY_COACH_PAN_EVENT, onPanToStep);
  }, [applyTransformNow, runZoomAnimation]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden select-none",
        isPanning ? "cursor-grabbing" : "cursor-default",
        variant === "white"
          ? "bg-white"
          : "rounded-xl border border-border bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] [background-size:20px_20px]",
        className
      )}
      onPointerDown={onContainerPointerDown}
      onPointerMove={onContainerPointerMove}
      onPointerUp={onContainerPointerUp}
      onPointerCancel={onContainerPointerUp}
    >
      <div
        data-pan-zoom-chrome
        className="absolute top-3 right-3 z-40 flex flex-col gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-sm"
      >
        <MapControlButton title="Zoom in" onClick={() => zoomAtCenter(1.12)}>
          <Plus className="h-4 w-4" />
        </MapControlButton>
        <MapControlButton title="Zoom out" onClick={() => zoomAtCenter(1 / 1.12)}>
          <Minus className="h-4 w-4" />
        </MapControlButton>
        <MapControlButton title="Fit content to view" onClick={resetView}>
          <Maximize2 className="h-4 w-4" />
        </MapControlButton>
      </div>

      <div
        data-pan-zoom-chrome
        className="absolute bottom-3 z-40 m3-panel pointer-events-none max-w-[min(420px,calc(100vw-6rem))] bg-surface/95 px-3 py-2 m3-caption shadow-sm backdrop-blur-sm leading-snug text-pretty transition-[left,max-width] duration-200 ease-out"
        style={{ left: hintInsetLeft, maxWidth: hintMaxWidth }}
        role="note"
        aria-label={hint}
      >
        <p className="hidden sm:block">{hint}</p>
        <p className="sm:hidden">Scroll to zoom · Middle-click pan</p>
      </div>

      <div
        data-pan-zoom-chrome
        className="absolute bottom-3 right-3 z-40 m3-panel px-3 py-1.5 text-sm font-semibold text-brand tabular-nums"
      >
        {Math.round(scale * 100)}%
      </div>

      {marquee && marquee.width + marquee.height > 0 ? (
        <div
          className="pointer-events-none absolute z-30 border-2 border-brand bg-brand/10"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height,
          }}
          aria-hidden
        />
      ) : null}

      <MapPresenceLayer containerRef={containerRef} />

      <div className="h-full w-full [&_input]:cursor-text [&_textarea]:cursor-text [&_button]:cursor-pointer [&_[data-journey-root-drag]]:cursor-grab [&_[data-journey-sortable='action']]:cursor-grab">
        <div
          ref={contentLayerRef}
          className="origin-top-left p-8 min-h-full w-max max-w-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <JourneyCanvasTransformProvider scale={scale}>{children}</JourneyCanvasTransformProvider>
        </div>
      </div>
    </div>
  );
}

function MapControlButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-canvas",
        active && "bg-brand/10 text-brand ring-1 ring-brand/30"
      )}
    >
      {children}
    </button>
  );
}