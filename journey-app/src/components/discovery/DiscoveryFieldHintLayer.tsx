"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type HintState = { text: string; x: number; y: number; key: number };

export function DiscoveryFieldHintLayer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<HintState | null>(null);
  const activeTextRef = useRef<string | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const offset = 12;

    const hide = () => {
      activeTextRef.current = null;
      setHint(null);
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-discovery-field-hint]");
      if (!el || !root.contains(el)) {
        if (activeTextRef.current) hide();
        return;
      }
      const text = el.getAttribute("data-discovery-field-hint")?.trim();
      if (!text) {
        hide();
        return;
      }
      const nextKey =
        activeTextRef.current === text ? keyRef.current : ++keyRef.current;
      activeTextRef.current = text;
      setHint({
        text,
        x: e.clientX + offset,
        y: e.clientY + offset,
        key: nextKey,
      });
    };

    const onLeave = (e: PointerEvent) => {
      const related = e.relatedTarget;
      if (related instanceof Node && root.contains(related)) return;
      hide();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className={cn(className)}>
        {children}
      </div>
      {typeof document !== "undefined" && hint
        ? createPortal(
            <div
              className="discovery-field-hint"
              style={{ left: hint.x, top: hint.y }}
              role="tooltip"
            >
              <span key={hint.key} className="discovery-field-hint__bubble">
                {hint.text}
              </span>
            </div>,
            document.body
          )
        : null}
    </>
  );
}