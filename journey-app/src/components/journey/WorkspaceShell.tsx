"use client";

import { Suspense } from "react";
import { ImportSuccessCta } from "@/components/import/ImportSuccessCta";
import { PanZoomSurface } from "@/components/ui/PanZoomSurface";
import { PrefillWorkbench } from "@/components/journey/PrefillWorkbench";
import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import type { FlowLink } from "@/lib/journey/flowLinks";

import { APP_HEADER_JOURNEY_PX } from "@/lib/layout/appHeader";
import { WorkspaceStepFocus } from "@/components/journey/WorkspaceStepFocus";
import { JourneyLiveRoom } from "@/components/journey/JourneyLiveRoom";

const APP_HEADER_PX = APP_HEADER_JOURNEY_PX;

export function WorkspaceShell({
  journeyId,
  phase,
  flowLinks = [],
  flowLaneByActionId = {},
  livePresenceEnabled = false,
}: {
  journeyId: string;
  phase: { id: string; title: string; steps: FlowStep[] };
  flowLinks?: FlowLink[];
  flowLaneByActionId?: Record<string, string>;
  livePresenceEnabled?: boolean;
}) {
  return (
  <JourneyLiveRoom journeyId={journeyId} enabled={livePresenceEnabled}>
    <>
      <Suspense fallback={null}>
        <ImportSuccessCta journeyId={journeyId} />
        <WorkspaceStepFocus />
      </Suspense>
      <div
        className="fixed left-0 right-0 z-10 bg-white"
        style={{ top: APP_HEADER_PX, bottom: 0 }}
        aria-label="Journey mapping canvas"
      >
        <PanZoomSurface
          className="h-full rounded-none border-0 shadow-none"
          variant="white"
          initialFit
        >
          <PrefillWorkbench
            journeyId={journeyId}
            phase={phase}
            flowLinks={flowLinks}
            flowLaneByActionId={flowLaneByActionId}
            immersive
          />
        </PanZoomSurface>
      </div>
    </>
  </JourneyLiveRoom>
  );
}