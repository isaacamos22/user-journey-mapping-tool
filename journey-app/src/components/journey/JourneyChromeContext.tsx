"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  JOURNEY_RAIL_COLLAPSED_PX,
  JOURNEY_RAIL_WIDTH_PX,
} from "@/lib/layout/journeyChrome";

function expandedRailWidth(): number {
  if (typeof window === "undefined") return JOURNEY_RAIL_WIDTH_PX;
  return Math.min(JOURNEY_RAIL_WIDTH_PX, Math.max(232, Math.round(window.innerWidth * 0.42)));
}

type JourneyChromeContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  railWidth: number;
};

const JourneyChromeContext = createContext<JourneyChromeContextValue | null>(null);

export function JourneyChromeProvider({
  children,
  defaultCollapsed = false,
}: {
  children: ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedWidth, setExpandedWidth] = useState(JOURNEY_RAIL_WIDTH_PX);

  useEffect(() => {
    const onResize = () => setExpandedWidth(expandedRailWidth());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed: () => setCollapsed((c) => !c),
      railWidth: collapsed ? JOURNEY_RAIL_COLLAPSED_PX : expandedWidth,
    }),
    [collapsed, expandedWidth]
  );

  return (
    <JourneyChromeContext.Provider value={value}>{children}</JourneyChromeContext.Provider>
  );
}

export function useJourneyChrome(): JourneyChromeContextValue {
  const ctx = useContext(JourneyChromeContext);
  if (!ctx) throw new Error("useJourneyChrome must be used within JourneyChromeProvider");
  return ctx;
}

export function useJourneyChromeOptional() {
  return useContext(JourneyChromeContext);
}