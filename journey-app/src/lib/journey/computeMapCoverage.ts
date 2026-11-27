type MapCoveragePhase = {
  steps: {
    id: string;
    parentStepId?: string | null;
    painPoints: unknown[];
    feelings: unknown[];
  }[];
};

/**
 * Coverage of what the stakeholder map shows: one phase column per root step,
 * nested actions, phase-level pain, and experience goal / feelings on the root.
 */
export function computeMapCoverageScore(phases: MapCoveragePhase[]): number {
  const roots = phases.flatMap((ph) => ph.steps.filter((s) => !s.parentStepId));
  if (roots.length === 0) return 0;

  const allSteps = phases.flatMap((ph) => ph.steps);
  const scores = roots.map((root) => {
    let points = 0;
    const max = 4;
    points += 1;
    const actionCount = allSteps.filter((s) => s.parentStepId === root.id).length;
    if (actionCount > 0) points += 1;
    if (root.painPoints.length > 0) points += 1;
    if (root.feelings.length > 0) points += 1;
    return points / max;
  });

  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
}

export function mapCoverageDepth(score: number): "shallow" | "adequate" | "strong" {
  if (score >= 85) return "strong";
  if (score >= 60) return "adequate";
  return "shallow";
}