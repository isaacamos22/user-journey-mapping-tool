import type { LoadedJourney } from "@/lib/journey/loadJourney";
import { scoreJourney } from "@/lib/completeness/scoreJourney";
import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";
import { parseJsonFromModel } from "@/lib/ai/parseModelJson";
import {
  buildMapContextForAi,
  generateRequirementsHeuristic,
  generateUserStoriesHeuristic,
  maybeEnhanceWithAzureOpenAI,
  type RequirementTemplate,
  type UserStoryTemplate,
} from "@/lib/ai/synthesis";

export type DiscoveryGenerationMode = "ai" | "heuristic";

type MapStep = {
  id: string;
  title: string;
  userAction: string | null;
  painPoints: {
    id: string;
    description: string;
    severity: number;
    evidence: string | null;
    opportunity?: string | null;
  }[];
  touchpoints: {
    module: string | null;
    screen: string | null;
    panel: string | null;
    dialog: string | null;
  }[];
  feelings?: {
    title: string;
    freeText: string | null;
    confidence: number;
    frustration: number;
    delight: number;
  }[];
  children?: MapStep[];
};

type StepRow = {
  step: MapStep;
  phase: LoadedJourney["phases"][0];
  parent?: MapStep;
};

function iterSteps(journey: LoadedJourney): StepRow[] {
  const rows: StepRow[] = [];
  for (const phase of journey.phases) {
    for (const step of phase.steps as MapStep[]) {
      rows.push({ step, phase });
      for (const child of step.children ?? []) {
        rows.push({ step: child, phase, parent: step });
      }
    }
  }
  return rows;
}

function azureConfigured(): boolean {
  return (
    Boolean(process.env.AZURE_OPENAI_ENDPOINT) &&
    Boolean(process.env.AZURE_OPENAI_API_KEY) &&
    Boolean(process.env.AZURE_OPENAI_DEPLOYMENT)
  );
}

function buildRichMapContext(journey: LoadedJourney) {
  const completeness = scoreJourney({
    personas: journey.personas,
    phases: journey.phases,
    opportunities: journey.opportunities,
  });

  const steps = iterSteps(journey).map(({ step, phase, parent }) => ({
    stepId: step.id,
    phase: phase.title,
    kind: parent ? "action" : "step",
    parentStepTitle: parent?.title,
    title: step.title,
    userAction: step.userAction,
    feelings: (step.feelings ?? []).map((f) => ({
      title: f.title,
      note: f.freeText,
      confidence: f.confidence,
      frustration: f.frustration,
      delight: f.delight,
    })),
    pains: step.painPoints.map((p) => ({
      painId: p.id,
      description: p.description,
      severity: p.severity,
      evidence: p.evidence,
      opportunity: p.opportunity,
    })),
    touchpoints: step.touchpoints.map((t) => ({
      module: t.module,
      screen: t.screen,
      panel: t.panel,
      dialog: t.dialog,
    })),
  }));

  return {
    ...buildMapContextForAi(journey),
    businessContext: journey.businessContext,
    goal: journey.goal,
    completenessScore: completeness.score,
    completenessGaps: completeness.gaps.map((g) => g.message),
    opportunities: journey.opportunities.map((o) => ({
      title: o.title,
      ifClause: o.ifClause,
      thenClause: o.thenClause,
      resultingIn: o.resultingIn,
    })),
    personas: journey.personas.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      goals: p.goals,
      frustrations: p.frustrations,
    })),
    steps,
  };
}

type AiRequirement = {
  title: string;
  problemStatement: string;
  businessContext?: string;
  whyImportant?: string;
  businessObjective?: string;
  priority?: "High" | "Medium" | "Low";
  hypothesis?: { if?: string; then?: string; resultingIn?: string };
  inScope?: string;
  outScope?: string;
  constraints?: string;
  edgeCases?: string;
  successCriteria?: string;
  acceptanceCriteria?: string;
  researchEvidence?: string[];
  stepId?: string;
  painId?: string;
  personaId?: string;
};

type AiUserStory = {
  requirementIndex: number;
  title?: string;
  asA?: string;
  iWant?: string;
  soThat?: string;
  designReference?: string;
  userFlow?: string;
  scope?: string;
  dependencies?: string;
  edgeCases?: string;
  acceptanceCriteria?: string;
};

