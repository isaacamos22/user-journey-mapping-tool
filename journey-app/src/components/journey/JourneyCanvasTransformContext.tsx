"use client";

import { createContext, useContext, type ReactNode } from "react";

const JourneyCanvasTransformContext = createContext({ scale: 1 });

export function JourneyCanvasTransformProvider({
  scale,
  children,
}: {
  scale: number;
  children: ReactNode;
}) {
  return (
    <JourneyCanvasTransformContext.Provider value={{ scale }}>
      {children}
    </JourneyCanvasTransformContext.Provider>
  );
}

export function useJourneyCanvasScale() {
  return useContext(JourneyCanvasTransformContext).scale;
}