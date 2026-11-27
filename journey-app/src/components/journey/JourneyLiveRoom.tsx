"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from "@liveblocks/react";

const LiveEnabledContext = createContext(false);

export function useJourneyLiveEnabled(): boolean {
  return useContext(LiveEnabledContext);
}

export function JourneyLiveRoom({
  journeyId,
  enabled,
  children,
}: {
  journeyId: string;
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) {
    return (
      <LiveEnabledContext.Provider value={false}>{children}</LiveEnabledContext.Provider>
    );
  }

  const roomId = `journey:${journeyId}`;

  return (
    <LiveEnabledContext.Provider value={true}>
      <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
        <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
          <ClientSideSuspense fallback={children}>{children}</ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </LiveEnabledContext.Provider>
  );
}