"use client";

import { completenessBarColor } from "@/lib/completeness/completenessColors";

const LABELS: Record<string, string> = {
  persona: "Persona",
  steps: "Steps & actions",
  touchpoints: "Touchpoints",
  pains: "Pain points",
  emotions: "Feelings",
  opportunities: "Opportunities",
};

export function SectionCompletenessBars({
  bySection,
  dense,
}: {
  bySection: Record<string, number>;
  dense?: boolean;
}) {
  const rows = Object.entries(bySection)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => a[1] - b[1]);

  return (
    <ul className={`w-full ${dense ? "space-y-1.5" : "space-y-2.5"}`}>
      {rows.map(([key, score]) => {
        const color = completenessBarColor(score);
        return (
          <li key={key}>
            <div className="summary-tile-hint flex justify-between mb-0.5 font-medium text-muted">
              <span className="truncate pr-1">{LABELS[key] ?? key}</span>
              <span className="shrink-0 font-semibold" style={{ color }}>
                {Math.round(score)}%
              </span>
            </div>
            <div className={`rounded-full bg-slate-100 overflow-hidden ${dense ? "h-1.5" : "h-2"}`}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}