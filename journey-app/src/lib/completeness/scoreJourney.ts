export type DepthTier = "shallow" | "adequate" | "strong";

import type { JourneyCoachFocus } from "@/lib/completeness/journeyCoach";

export type QualityGapShortcut = "workspace" | "personas" | "synthesis" | "summary";

export type QualityGap = {
  id: string;
  section: string;
  message: string;
  severity: "info" | "warn";
  stepId?: string;
  shortcut?: QualityGapShortcut;
  shortcutLabel?: string;
  coach?: JourneyCoachFocus;
};

export type CompletenessResult = {
  score: number;
  depth: DepthTier;
  gaps: QualityGap[];
  bySection: Record<string, number>;
};

type JourneyInput = {
  personas: { name: string; goals?: string | null; frustrations?: string | null }[];
  phases: {
    title: string;
    steps: {
      id: string;
      title: string;
      userAction?: string | null;
      touchpoints: unknown[];
      painPoints: { severity: number; evidence?: string | null }[];
      feelings?: { confidence: number; freeText?: string | null }[];
      emotions?: { confidence: number; freeText?: string | null } | null;
    }[];
  }[];
  opportunities: { ifClause?: string | null; thenClause?: string | null; resultingIn?: string | null }[];
};

const ACTION_VERB = /^(add|apply|browse|check|click|complete|confirm|create|edit|enter|find|log|open|review|search|select|sign|start|submit|update|upload|use|view)\b/i;

export function scoreJourney(journey: JourneyInput): CompletenessResult {
  const gaps: QualityGap[] = [];
  let earned = 0;
  let possible = 0;

  const sectionScores: Record<string, number> = {
    persona: 0,
    steps: 0,
    touchpoints: 0,
    pains: 0,
    emotions: 0,
    opportunities: 0,
  };

  // Personas (max 15)
  possible += 15;
  if (journey.personas.length >= 1) {
    earned += 5;
    sectionScores.persona += 33;
    const rich = journey.personas.some((p) => p.goals && p.frustrations);
    if (rich) {
      earned += 10;
      sectionScores.persona = 100;
    } else {
      gaps.push({
        id: "persona-depth",
        section: "Persona",
        message: "Add goals and frustrations so the team shares the same user mental model.",
        severity: "warn",
        coach: { personas: true },
        shortcutLabel: "Edit personas",
      });
      sectionScores.persona = 66;
    }
  } else {
    gaps.push({
      id: "persona-missing",
      section: "Persona",
      message: "Add at least one persona in the workspace.",
      severity: "warn",
      coach: { personas: true },
      shortcutLabel: "Add persona",
    });
  }

  const steps = journey.phases.flatMap((p) => p.steps);
  // Steps (max 35)
  possible += 35;
  if (steps.length === 0) {
    gaps.push({
      id: "steps-missing",
      section: "Steps",
      message: "Add your first journey step — use a verb-led user action.",
      severity: "warn",
      shortcut: "workspace",
      shortcutLabel: "Open map",
    });
  } else {
    earned += 10;
    sectionScores.steps = 28;
    let goodSteps = 0;
    const weakSteps = steps.filter((step) => {
      const action = step.userAction || step.title;
      const ok = action.length >= 8 && ACTION_VERB.test(action.trim());
      if (ok) goodSteps++;
      return !ok;
    });
    if (weakSteps.length > 1) {
      gaps.push({
        id: "steps-verb-summary",
        section: "Steps",
        message: `${weakSteps.length} steps need verb-led user actions (e.g. “Submit request”).`,
        severity: "warn",
        shortcut: "workspace",
        shortcutLabel: "View map",
      });
    }
    const showSteps = weakSteps.length > 1 ? weakSteps.slice(0, 2) : weakSteps;
    for (const step of showSteps) {
      gaps.push({
        id: `step-verb-${step.id}`,
        section: "Steps",
        message: `“${step.title}” — start the user action with a verb.`,
        severity: weakSteps.length > 1 ? "info" : "warn",
        coach: { stepId: step.id, tab: "details", field: "userAction" },
        shortcutLabel: "Open & fix",
      });
    }
    earned += Math.min(15, Math.round((goodSteps / steps.length) * 15));
    sectionScores.steps = Math.round((goodSteps / steps.length) * 100) || 40;
  }

  // Touchpoints (max 20)
  possible += 20;
  const withTp = steps.filter((s) => (s.touchpoints?.length ?? 0) > 0).length;
  if (steps.length) {
    const ratio = withTp / steps.length;
    earned += Math.round(ratio * 20);
    sectionScores.touchpoints = Math.round(ratio * 100);
    if (ratio < 0.5) {
      const target = steps.find((s) => (s.touchpoints?.length ?? 0) === 0);
      gaps.push({
        id: "touchpoints-low",
        section: "Touchpoints",
        message: "Link module/screen to steps so delivery knows where changes land.",
        severity: "warn",
        coach: target
          ? { stepId: target.id, tab: "details", field: "touchpoint" }
          : undefined,
        shortcut: target ? undefined : "workspace",
        shortcutLabel: target ? "Set location" : "View map",
      });
    }
  }

  // Pain points (max 15)
  possible += 15;
  const pains = steps.flatMap((s) => s.painPoints);
  if (pains.length) {
    earned += 8;
    const evidenceRatio =
      pains.filter((p) => p.evidence?.trim() || p.severity < 4).length / pains.length;
    earned += Math.round(evidenceRatio * 7);
    sectionScores.pains = Math.round(evidenceRatio * 100);
    for (const step of steps) {
      const harsh = step.painPoints.find((p) => p.severity >= 4 && !p.evidence?.trim());
      if (!harsh) continue;
      gaps.push({
        id: `pain-evidence-${step.id}`,
        section: "Pain points",
        message: "High-severity pains need research evidence (interview, analytics, etc.).",
        severity: "warn",
        coach: { stepId: step.id, tab: "pains", field: "pain" },
        shortcutLabel: "Add evidence",
      });
      break;
    }
  } else {
    gaps.push({
      id: "pains-missing",
      section: "Pain points",
      message: "Capture at least one pain point to drive opportunities.",
      severity: "info",
      shortcut: "workspace",
      shortcutLabel: "Add pain",
    });
  }

  // Emotions (max 10)
  possible += 10;
  const withEmotion = steps.filter((s) => (s.feelings?.length ?? 0) > 0 || s.emotions).length;
  if (steps.length) {
    const ratio = withEmotion / steps.length;
    earned += Math.round(ratio * 10);
    sectionScores.emotions = Math.round(ratio * 100);
  }

  // Opportunities (max 5)
  possible += 5;
  if (journey.opportunities.length) {
    const complete = journey.opportunities.filter(
      (o) => o.ifClause && o.thenClause && o.resultingIn
    ).length;
    earned += Math.round((complete / journey.opportunities.length) * 5);
    sectionScores.opportunities = Math.round((complete / journey.opportunities.length) * 100);
    if (complete < journey.opportunities.length) {
      gaps.push({
        id: "opp-hypothesis",
        section: "Opportunities",
        message: "Complete If / Then / Resulting in for each opportunity.",
        severity: "info",
        shortcut: "synthesis",
        shortcutLabel: "Open discovery",
      });
    }
  }

  const score = possible ? Math.round((earned / possible) * 100) : 0;
  let depth: DepthTier = "shallow";
  if (score >= 75) depth = "strong";
  else if (score >= 50) depth = "adequate";

  return { score, depth, gaps, bySection: sectionScores };
}