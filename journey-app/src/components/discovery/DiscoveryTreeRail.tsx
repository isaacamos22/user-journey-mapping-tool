"use client";

import { ChevronRight, ListTree } from "lucide-react";

export function DiscoveryTreeRail({
  onExpand,
  expandLabel = "Expand discovery panel",
  variant = "chip",
}: {
  onExpand: () => void;
  expandLabel?: string;
  /** chip = floating; column = full-height sidebar strip below phase bar */
  variant?: "chip" | "column";
}) {
  return (
    <div
      className={
        variant === "column"
          ? "discovery-tree-rail discovery-tree-rail--column flex w-full flex-col items-center gap-2 px-1 pt-2"
          : "discovery-tree-rail flex flex-col items-center gap-2 rounded-lg border border-border/70 bg-surface/95 p-1.5 shadow-[var(--elevation-2)] backdrop-blur-sm"
      }
    >
      <button
        type="button"
        className="m3-btn-icon h-9 w-9 shrink-0 border border-border bg-surface-container text-brand hover:bg-surface-container-high hover:text-foreground"
        aria-label={expandLabel}
        title={expandLabel}
        onClick={onExpand}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
      <ListTree className="h-4 w-4 shrink-0 text-brand" aria-hidden />
    </div>
  );
}