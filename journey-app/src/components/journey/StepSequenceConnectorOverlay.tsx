"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  JOURNEY_CONNECTOR_STROKE,
  journeyConnectorPath,
  localPointInScope,
  rootStepCard,
  type ConnectorPoint,
} from "@/lib/journey/journeyConnectorGeometry";

export function StepSequenceConnectorOverlay({
  containerRef,
  stepIds,
  scale = 1,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  stepIds: string[];
  scale?: number;
}) {
  const stepKey = stepIds.join("\0");
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef("");

  const measureNow = useCallback(() => {
    const scope = containerRef.current;
    if (!scope || stepIds.length < 2) {
      if (lastSnapshotRef.current !== "") {
        lastSnapshotRef.current = "";
        setPaths([]);
      }
      return;
    }

    const nextW = scope.scrollWidth;
    const nextH = scope.scrollHeight;
    const next: { id: string; d: string }[] = [];

    for (let i = 0; i < stepIds.length - 1; i++) {
      const fromCard = rootStepCard(scope, stepIds[i]!);
      const toCard = rootStepCard(scope, stepIds[i + 1]!);
      if (!fromCard || !toCard) continue;

      const y =
        (localPointInScope(fromCard, scope, "center").y +
          localPointInScope(toCard, scope, "center").y) /
        2;
      const from: ConnectorPoint = {
        x: localPointInScope(fromCard, scope, "right").x,
        y,
      };
      const to: ConnectorPoint = {
        x: localPointInScope(toCard, scope, "left").x,
        y,
      };

      next.push({
        id: `seq-${stepIds[i]}-${stepIds[i + 1]}`,
        d: journeyConnectorPath(from, to, "direct"),
      });
    }

    const snapshot = `${nextW}|${nextH}|${next.map((p) => p.d).join(";")}`;
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;
    setSize({ w: nextW, h: nextH });
    setPaths(next);
  }, [containerRef, stepIds]);

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
  }, [containerRef, scale, scheduleMeasure, stepKey]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[3] overflow-visible"
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
          strokeOpacity={0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}