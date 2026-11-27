export type DiscoveryStepOption = {
  id: string;
  label: string;
  title: string;
  userAction: string | null;
  phaseTitle: string;
  kind: "step" | "action";
  pains: {
    id: string;
    description: string;
    severity: number;
    opportunity: string | null;
    evidence: string | null;
  }[];
  touchpoint?: {
    module: string | null;
    screen: string | null;
    panel: string | null;
    dialog: string | null;
  };
};

type PhaseLike = {
  title: string;
  steps: {
    id: string;
    title: string;
    userAction: string | null;
    painPoints: DiscoveryStepOption["pains"];
    touchpoints: DiscoveryStepOption["touchpoint"][];
    children?: {
      id: string;
      title: string;
      userAction: string | null;
      painPoints: DiscoveryStepOption["pains"];
      touchpoints: DiscoveryStepOption["touchpoint"][];
    }[];
  }[];
};

export function flattenJourneySteps(phases: PhaseLike[]): DiscoveryStepOption[] {
  const out: DiscoveryStepOption[] = [];
  for (const phase of phases) {
    for (const step of phase.steps) {
      out.push({
        id: step.id,
        label: `Step · ${step.title}`,
        title: step.title,
        userAction: step.userAction,
        phaseTitle: phase.title,
        kind: "step",
        pains: step.painPoints,
        touchpoint: step.touchpoints[0],
      });
      for (const child of step.children ?? []) {
        out.push({
          id: child.id,
          label: `Action · ${child.userAction || child.title}`,
          title: child.title,
          userAction: child.userAction,
          phaseTitle: phase.title,
          kind: "action",
          pains: child.painPoints,
          touchpoint: child.touchpoints[0],
        });
      }
    }
  }
  return out;
}