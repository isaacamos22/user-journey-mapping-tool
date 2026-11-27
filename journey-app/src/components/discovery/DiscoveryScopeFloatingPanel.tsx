"use client";

import type { ReactNode } from "react";
import { PanelRightClose, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function DiscoveryScopeFloatingPanel({
  expanded,
  onExpandedChange,
  scopeCount,
  header,
  children,
  footer,
}: {
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  scopeCount: number;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="discovery-scope-slide-host" aria-label="Discovery scope">
      <button
        type="button"
        className={cn(
          "discovery-scope-slide-tab pointer-events-auto m3-btn-icon relative h-12 w-12 shrink-0 text-brand",
          expanded && "discovery-scope-slide-tab--hidden"
        )}
        aria-label="Open discovery scope"
        title="Discovery scope"
        aria-hidden={expanded}
        tabIndex={expanded ? -1 : 0}
        onClick={() => onExpandedChange(true)}
      >
        <Sparkles className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        {scopeCount > 0 ? (
          <span className="discovery-scope-panel__badge tabular-nums">{scopeCount > 9 ? "9+" : scopeCount}</span>
        ) : null}
      </button>

      <aside
        className={cn(
          "discovery-scope-slide pointer-events-auto flex min-h-0 flex-col overflow-hidden",
          !expanded && "discovery-scope-slide--off-screen"
        )}
        aria-hidden={!expanded}
      >
        <p className="shrink-0 border-b border-border/60 px-3 py-2 text-[11px] leading-snug text-muted">
          Click map → scope →{" "}
          <span className="font-medium text-foreground">copy prompt</span> → Cursor → refresh.
        </p>
        <div className="discovery-scope-slide__body flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
          <div className="flex items-start justify-between gap-2">
            {header}
            <button
              type="button"
              className="m3-btn-icon -mr-1 -mt-0.5 shrink-0 text-muted hover:text-foreground"
              aria-label="Close discovery scope"
              title="Close"
              onClick={() => onExpandedChange(false)}
            >
              <PanelRightClose className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">{children}</div>
          {footer}
        </div>
      </aside>
    </div>
  );
}