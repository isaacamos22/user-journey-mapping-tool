"use client";

import { useEffect, useRef } from "react";
import { useOthers, useUpdateMyPresence } from "@liveblocks/react";
import { useJourneyLiveEnabled } from "@/components/journey/JourneyLiveRoom";

type CursorPresence = {
  cursor: { x: number; y: number } | null;
};

export function MapPresenceLayer({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const live = useJourneyLiveEnabled();
  if (!live) return null;
  return <MapPresenceLayerInner containerRef={containerRef} />;
}

function MapPresenceLayerInner({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();
  const throttleRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const now = Date.now();
      if (now - throttleRef.current < 32) return;
      throttleRef.current = now;
      const rect = el.getBoundingClientRect();
      updateMyPresence({
        cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
    };
    const onLeave = () => updateMyPresence({ cursor: null });

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [containerRef, updateMyPresence]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[35] overflow-hidden" aria-hidden>
      {others.map((other) => {
        const presence = other.presence as CursorPresence;
        const c = presence?.cursor;
        if (!c) return null;
        const name =
          (typeof other.info?.name === "string" && other.info.name) ||
          (typeof other.id === "string" ? other.id.slice(0, 8) : "Guest");
        const color = (typeof other.info?.color === "string" && other.info.color) || "#2563eb";
        return (
          <div
            key={other.connectionId}
            className="absolute will-change-transform"
            style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
          >
            <svg width="20" height="24" viewBox="0 0 20 24" className="drop-shadow-sm -translate-x-0.5 -translate-y-0.5">
              <path d="M3 2 L3 18 L7 14 L11 22 L13 21 L9 13 L16 13 Z" fill={color} stroke="#fff" strokeWidth="1" />
            </svg>
            <span
              className="ml-3 -mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}