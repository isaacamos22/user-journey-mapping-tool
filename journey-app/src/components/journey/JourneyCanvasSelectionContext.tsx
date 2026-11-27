"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type JourneyCanvasSelectionContextValue = {
  selectedIds: ReadonlySet<string>;
  isSelected: (id: string) => boolean;
  setSelectedIds: (ids: Iterable<string>) => void;
  clearSelection: () => void;
};

const JourneyCanvasSelectionContext = createContext<JourneyCanvasSelectionContextValue | null>(
  null
);

export function JourneyCanvasSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIdsState] = useState<Set<string>>(() => new Set());

  const value = useMemo<JourneyCanvasSelectionContextValue>(
    () => ({
      selectedIds,
      isSelected: (id) => selectedIds.has(id),
      setSelectedIds: (ids) => setSelectedIdsState(new Set(ids)),
      clearSelection: () => setSelectedIdsState(new Set()),
    }),
    [selectedIds]
  );

  return (
    <JourneyCanvasSelectionContext.Provider value={value}>
      {children}
    </JourneyCanvasSelectionContext.Provider>
  );
}

export function useJourneyCanvasSelection() {
  const ctx = useContext(JourneyCanvasSelectionContext);
  if (!ctx) {
    throw new Error("useJourneyCanvasSelection must be used within JourneyCanvasSelectionProvider");
  }
  return ctx;
}

export function useJourneyCanvasSelectionOptional() {
  return useContext(JourneyCanvasSelectionContext);
}