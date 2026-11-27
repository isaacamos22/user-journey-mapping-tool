import type { LoadedJourney } from "@/lib/journey/loadJourney";

export const JOURNEY_EXPORT_PACK_FILENAME = "journey-export.v1.json";

export type JourneyExportPackV1 = {
  format: "journey-synthesis-export";
  version: 1;
  exportedAt: string;
  journey: {
    title: string;
    goal?: string | null;
    businessContext?: string | null;
    status?: string;
    personas: {
      name: string;
      role?: string | null;
      goals?: string | null;
      frustrations?: string | null;
      tags?: string | null;
    }[];
    phases: {
      title: string;
      order: number;
      steps: ExportPackStepV1[];
    }[];
    opportunities: {
      title: string;
      ifClause?: string | null;
      thenClause?: string | null;
      resultingIn?: string | null;
      painPointIds?: string | null;
      stepIds?: string | null;
    }[];
    requirements: { tag?: string; title: string; bodyJson: string; status?: string }[];
    userStories: {
      title: string;
      bodyJson: string;
      status?: string;
      requirementTitle?: string | null;
    }[];
  };
};

export type ExportPackStepV1 = {
  title: string;
  userAction?: string | null;
  order: number;
  channel?: string | null;
  touchpoints: { module?: string | null; screen?: string | null; panel?: string | null; dialog?: string | null }[];
  painPoints: {
    description: string;
    severity?: number;
    evidence?: string | null;
    opportunity?: string | null;
  }[];
  feelings?: {
    title: string;
    confidence?: number;
    frustration?: number;
    delight?: number;
    freeText?: string | null;
  }[];
  thoughtsFeelings?: {
    confidence?: number;
    frustration?: number;
    delight?: number;
    freeText?: string | null;
  } | null;
  children: Omit<ExportPackStepV1, "children">[];
};

function serializeStep(
  step: LoadedJourney["phases"][0]["steps"][0]
): ExportPackStepV1 {
  const children = (step.children ?? []).map((child) => {
    const base = serializeStep({ ...child, children: [] } as LoadedJourney["phases"][0]["steps"][0]);
    const { children: _c, ...rest } = base;
    return rest;
  });

  return {
    title: step.title,
    userAction: step.userAction,
    order: step.order,
    channel: step.channel,
    touchpoints: (step.touchpoints ?? []).map((t) => ({
      module: t.module,
      screen: t.screen,
      panel: t.panel,
      dialog: t.dialog,
    })),
    painPoints: (step.painPoints ?? []).map((p) => ({
      description: p.description,
      severity: p.severity,
      evidence: p.evidence,
      opportunity: p.opportunity,
    })),
    feelings: (step.feelings ?? []).map((f) => ({
      title: f.title,
      confidence: f.confidence,
      frustration: f.frustration,
      delight: f.delight,
      freeText: f.freeText,
    })),
    thoughtsFeelings:
      step.feelings?.[0] != null
        ? {
            confidence: step.feelings[0].confidence,
            frustration: step.feelings[0].frustration,
            delight: step.feelings[0].delight,
            freeText: step.feelings[0].freeText,
          }
        : step.emotions
          ? {
              confidence: step.emotions.confidence,
              frustration: step.emotions.frustration,
              delight: step.emotions.delight,
              freeText: step.emotions.freeText,
            }
          : null,
    children,
  };
}

export function buildJourneyExportPackV1(journey: LoadedJourney): JourneyExportPackV1 {
  return {
    format: "journey-synthesis-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    journey: {
      title: journey.title,
      goal: journey.goal,
      businessContext: journey.businessContext,
      status: journey.status,
      personas: journey.personas.map((p) => ({
        name: p.name,
        role: p.role,
        goals: p.goals,
        frustrations: p.frustrations,
        tags: p.tags,
      })),
      phases: journey.phases.map((ph) => ({
        title: ph.title,
        order: ph.order,
        steps: ph.steps
          .filter((s) => !s.parentStepId)
          .sort((a, b) => a.order - b.order)
          .map(serializeStep),
      })),
      opportunities: journey.opportunities.map((o) => ({
        title: o.title,
        ifClause: o.ifClause,
        thenClause: o.thenClause,
        resultingIn: o.resultingIn,
        painPointIds: o.painPointIds,
        stepIds: o.stepIds,
      })),
      requirements: journey.requirements.map((r) => ({
        tag: r.tag,
        title: r.title,
        bodyJson: r.bodyJson,
        status: r.status,
      })),
      userStories: journey.userStories.map((s) => ({
        title: s.title,
        bodyJson: s.bodyJson,
        status: s.status,
        requirementTitle:
          journey.requirements.find((r) => r.id === s.requirementId)?.title ?? null,
      })),
    },
  };
}

export function isJourneyExportPackV1(value: unknown): value is JourneyExportPackV1 {
  if (!value || typeof value !== "object") return false;
  const o = value as JourneyExportPackV1;
  return o.format === "journey-synthesis-export" && o.version === 1 && !!o.journey?.title;
}