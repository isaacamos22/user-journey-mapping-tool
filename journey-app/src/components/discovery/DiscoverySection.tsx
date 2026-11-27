"use client";

import type { ReactNode } from "react";
import { CopyTextButton } from "@/components/discovery/CopyTextButton";
import { cn } from "@/lib/utils";

export function DiscoverySection({
  title,
  copyText,
  children,
  compact,
  anchorId,
}: {
  title: string;
  copyText: string;
  children: ReactNode;
  compact?: boolean;
  /** Matches discoveryText section id for in-page TOC jumps */
  anchorId?: string;
}) {
  return (
    <section
      id={anchorId ? `discovery-section-${anchorId}` : undefined}
      className={cn(
        "discovery-sheet-section space-y-2.5",
        anchorId && "discovery-sheet-section--anchored"
      )}
    >
      <div className="discovery-sheet-section__head flex items-center justify-between gap-3">
        <h4>{title}</h4>
        <CopyTextButton text={copyText} />
      </div>
      <div
        className={compact ? "discovery-sheet-section__body" : "discovery-sheet-section__body discovery-sheet-main"}
      >
        {children}
      </div>
    </section>
  );
}