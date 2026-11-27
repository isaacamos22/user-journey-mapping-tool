"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { BlurModal } from "@/components/ui/BlurModal";
import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import { StepPainsPanel } from "@/components/journey/StepPainsPanel";
import { StepFeelingsPanel } from "@/components/journey/StepFeelingsPanel";
import { TouchpointCompactEditor } from "@/components/journey/TouchpointCompactEditor";
import { StepActionTitleField } from "@/components/journey/StepActionTitleField";
import { focusCoachField, type JourneyCoachField, type JourneyCoachTab } from "@/lib/completeness/journeyCoach";
import { StepSection } from "@/components/journey/StepSection";

export function StepEditorModal({
  open,
  onClose,
  journeyId,
  phaseId,
  step,
  isAction,
  initialTab = "details",
  initialField,
  mapLinkHref,
}: {
  open: boolean;
  onClose: () => void;
  journeyId: string;
  phaseId: string;
  step: FlowStep;
  isAction: boolean;
  initialTab?: JourneyCoachTab;
  initialField?: JourneyCoachField;
  mapLinkHref?: string;
}) {
  const [editTab, setEditTab] = useState<JourneyCoachTab>(initialTab);
  const tp = step.touchpoints[0];

  useEffect(() => {
    if (!open) return;
    setEditTab(initialTab);
  }, [open, initialTab, step.id]);

  useEffect(() => {
    if (!open || !initialField) return;
    const t = window.setTimeout(() => focusCoachField(step.id, initialField, isAction), 320);
    return () => window.clearTimeout(t);
  }, [open, initialField, step.id, isAction]);

  const display = (step.userAction || step.title).trim();
  const modalTitle = isAction ? `Edit user action — ${display}` : `Edit step — ${display}`;

  return (
    <BlurModal
      open={open}
      onClose={onClose}
      title={modalTitle}
      size={editTab === "pains" || editTab === "feelings" ? "2xl" : "xl"}
      dimBackdrop
      fixedShell
    >
      <div
        data-journey-coach-modal={step.id}
        className="m3-body flex h-full min-h-0 flex-col gap-4 sm:flex-row sm:gap-0"
      >
        <nav
          className="flex shrink-0 flex-row gap-1 border-border sm:w-44 sm:flex-col sm:border-r sm:pr-3"
          role="tablist"
          aria-label="Step editor sections"
        >
          {(
            [
              { id: "details" as const, label: "Details" },
              { id: "pains" as const, label: `Pains (${step.painPoints.length})` },
              { id: "feelings" as const, label: `Feelings (${step.feelings.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={editTab === tab.id}
              aria-controls={`step-editor-panel-${tab.id}`}
              id={`step-editor-tab-${tab.id}`}
              onClick={() => setEditTab(tab.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                editTab === tab.id
                  ? "bg-brand/10 text-brand border border-brand/25 sm:border-0 sm:border-l-[3px] sm:border-l-brand sm:rounded-none sm:rounded-r-md"
                  : "text-muted hover:bg-surface-container hover:text-foreground border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div
          className="min-h-0 min-w-0 flex-1 overflow-hidden sm:pl-5"
          role="tabpanel"
          id={`step-editor-panel-${editTab}`}
          aria-labelledby={`step-editor-tab-${editTab}`}
        >
          {editTab === "details" ? (
            <div className="space-y-5">
              <StepActionTitleField
                key={step.id}
                stepId={step.id}
                journeyId={journeyId}
                phaseId={phaseId}
                variant={isAction ? "action" : "step"}
                initialTitle={step.title}
                initialUserAction={step.userAction ?? ""}
              />

              <StepSection
                title="Touchpoint"
                icon={<MapPin className="h-4 w-4" aria-hidden />}
                borderClass="border-brand/40"
                titleClass="text-brand"
              >
                <TouchpointCompactEditor
                  key={`${step.id}-${tp?.module ?? ""}-${tp?.screen ?? ""}`}
                  stepId={step.id}
                  journeyId={journeyId}
                  touchpoint={tp}
                />
              </StepSection>
            </div>
          ) : null}

          {editTab === "pains" ? (
            <StepPainsPanel pains={step.painPoints} stepId={step.id} journeyId={journeyId} />
          ) : null}

          {editTab === "feelings" ? (
            <StepFeelingsPanel feelings={step.feelings} stepId={step.id} journeyId={journeyId} />
          ) : null}
        </div>
      </div>

      {mapLinkHref ? (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
          <a href={mapLinkHref} className="font-semibold text-brand hover:underline">
            Open this step on the journey map
          </a>
        </p>
      ) : null}
    </BlurModal>
  );
}