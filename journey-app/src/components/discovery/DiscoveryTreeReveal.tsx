"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DiscoveryTreeReveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={cn("discovery-tree-reveal", open && "discovery-tree-reveal--open")}>
      <div className="discovery-tree-reveal__inner">{children}</div>
    </div>
  );
}