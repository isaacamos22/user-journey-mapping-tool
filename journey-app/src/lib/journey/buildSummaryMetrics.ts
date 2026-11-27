import { IMPORT_ASSUMED_EVIDENCE } from "@/lib/import/importAssumptions";

type FeelingRow = { confidence: number; frustration: number; delight: number; title?: string };
type PainRow = {
  description: string;
  severity: number;
  evidence?: string | null;
  opportunity?: string | null;
};
type StepLike = {
  id: string;
  title: string;
  userAction?: string | null;
  parentStepId?: string | null;
  feelings: FeelingRow[];
  emotions?: FeelingRow | null;
  painPoints: PainRow[];
  children?: StepLike[];
};

type PhaseLike = { id: string; title: string; steps: StepLike[] };

export type SummaryEmotionPoint = {
  stepId: string;
  name: string;
  fullTitle: string;
  confidence: number;
  frustration: number;
  delight: number;
  isNested?: boolean;
};

export type SummaryPainRow = {
  stepId: string;
  step: string;
  severity: number;
  count: number;
  topPain: string;
};

export type SummaryPhaseInsight = {
  phase: string;
  stepCount: number;
  painCount: number;
  avgFrustration: number;
  /** Mean severity across every pain point in the phase (summary charts). */
  avgPainSeverity: number;
  /** Highest step-level friction in the phase — matches map card peaks. */
  peakPainSeverity: number;
};

export type SummaryKpis = {
  phases: number;
  steps: number;
  nestedActions: number;
  painPoints: number;
  feelings: number;
  opportunities: number;
  assumedMarkers: number;
};

export type NestedActionView = {
  id: string;
  title: string;
  userAction?: string | null;
  painMax: number;
  feelingAvgFrustration: number | null;
  assumed: boolean;
};

export type NestedPhaseView = {
  id: string;
  title: string;
  steps: {
    id: string;
    title: string;
    userAction?: string | null;
    actions: NestedActionView[];
  }[];
};

function isAssumedTitle(title: string) {
  return /\(\s*assumed\s*\)/i.test(title) || title.includes("[Assumed]");
}

function isAssumedPain(p: PainRow) {
  return p.evidence === IMPORT_ASSUMED_EVIDENCE;
}

