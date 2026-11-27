"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlowLink } from "@/lib/journey/flowLinks";

type Point = { x: number; y: number };

function anchorForCard(rect: DOMRect, rootRect: DOMRect, side: "out" | "in"): Point {
  const x =
    side === "out"
      ? rect.right - rootRect.left
      : rect.left - rootRect.left;
  return {
    x,
    y: rect.top - rootRect.top + rect.height / 2,
  };
}

function curvedPath(from: Point, to: Point, lane: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const spread = 48 + lane * 18;

  if (horizontal) {
    const c1x = from.x + dx * 0.35;
    const c2x = from.x + dx * 0.65;
    const c1y = from.y + spread;
    const c2y = to.y - spread;
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  const c1y = from.y + dy * 0.35;
  const c2y = from.y + dy * 0.65;
  const c1x = from.x + spread * (lane % 2 === 0 ? 1 : -1);
  const c2x = to.x - spread * (lane % 2 === 0 ? 1 : -1);
  return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
}

export function JourneyFlowLinkOverlay({
  containerRef,
  links,
  scale = 1,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  links: FlowLink[];
  scale?: number;
}) {
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef("");

  const measureNow = useCallback(() => {
    const root = containerRef.current;
    if (!root || links.length === 0) {
      if (lastSnapshotRef.current !== "") {
        lastSnapshotRef.current = "";
        setPaths([]);
      }
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const nextW = root.scrollWidth;
    const nextH = root.scrollHeight;

    const next: { id: string; d: string }[] = [];
    links.forEach((link, lane) => {
      const fromEl = root.querySelector<HTMLElement>(
        `[data-journey-step-id="${CSS.escape(link.fromStepId)}"]`
      );
      const toEl = root.querySelector<HTMLElement>(
        `[data-journey-step-id="${CSS.escape(link.toStepId)}"]`
      );
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const from = anchorForCard(fromRect, rootRect, "out");
      const to = anchorForCard(toRect, rootRect, "in");

      from.x /= scale;
      from.y /= scale;
      to.x /= scale;
      to.y /= scale;

      next.push({
        id: `${link.fromStepId}-${link.toStepId}`,
        d: curvedPath(from, to, lane),
      });
    });
    const snapshot = `${nextW}|${nextH}|${next.map((p) => p.d).join(";")}`;
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;
    setSize({ w: nextW, h: nextH });
    setPaths(next);
  }, [containerRef, links, scale]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      measureNow();
    });
  }, [measureNow]);

  useEffect(() => {
    scheduleMeasure();
    const root = containerRef.current;
    if (!root) return;

    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(root);
    window.addEventListener("resize", scheduleMeasure, { passive: true });

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      ro.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [containerRef, links.length, scheduleMeasure, scale]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
      width={size.w}
      height={size.h}
      aria-hidden
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke="var(--color-brand, #0014dc)"
          strokeWidth={2}
          strokeOpacity={0.55}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}