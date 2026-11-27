"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { journeySectionFromPathname } from "@/lib/navigation/journeySegment";
import { cn } from "@/lib/utils";

type PageTransitionVariant = "immersive" | "stagger";

function variantForPath(pathname: string): PageTransitionVariant {
  const section = journeySectionFromPathname(pathname);
  if (section === "map" || section === "workspace" || section === "export" || section === "synthesis") {
    return "immersive";
  }
  return "stagger";
}

/** Re-mount on route change and run enter animations (staggered blocks where possible). */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const variant = variantForPath(pathname);

  return (
    <div
      key={pathname}
      className={cn(
        "page-transition-shell min-h-0 w-full min-w-0 flex-1 flex flex-col",
        variant === "stagger" && "page-transition-shell--stagger",
        variant === "immersive" && "page-transition-shell--immersive",
      )}
    >
      {children}
    </div>
  );
}