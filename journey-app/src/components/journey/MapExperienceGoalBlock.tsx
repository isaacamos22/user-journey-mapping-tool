"use client";

import { useState } from "react";
import {
  experienceGoalHasMore,
  previewExperienceGoal,
} from "@/lib/journey/mapExperienceGoalPreview";
import { MapTextWithHighlight } from "@/components/journey/JourneyMapNodeBody.shared";
import { useMapCanvas } from "@/components/journey/mapCanvasContext";

const wrapText = "min-w-0 max-w-full whitespace-normal break-words";

export function MapExperienceGoalBlock({
  experienceGoal,
  highlight,
}: {
  experienceGoal: string;
  highlight?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const ctx = useMapCanvas();
  const hasMore = experienceGoalHasMore(experienceGoal);
  const display = expanded ? experienceGoal.trim() : previewExperienceGoal(experienceGoal);

  const toggleGoals = () => {
    setExpanded((v) => !v);
    ctx?.requestLayoutRemeasure?.();
    window.setTimeout(() => ctx?.requestLayoutRemeasure?.(), 320);
  };

  return (
    <div className="journey-map-goal-block mt-1.5">
      <p className={`journey-map-body italic text-foreground/80 ${wrapText}`}>
        Goal · <MapTextWithHighlight text={display} highlight={highlight} />
      </p>
      {hasMore ? (
        <button
          type="button"
          className="journey-map-goal-expand mt-1 text-[11px] font-medium text-brand hover:underline"
          onClick={toggleGoals}
        >
          {expanded ? "Show less" : "Show all goals"}
        </button>
      ) : null}
    </div>
  );
}