type AiDiscoveryPayload = {
  analysisSummary?: string;
  requirements: AiRequirement[];
  userStories?: AiUserStory[];
};

function painRow(
  journey: LoadedJourney,
  painId: string
): { step: MapStep; phase: LoadedJourney["phases"][0]; parent?: MapStep; pain: MapStep["painPoints"][0] } | null {
  for (const row of iterSteps(journey)) {
    const pain = row.step.painPoints.find((p) => p.id === painId);
    if (pain) return { ...row, pain };
  }
  return null;
}

function stepRow(journey: LoadedJourney, stepId: string): StepRow | null {
  return iterSteps(journey).find((r) => r.step.id === stepId) ?? null;
}

function buildReference(
  journey: LoadedJourney,
  ai: Pick<AiRequirement, "stepId" | "painId" | "personaId">
): DiscoveryReference | undefined {
  const persona = ai.personaId
    ? journey.personas.find((p) => p.id === ai.personaId)
    : undefined;

  let step: StepRow | null = null;
  let pain: MapStep["painPoints"][0] | undefined;

  if (ai.painId) {
    const pr = painRow(journey, ai.painId);
    if (pr) {
      step = { step: pr.step, phase: pr.phase, parent: pr.parent };
      pain = pr.pain;
    }
  }
  if (!step && ai.stepId) {
    step = stepRow(journey, ai.stepId);
    pain = step?.step.painPoints[0];
  }

  const tp = step?.step.touchpoints[0];
  return {
    personaId: persona?.id,
    personaName: persona?.name,
    personaRole: persona?.role,
    personaGoals: persona?.goals,
    personaFrustrations: persona?.frustrations,
    stepId: step?.step.id,
    stepTitle: step?.step.title,
    userAction: step?.step.userAction,
    stepKind: step?.parent ? "action" : step ? "step" : undefined,
    phaseTitle: step?.phase.title,
    parentStepTitle: step?.parent?.title,
    painId: pain?.id,
    painDescription: pain?.description,
    painSeverity: pain?.severity,
    opportunity: pain?.opportunity ?? undefined,
    evidence: pain?.evidence ?? undefined,
    touchpoint: tp
      ? { module: tp.module, screen: tp.screen, panel: tp.panel, dialog: tp.dialog }
      : undefined,
  };
}

function toRequirementTemplate(journey: LoadedJourney, ai: AiRequirement): RequirementTemplate {
  const refs = buildReference(journey, ai);
  const tp = refs?.touchpoint;
  return {
    references: refs,
    tag: "UX",
    title: ai.title.trim().slice(0, 120) || "Improve journey step",
    problemStatement: ai.problemStatement.trim(),
    businessContext:
      ai.businessContext?.trim() ||
      journey.businessContext ||
      `${journey.title} — grounded in mapped pains and persona goals.`,
    whyImportant:
      ai.whyImportant?.trim() || journey.goal || refs?.personaGoals?.trim() || "Reduce friction on this journey.",
    businessObjective: ai.businessObjective?.trim() || "Customer experience",
    priority: ai.priority ?? "Medium",
    hypothesis: {
      if: ai.hypothesis?.if?.trim() || "Users still experience this pain on the mapped step",
      then: ai.hypothesis?.then?.trim() || "We ship a targeted UX improvement",
      resultingIn: ai.hypothesis?.resultingIn?.trim() || refs?.personaGoals?.trim() || "Clearer task completion",
    },
    locations: {
      module: tp?.module ?? undefined,
      screen: tp?.screen ?? undefined,
      panel: tp?.panel ?? undefined,
      dialog: tp?.dialog ?? undefined,
      workflowStep: refs?.userAction ?? refs?.stepTitle,
    },
    researchEvidence:
      ai.researchEvidence?.length ? ai.researchEvidence : [
        ...(refs?.evidence ? [refs.evidence] : []),
        ...(refs?.personaName ? [`Persona: ${refs.personaName}`] : []),
        "Journey map (Discovery AI analysis)",
      ],
    inScope: ai.inScope?.trim() || "UX and copy for the linked step or action",
    outScope: ai.outScope?.trim() || "Unrelated modules and later phases",
    constraints: ai.constraints?.trim() || "Align with platform patterns; validate effort with engineering",
    edgeCases: ai.edgeCases?.trim() || "Permissions, empty states, slow network",
    successCriteria:
      ai.successCriteria?.trim() || "Users complete the step with less confusion; aligns with persona goals",
    acceptanceCriteria:
      ai.acceptanceCriteria?.trim() || "Behaviour matches journey intent; testable acceptance checks in QA",
  };
}

