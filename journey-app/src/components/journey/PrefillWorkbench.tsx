"use client";

import { Link2 } from "lucide-react";
import { JourneyStepFlow, type FlowStep } from "@/components/journey/JourneyStepFlow";
import type { FlowLink } from "@/lib/journey/flowLinks";

type Phase = {
  id: string;
  title: string;
  steps: FlowStep[];
};

export function PrefillWorkbench({
  journeyId,
  phase,
  flowLinks = [],
  flowLaneByActionId = {},
  immersive = false,
}: {
  journeyId: string;
  phase: Phase;
  flowLinks?: FlowLink[];
  flowLaneByActionId?: Record<string, string>;
  immersive?: boolean;
}) {
  return (
    <div className={immersive ? "space-y-3" : "space-y-10"}>
      <div className="relative w-max max-w-none" data-pan-zoom-fit-content>
        <div className="flex items-center gap-2 m3-body-muted mb-2">
          <span className="font-medium text-brand">{phase.title}</span>
          <Link2 className="h-3 w-3" aria-hidden />
          <span>
            {phase.steps.length} step{phase.steps.length === 1 ? "" : "s"}
            {phase.steps.some((s) => s.children?.length) &&
              ` · ${phase.steps.reduce((n, s) => n + (s.children?.length ?? 0), 0)} nested actions`}
          </span>
        </div>

        <JourneyStepFlow
          journeyId={journeyId}
          phaseId={phase.id}
          initialSteps={phase.steps}
          flowLinks={flowLinks}
          flowLaneByActionId={flowLaneByActionId}
        />
      </div>
    </div>
  );
}