"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  JOURNEY_CONNECTOR_DASH,
  JOURNEY_CONNECTOR_STROKE,
  actionStepCard,
  buildClassicActionTreePaths,
  journeyConnectorPath,
  localPointInScope,
  rootStepCard,
  treeSpineX,
} from "@/lib/journey/journeyConnectorGeometry";

export type ActionFlowColumnSpec = {
  parentStepId: string;
  actionRuns: string[][];
};

export function JourneyActionFlowOverlay({
  containerRef,
  columns,
  scale = 1,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  columns: ActionFlowColumnSpec[];
  scale?: number;
}) {
  const key = columns
    .map((c) => `${c.parentStepId}:${c.actionRuns.map((r) => r.join(",")).join("|")}`)
    .join(";");
  const [paths, setPaths] = useState<{ id: string; d: string; dash?: boolean }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef("");

  const measureNow = useCallback(() => {
    const scope = containerRef.current;
    if (!scope || columns.length === 0) {
      lastSnapshotRef.current = "";
      setPaths([]);
      return;
    }

    const next: { id: string; d: string; dash?: boolean }[] = [];

    for (const { parentStepId, actionRuns } of columns) {
      if (actionRuns.length === 0) continue;

      const columnEl = scope.querySelector<HTMLElement>(
        `[data-journey-column-id="${CSS.escape(parentStepId)}"]`
      );
      const treeEl = columnEl?.querySelector<HTMLElement>("[data-journey-action-tree]");
      const parentCard = rootStepCard(scope, parentStepId);
      if (!parentCard || !treeEl) continue;

      const parentCenterX = localPointInScope(parentCard, scope, "center").x;
      const parentBottomY = localPointInScope(parentCard, scope, "bottom").y - 1;
      const spineX = treeSpineX(treeEl, scope);

      const branches: { rowY: number; cardLeftX: number }[] = [];
      for (const run of actionRuns) {
        const firstId = run[0];
        if (!firstId) continue;
        const card = actionStepCard(scope, firstId);
        if (!card) continue;
        branches.push({
          rowY: localPointInScope(card, scope, "center").y,
          cardLeftX: localPointInScope(card, scope, "left").x - 4,
        });
      }

      for (const [i, d] of buildClassicActionTreePaths(
        parentCenterX,
        parentBottomY,
        spineX,
        branches
      ).entries()) {
        next.push({ id: `tree-${parentStepId}-${i}`, d, dash: true });
      }

      for (const run of actionRuns) {
        for (let i = 0; i < run.length - 1; i++) {
          const a = actionStepCard(scope, run[i]!);
          const b = actionStepCard(scope, run[i + 1]!);
          if (!a || !b) continue;
          const from = localPointInScope(a, scope, "right");
          const to = localPointInScope(b, scope, "left");
          from.y = localPointInScope(a, scope, "center").y;
          to.y = localPointInScope(b, scope, "center").y;
          next.push({
            id: `sib-${run[i]}-${run[i + 1]}`,
            d: journeyConnectorPath(from, to, "direct"),
          });
        }
      }
    }

    const nextW = scope.scrollWidth;
    const nextH = scope.scrollHeight;
    const snapshot = `${nextW}|${nextH}|${next.map((p) => p.d).join(";")}`;
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;
    setSize({ w: nextW, h: nextH });
    setPaths(next);
  }, [columns, containerRef]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      measureNow();
    });
  }, [measureNow]);

  useEffect(() => {
    scheduleMeasure();
    const scope = containerRef.current;
    if (!scope) return;
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(scope);
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ro.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [containerRef, key, scale, scheduleMeasure]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] overflow-visible"
      width={size.w}
      height={size.h}
      aria-hidden
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={JOURNEY_CONNECTOR_STROKE}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeOpacity={p.dash ? 0.4 : 0.55}
          strokeDasharray={p.dash ? JOURNEY_CONNECTOR_DASH : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}