function toUserStoryTemplate(
  req: RequirementTemplate,
  ai: AiUserStory
): UserStoryTemplate {
  return {
    references: req.references,
    title: ai.title?.trim() || req.title,
    asA: ai.asA?.trim() || "user",
    iWant: ai.iWant?.trim() || req.problemStatement.slice(0, 200),
    soThat: ai.soThat?.trim() || req.hypothesis.resultingIn,
    designReference: ai.designReference?.trim() || "Figma / prototype — link when ready",
    userFlow: ai.userFlow?.trim() || req.locations.workflowStep || req.title,
    scope: ai.scope?.trim() || req.inScope,
    dependencies: ai.dependencies?.trim() || "APIs and design tokens as needed",
    edgeCases: ai.edgeCases?.trim() || req.edgeCases,
    acceptanceCriteria: ai.acceptanceCriteria?.trim() || req.acceptanceCriteria,
  };
}

export async function aiDiscoverFromJourney(
  journey: LoadedJourney
): Promise<{
  requirements: RequirementTemplate[];
  stories: UserStoryTemplate[];
  analysisSummary?: string;
} | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !key || !deployment) return null;

  const mapContext = buildRichMapContext(journey);

  try {
    const res = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`,
      {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature: 0.25,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a senior UX strategist. Analyze the journey map JSON and produce discovery outputs.

Return ONE JSON object with:
- analysisSummary: string (2-4 sentences: themes, risks, opportunity areas)
- requirements: array (3-10 items, each grounded in map evidence)
- userStories: array (one per requirement, same order via requirementIndex 0-based)

Each requirement MUST include:
title, problemStatement, whyImportant, priority (High|Medium|Low), hypothesis {if,then,resultingIn},
inScope, outScope, edgeCases, successCriteria, acceptanceCriteria, researchEvidence (string array),
stepId and/or painId from the map (required when a pain exists), personaId when obvious.

Rules:
- Synthesize across the map (personas, pains, opportunities, feelings, completeness gaps) — not generic boilerplate.
- Tie priority to pain severity and persona impact.
- Do not invent steps, pains, or personas not in the map.
- Use TBD only when the map truly lacks data.
- Titles: concise UX outcome statements.`,
            },
            {
              role: "user",
              content: JSON.stringify(mapContext),
            },
          ],
        }),
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = parseJsonFromModel(content) as AiDiscoveryPayload;
    if (!parsed.requirements?.length) return null;

    const requirements = parsed.requirements
      .slice(0, 12)
      .map((r) => toRequirementTemplate(journey, r));

    const stories: UserStoryTemplate[] = [];
    const storyDrafts = parsed.userStories ?? [];

    for (let i = 0; i < requirements.length; i++) {
      const draft =
        storyDrafts.find((s) => s.requirementIndex === i) ??
        storyDrafts[i];
      if (draft) {
        stories.push(toUserStoryTemplate(requirements[i]!, draft));
      } else {
        stories.push(generateUserStoriesHeuristic(journey, [requirements[i]!])[0]!);
      }
    }

    return {
      requirements,
      stories,
      analysisSummary: parsed.analysisSummary?.trim(),
    };
  } catch {
    return null;
  }
}

export async function discoverFromJourney(journey: LoadedJourney): Promise<{
  requirements: RequirementTemplate[];
  stories: UserStoryTemplate[];
  mode: DiscoveryGenerationMode;
  analysisSummary?: string;
}> {
  if (azureConfigured()) {
    const ai = await aiDiscoverFromJourney(journey);
    if (ai && ai.requirements.length > 0) {
      return { ...ai, mode: "ai" };
    }
  }

  let requirements = generateRequirementsHeuristic(journey);
  if (azureConfigured()) {
    requirements = await maybeEnhanceWithAzureOpenAI(journey, requirements);
  }
  const stories = generateUserStoriesHeuristic(journey, requirements);
  return { requirements, stories, mode: "heuristic" };
}