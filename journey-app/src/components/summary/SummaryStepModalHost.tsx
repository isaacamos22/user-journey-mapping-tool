"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { StepEditorModal } from "@/components/journey/StepEditorModal";
import { coachWorkspaceHref } from "@/lib/completeness/gapShortcuts";
import {
  findFlowStepInJourney,
  type JourneyPhaseCatalog,
  type SummaryStepOpenRequest,
} from "@/lib/journey/stepCatalog";
import type { JourneyCoachField, JourneyCoachTab } from "@/lib/completeness/journeyCoach";

type SummaryStepModalContextValue = {
  openStep: (stepId: string, tab?: JourneyCoachTab, field?: JourneyCoachField) => void;
  closeStep: () => void;
};

const SummaryStepModalContext = createContext<SummaryStepModalContextValue | null>(null);

export function SummaryStepModalHost({
  journeyId,
  phases,
  children,
}: {
  journeyId: string;
  phases: JourneyPhaseCatalog[];
  children: ReactNode;
}) {
  const [request, setRequest] = useState<SummaryStepOpenRequest | null>(null);

  const openStep = useCallback(
    (stepId: string, tab: JourneyCoachTab = "details", field?: JourneyCoachField) => {
      setRequest({ stepId, tab, field });
    },
    []
  );

  const closeStep = useCallback(() => setRequest(null), []);

  const ctx = useMemo(() => ({ openStep, closeStep }), [openStep, closeStep]);

  const resolved = request ? findFlowStepInJourney(phases, request.stepId) : null;
  const mapHref =
    request && resolved
      ? coachWorkspaceHref(journeyId, {
          stepId: request.stepId,
          tab: request.tab,
          field: request.field,
        })
      : undefined;

  return (
    <SummaryStepModalContext.Provider value={ctx}>
      {children}
      {resolved && request ? (
        <StepEditorModal
          open
          onClose={closeStep}
          journeyId={journeyId}
          phaseId={resolved.phaseId}
          step={resolved.step}
          isAction={resolved.isAction}
          initialTab={request.tab ?? "details"}
          initialField={request.field}
          mapLinkHref={mapHref}
        />
      ) : null}
    </SummaryStepModalContext.Provider>
  );
}

export function useSummaryStepModal(): SummaryStepModalContextValue {
  const ctx = useContext(SummaryStepModalContext);
  if (!ctx) throw new Error("useSummaryStepModal must be used within SummaryStepModalHost");
  return ctx;
}

export function useSummaryStepModalOptional() {
  return useContext(SummaryStepModalContext);
}