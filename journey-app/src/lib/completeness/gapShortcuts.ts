import type { QualityGap } from "@/lib/completeness/scoreJourney";
import type { JourneyCoachField, JourneyCoachTab } from "@/lib/completeness/journeyCoach";

export function coachWorkspaceHref(
  journeyId: string,
  opts: {
    stepId: string;
    tab?: JourneyCoachTab;
    field?: JourneyCoachField;
  }
): string {
  const p = new URLSearchParams({ coachOpen: "1", focus: opts.stepId });
  if (opts.tab) p.set("coachTab", opts.tab);
  if (opts.field) p.set("coachField", opts.field);
  return `/journeys/${journeyId}/map?${p.toString()}`;
}

export function gapShortcutHref(journeyId: string, gap: QualityGap): string | null {
  const base = `/journeys/${journeyId}/map`;
  if (gap.coach) {
    const p = new URLSearchParams();
    p.set("coachOpen", "1");
    if (gap.coach.stepId) p.set("focus", gap.coach.stepId);
    if (gap.coach.tab) p.set("coachTab", gap.coach.tab);
    if (gap.coach.field) p.set("coachField", gap.coach.field);
    if (gap.coach.personas) p.set("coachPersonas", "1");
    return `${base}?${p.toString()}`;
  }
  if (gap.stepId) {
    const p = new URLSearchParams({
      focus: gap.stepId,
      coachOpen: "1",
      coachTab: "details",
      coachField: "userAction",
    });
    return `${base}?${p.toString()}`;
  }
  switch (gap.shortcut) {
    case "workspace":
      return base;
    case "personas":
      return `${base}?coachPersonas=1&coachOpen=1`;
    case "synthesis":
      return `/journeys/${journeyId}/map`;
    case "summary":
      return `/journeys/${journeyId}/map`;
    default:
      return null;
  }
}

export function gapShortcutLabel(gap: QualityGap): string | null {
  if (gap.shortcutLabel) return gap.shortcutLabel;
  if (gap.coach?.field === "pain") return "Add evidence";
  if (gap.coach?.field === "touchpoint") return "Set location";
  if (gap.coach?.stepId || gap.stepId) return "Edit step";
  if (gap.coach?.personas || gap.shortcut === "personas") return "Edit personas";
  return null;
}