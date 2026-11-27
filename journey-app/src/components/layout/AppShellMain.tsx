"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  isJourneyUnifiedWorkbenchPath,
  journeySectionFromPathname,
} from "@/lib/navigation/journeySegment";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";

const IMMERSIVE_SECTIONS = new Set(["map", "workspace", "synthesis"]);

/** Full-bleed pages that sit flush under the app header (no extra main offset). */
const FLUSH_HEADER_PATHS = new Set(["/import"]);

export function AppShellMain({
  children,
  paddingTop,
  className,
}: {
  children: ReactNode;
  paddingTop: string;
  className?: string;
}) {
  const pathname = usePathname();
  const section = journeySectionFromPathname(pathname);
  const immersive = IMMERSIVE_SECTIONS.has(section);
  const unifiedWorkbench = isJourneyUnifiedWorkbenchPath(pathname);
  const flushHeader = FLUSH_HEADER_PATHS.has(pathname);
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 min-h-0",
        className,
        unifiedWorkbench && "max-w-none px-0",
        immersive && !unifiedWorkbench && "max-w-none px-2 sm:px-4 lg:px-6",
        !immersive && "max-w-7xl px-4",
        unifiedWorkbench && "flex min-h-0 flex-1 flex-col overflow-hidden bg-surface p-0",
        flushHeader && "max-w-none p-0",
        !unifiedWorkbench && !flushHeader && "py-6"
      )}
      style={{
        paddingTop:
          unifiedWorkbench || flushHeader ? "var(--app-header-px, 3.5rem)" : paddingTop,
      }}
    >
      <PageTransition>{children}</PageTransition>
    </main>
  );
}