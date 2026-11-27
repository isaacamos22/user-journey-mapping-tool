"use client";

import { cn } from "@/lib/utils";
import { useMapCanvas } from "@/components/journey/mapCanvasContext";
import type { CanvasStep } from "@/components/journey/JourneyCanvas";
import { buildActionRunBlurb } from "@/lib/journey/actionRunBlurb";
import { formatActionRunFullSummary } from "@/lib/journey/actionRunSummary";
export function MapActionRunStack({
  stepIds,
  focused,
  onSelectStep,
  parentStepId,
  stackBlurbOverride,
}: {
  stepIds: string[];
  focused?: boolean;
  parentStepId?: string;
  stackBlurbOverride?: string | null;
  onSelectStep?: (id: string) => void;
}) {
  const ctx = useMapCanvas();
  const count = stepIds.length;
  if (count === 0) return null;

  const steps = stepIds
    .map((id) => ctx?.getStep(id))
    .filter((s): s is CanvasStep => Boolean(s));
  const layoutLevel = ctx?.layoutDetailLevel ?? "detail";
  const visualLevel = ctx?.detailLevel ?? "detail";
  const isOverview = layoutLevel === "overview" || visualLevel === "overview";
  const parent = parentStepId ? ctx?.getStep(parentStepId) : undefined;
  const blurbTier = isOverview ? "overview" : "compact";
  const blurb = buildActionRunBlurb(
    steps,
    parent?.title,
    blurbTier,
    stackBlurbOverride,
    parent?.experienceGoal
  );
  const fullSummary = formatActionRunFullSummary(steps);
  const actionWord = count === 1 ? "action" : "actions";

  const openFirstAction = () => onSelectStep?.(stepIds[0]!);

  return (
    <div
      className={cn(
        "journey-map-node journey-map-node--nested journey-map-node--action-stack",
        "journey-map-action-stack-card nopan nodrag cursor-pointer",
        focused && "journey-map-node--focused"
      )}
      data-map-parent-step={parentStepId}
      data-map-action-count={count}
      role="button"
      tabIndex={0}
      aria-label={`${count} user ${actionWord}: ${fullSummary || blurb || "Zoom in to read each action"}`}
      onClick={openFirstAction}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFirstAction();
        }
      }}
    >
      <p className="journey-map-action-stack-label">
        <span>{isOverview ? "User actions" : "What users do"}</span>
        <span className="journey-map-action-stack-label-meta">
          {count} {actionWord}
        </span>
      </p>
      {blurb ? (
        <p
          className={cn(
            "journey-map-action-stack-description",
            isOverview && "journey-map-action-stack-description--overview"
          )}
          title={fullSummary || blurb}
        >
          {blurb}
        </p>
      ) : null}
    </div>
  );
}