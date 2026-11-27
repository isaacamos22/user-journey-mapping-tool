"use client";

import type { ReactNode } from "react";
import {
  DiscoverySectionToc,
  type DiscoveryTocItem,
} from "@/components/discovery/DiscoverySectionToc";
import { cn } from "@/lib/utils";

/** Sticky right column: section TOC + map reference (scrolls independently if tall). */
export function DiscoveryDetailRail({
  toc,
  children,
  className,
}: {
  toc: DiscoveryTocItem[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("discovery-detail-rail", className)}>
      <DiscoverySectionToc items={toc} />
      {children}
    </div>
  );
}