function isAssumedFeeling(f: FeelingRow) {
  return f.title ? isAssumedTitle(f.title) : false;
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stepFeelings(step: StepLike): FeelingRow[] {
  if (step.feelings.length) return step.feelings;
  if (step.emotions) return [step.emotions];
  return [];
}

function collectSteps(phases: PhaseLike[]): StepLike[] {
  const roots: StepLike[] = [];
  for (const p of phases) {
    for (const s of p.steps) {
      if (s.parentStepId) continue;
      roots.push(s);
    }
  }
  return roots;
}

/** Phase-column pain only (matches stakeholder map root cards). */
function rootPainOnly(step: StepLike): PainRow[] {
  return step.painPoints;
}

function allFeelingsOnStep(step: StepLike): FeelingRow[] {
  const childFeelings = (step.children ?? []).flatMap((c) => stepFeelings(c));
  return [...stepFeelings(step), ...childFeelings];
}

export function buildSummaryMetrics(journey: {
  phases: PhaseLike[];
  opportunities: unknown[];
}) {
  const emotionData: SummaryEmotionPoint[] = [];

  for (const phase of journey.phases) {
    for (const step of phase.steps) {
      if (step.parentStepId) continue;

      const publishPoint = (target: StepLike, nested: boolean) => {
        const feelings = stepFeelings(target);
        if (!feelings.length) return;
        const confidence = avg(feelings.map((f) => f.confidence));
        const frustration = avg(feelings.map((f) => f.frustration));
        const delight = avg(feelings.map((f) => f.delight));
        const label = nested ? `↳ ${target.title}` : target.title;
        emotionData.push({
          stepId: target.id,
          name: label.slice(0, 14),
          fullTitle: label,
          confidence,
          frustration,
          delight,
          isNested: nested,
        });
      };

      publishPoint(step, false);
      for (const child of step.children ?? []) publishPoint(child, true);
    }
  }

  const painData: SummaryPainRow[] = [];
  for (const phase of journey.phases) {
    for (const s of phase.steps) {
      if (s.parentStepId) continue;
      if (!s.painPoints.length) continue;
      const severities = s.painPoints.map((p) => p.severity);
      const severity = Math.max(...severities);
      const topIdx = severities.indexOf(severity);
      const top = s.painPoints[topIdx]?.description ?? "";
      painData.push({
        stepId: s.id,
        step: s.title,
        severity,
        count: severities.length,
        topPain: top.slice(0, 80),
      });
    }
  }
  painData.sort((a, b) => b.severity - a.severity || b.count - a.count);

  const phaseInsights: SummaryPhaseInsight[] = journey.phases.map((ph) => {
    const roots = ph.steps.filter((s) => !s.parentStepId);
    const pains = roots.flatMap((s) => rootPainOnly(s));
    const feelings = roots.flatMap((s) => allFeelingsOnStep(s));
    const peakPainSeverity = roots.length
      ? Math.max(
          0,
          ...roots.map((s) => {
            const onStep = rootPainOnly(s);
            return onStep.length ? Math.max(...onStep.map((p) => p.severity)) : 0;
          })
        )
      : 0;
    return {
      phase: ph.title,
      stepCount: roots.length,
      painCount: pains.length,
      avgFrustration: feelings.length ? avg(feelings.map((f) => f.frustration)) : 0,
      avgPainSeverity: pains.length ? avg(pains.map((p) => p.severity)) : 0,
      peakPainSeverity,
    };
  });

  const roots = collectSteps(journey.phases);
  const nestedActions = roots.reduce((n, s) => n + (s.children?.length ?? 0), 0);
  const painPoints = roots.reduce((n, s) => n + rootPainOnly(s).length, 0);
  const feelings = roots.reduce((n, s) => n + allFeelingsOnStep(s).length, 0);

  let assumedMarkers = 0;
  for (const phase of journey.phases) {
    for (const s of phase.steps) {
      for (const f of stepFeelings(s)) {
        if (isAssumedFeeling(f)) assumedMarkers += 1;
      }
      for (const p of s.painPoints) {
        if (isAssumedPain(p)) assumedMarkers += 1;
      }
      if (isAssumedTitle(s.title)) assumedMarkers += 1;
    }
  }

  const painOpportunityCount = roots.reduce(
    (n, s) => n + s.painPoints.filter((p) => p.opportunity?.trim()).length,
    0
  );

  const kpis: SummaryKpis = {
    phases: journey.phases.length,
    steps: roots.length,
    nestedActions,
    painPoints,
    feelings,
    opportunities: Math.max(journey.opportunities.length, painOpportunityCount),
    assumedMarkers,
  };

  const nestedPhases: NestedPhaseView[] = journey.phases.map((ph) => ({
    id: ph.id,
    title: ph.title,
    steps: ph.steps
      .filter((s) => !s.parentStepId)
      .map((s) => ({
        id: s.id,
        title: s.title,
        userAction: s.userAction,
        actions: (s.children ?? []).map((c) => {
          const feelingsOnChild = stepFeelings(c);
          return {
            id: c.id,
            title: c.title,
            userAction: c.userAction,
            painMax: c.painPoints.length ? Math.max(...c.painPoints.map((p) => p.severity)) : 0,
            feelingAvgFrustration: feelingsOnChild.length
              ? avg(feelingsOnChild.map((f) => f.frustration))
              : null,
            assumed:
              feelingsOnChild.some(isAssumedFeeling) ||
              c.painPoints.some(isAssumedPain) ||
              isAssumedTitle(c.title),
          };
        }),
      })),
  }));

  return { emotionData, painData, phaseInsights, kpis, nestedPhases };
}