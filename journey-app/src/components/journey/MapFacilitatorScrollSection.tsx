"use client";

import { useId, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMapCanvas } from "@/components/journey/mapCanvasContext";

export function MapFacilitatorScrollSection({
  label,
  labelColor,
  backgroundColor,
  count,
  children,
  className,
  defaultOpen = false,
}: {
  label: ReactNode;
  labelColor?: string;
  backgroundColor?: string;
  count: number;
  children: ReactNode;
  className?: string;
  /** Open on mount / when focus reveals a highlighted bullet (discovery map reference). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const ctx = useMapCanvas();
  const detailLevel = ctx?.detailLevel ?? "detail";
  const tierTransition = ctx?.tierTransition ?? "idle";
  /** Friction / opportunity bullets stay collapsible in compact; overview hides the chips entirely. */
  const canExpand =
    detailLevel !== "overview" && tierTransition !== "collapsing";
  const isOpen = canExpand && open;

  useEffect(() => {
    if (defaultOpen && canExpand) setOpen(true);
  }, [defaultOpen, canExpand]);

  useEffect(() => {
    if (!canExpand) setOpen(false);
  }, [canExpand]);

  useEffect(() => {
    if (!ctx?.requestLayoutRemeasure) return;
    if (!canExpand) return;
    const settleMs = isOpen ? 320 : 120;
    const t = window.setTimeout(() => ctx.requestLayoutRemeasure?.(), settleMs);
    return () => clearTimeout(t);
  }, [isOpen, canExpand, ctx?.requestLayoutRemeasure]);

  const toggle = () => {
    if (!canExpand) return;
    setOpen((v) => !v);
  };

  return (
    <div
      className={cn("journey-map-pain", className)}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <button
        type="button"
        className="journey-map-facilitator-toggle nopan nodrag flex w-full items-center gap-2 text-left"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
        data-tier-expandable={canExpand ? "true" : "false"}
      >
        <p
          className="journey-map-pain-label tabular-nums min-w-0 flex-1"
          style={labelColor ? { color: labelColor } : undefined}
        >
          {label}
        </p>
        <span className="shrink-0 text-[11px] font-medium text-foreground/55 tabular-nums">
          {count}
        </span>
        {canExpand ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-foreground/45 transition-transform duration-300 ease-out",
              !isOpen && "-rotate-90"
            )}
            aria-hidden
          />
        ) : null}
      </button>
      {isOpen ? (
        <div
          id={panelId}
          className="journey-map-facilitator-body journey-map-facilitator-body--open"
        >
          <div className="journey-map-facilitator-body-inner overlay-scrollbar nowheel">{children}</div>
        </div>
      ) : null}
    </div>
  );
}