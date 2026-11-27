import type { LoadedJourney } from "@/lib/journey/loadJourney";
import { scoreJourney } from "@/lib/completeness/scoreJourney";
import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";

export type RequirementTemplate = {
  references?: DiscoveryReference;
  tag: string;
  title: string;
  problemStatement: string;
  businessContext: string;
  whyImportant: string;
  businessObjective: string;
  priority: "High" | "Medium" | "Low";
  hypothesis: { if: string; then: string; resultingIn: string };
  locations: { module?: string; screen?: string; panel?: string; dialog?: string; workflowStep?: string };
  researchEvidence: string[];
  inScope: string;
  outScope: string;
  constraints: string;
  edgeCases: string;
  successCriteria: string;
  acceptanceCriteria: string;
};

export type UserStoryTemplate = {
  references?: DiscoveryReference;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  designReference: string;
  userFlow: string;
  scope: string;
  dependencies: string;
  edgeCases: string;
  acceptanceCriteria: string;
};

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

type JourneyPersona = LoadedJourney["personas"][number];

function personaAsA(persona: JourneyPersona): string {
  const role = persona.role?.trim();
  const name = persona.name.trim();
  if (role && name) return `${name}, ${role}`;
  return role || name || "user";
}

function selectPersona(personas: JourneyPersona[], index: number): JourneyPersona | null {
  if (!personas.length) return null;
  return personas[index % personas.length] ?? personas[0] ?? null;
}

function personaRef(persona: JourneyPersona | null): Pick<
  DiscoveryReference,
  "personaId" | "personaName" | "personaRole" | "personaGoals" | "personaFrustrations"
> {
  if (!persona) return {};
  return {
    personaId: persona.id,
    personaName: persona.name,
    personaRole: persona.role,
    personaGoals: persona.goals,
    personaFrustrations: persona.frustrations,
  };
}

function personaResearchLines(persona: JourneyPersona | null): string[] {
  if (!persona) return [];
  const lines = [`Persona: ${personaAsA(persona)}`];
  if (persona.goals?.trim()) lines.push(`Persona goals: ${persona.goals.trim()}`);
  if (persona.frustrations?.trim()) lines.push(`Persona frustrations: ${persona.frustrations.trim()}`);
  return lines;
}

export function buildMapContextForAi(journey: LoadedJourney) {
  const steps = iterSteps(journey).map(({ step, phase }) => ({
    phase: phase.title,
    title: step.title,
    action: step.userAction,
    pains: step.painPoints.map((p) => p.description),
    touchpoints: step.touchpoints,
  }));
  return {
    title: journey.title,
    goal: journey.goal,
    personas: journey.personas.map((p) => ({
      name: p.name,
      role: p.role,
      goals: p.goals,
      frustrations: p.frustrations,
    })),
    steps,
  };
}

export function generateRequirementsHeuristic(journey: LoadedJourney): RequirementTemplate[] {
  const { gaps } = scoreJourney({
    personas: journey.personas,
    phases: journey.phases,
    opportunities: journey.opportunities,
  });
  const topPains = iterSteps(journey)
    .flatMap(({ step, phase, parent }) =>
      step.painPoints.map((pp) => ({ pp, step, phase, parent }))
    )
    .sort((a, b) => b.pp.severity - a.pp.severity)
    .slice(0, 12);

  const stepOpportunities = journey.opportunities
    .filter((o) => o.title?.trim())
    .slice(0, 8);

  if (topPains.length === 0 && journey.opportunities.length === 0) {
    if (journey.personas.length > 0) {
      return journey.personas.map((persona) => ({
        references: personaRef(persona),
        tag: "UX",
        title: persona.goals?.trim().slice(0, 72) || `Support ${persona.name}`,
        problemStatement:
          persona.frustrations?.trim() ||
          gaps.map((g) => g.message).join(" ") ||
          `Friction for ${personaAsA(persona)} on this journey.`,
        businessContext:
          journey.businessContext ||
          `${journey.title} — focused on ${personaAsA(persona)}.`,
        whyImportant: persona.goals?.trim() || journey.goal || "Align UX with this persona.",
        businessObjective: "Customer experience",
        priority: "Medium",
        hypothesis: {
          if: persona.frustrations?.trim()
            ? `${personaAsA(persona)} still faces: ${persona.frustrations.trim().slice(0, 120)}`
            : `We improve the journey for ${personaAsA(persona)}`,
          then: "We ship UX that matches their goals",
          resultingIn: persona.goals?.trim() || "Better outcomes for this persona",
        },
        locations: {},
        researchEvidence: personaResearchLines(persona),
        inScope: persona.goals?.trim() || `Tasks that matter to ${persona.name}`,
        outScope: "Future releases",
        constraints: "TBD — confirm with engineering",
        edgeCases: "TBD — validate with this persona in review",
        successCriteria: persona.goals?.trim()
          ? `${personaAsA(persona)} reports progress toward: ${persona.goals.trim().slice(0, 120)}`
          : `${personaAsA(persona)} completes key journey steps with confidence`,
        acceptanceCriteria: "Test with this persona in mind; behaviour matches agreed UX.",
      }));
    }
    return [
      {
        tag: "UX",
        title: "TBD — needs workshop input",
        problemStatement: gaps.map((g) => g.message).join(" ") || "Insufficient journey data.",
        businessContext: journey.businessContext || "TBD — add personas and pains on the map",
        whyImportant: journey.goal || "TBD",
        businessObjective: "Customer experience",
        priority: "Medium",
        hypothesis: { if: "TBD", then: "TBD", resultingIn: "TBD" },
        locations: {},
        researchEvidence: [],
        inScope: "TBD",
        outScope: "Future releases",
        constraints: "TBD",
        edgeCases: "TBD",
        successCriteria: "TBD",
        acceptanceCriteria: "TBD — define testable requirements after workshop.",
      },
    ];
  }

  const painRequirements = topPains.map(({ pp, step, phase, parent }, i) => {
    const tp = step.touchpoints[0];
    const opp = journey.opportunities[i];
    const oppText = pp.opportunity?.trim() || opp?.title || "";
    const persona = selectPersona(journey.personas, i);
    const personaLabel = persona ? personaAsA(persona) : "journey users";
    const refs: DiscoveryReference = {
      ...personaRef(persona),
      stepId: step.id,
      stepTitle: step.title,
      userAction: step.userAction,
      stepKind: parent ? "action" : "step",
      phaseTitle: phase.title,
      parentStepTitle: parent?.title,
      painId: pp.id,
      painDescription: pp.description,
      painSeverity: pp.severity,
      opportunity: oppText || null,
      evidence: pp.evidence,
      touchpoint: tp
        ? {
            module: tp.module,
            screen: tp.screen,
            panel: tp.panel,
            dialog: tp.dialog,
          }
        : undefined,
    };
    return {
      references: refs,
      tag: "UX",
      title: oppText ? oppText.slice(0, 72) : `Improve: ${pp.description.slice(0, 48)}`,
      problemStatement: persona?.frustrations?.trim()
        ? `${pp.description} (matters for ${personaLabel}: ${persona.frustrations.trim().slice(0, 100)})`
        : pp.description,
      businessContext:
        journey.businessContext ||
        `${journey.title} — ${phase.title}. For ${personaLabel}, this pain shows up during "${step.userAction || step.title}".`,
      whyImportant:
        persona?.goals?.trim() ||
        journey.goal ||
        `Less friction for ${personaLabel} on this step.`,
      businessObjective: "Customer experience",
      priority: pp.severity >= 4 ? ("High" as const) : ("Medium" as const),
      hypothesis: {
        if:
          opp?.ifClause ||
          (persona?.frustrations?.trim()
            ? `${personaLabel} still hits this pain: ${pp.description.slice(0, 80)}`
            : `Users still struggle here (${step.userAction || step.title})`),
        then: opp?.thenClause || (oppText || "We ship a clearer flow and UI for this step"),
        resultingIn:
          opp?.resultingIn ||
          persona?.goals?.trim()?.split(/[.;]/)[0] ||
          "People finish the step with less confusion",
      },
      locations: {
        module: tp?.module ?? undefined,
        screen: tp?.screen ?? undefined,
        panel: tp?.panel ?? undefined,
        dialog: tp?.dialog ?? undefined,
        workflowStep: step.userAction || step.title,
      },
      researchEvidence: [
        ...(pp.evidence ? [pp.evidence] : []),
        ...personaResearchLines(persona),
        ...(pp.evidence || persona ? [] : ["Journey map workshop", "Pain severity on map"]),
      ],
      inScope: oppText
        ? `Changes that deliver: ${oppText}`
        : `Step "${step.title}" — layout, copy, and interactions`,
      outScope: "Other modules and future-phase ideas",
      constraints: "Match current platform patterns; confirm effort with engineering",
      edgeCases: "Slow network, missing permissions, empty data",
      successCriteria: persona?.goals?.trim()
        ? `${personaLabel} can complete this step and move toward: ${persona.goals.trim().slice(0, 100)}`
        : "Users report the step feels clear; task success improves",
      acceptanceCriteria:
        "Behaviour matches the journey step intent; UX matches agreed design; test cases pass in QA.",
    };
  });

  const painTitles = new Set(painRequirements.map((r) => r.title.toLowerCase()));
  const oppRequirements = stepOpportunities
    .filter((o) => !painTitles.has(o.title.trim().toLowerCase().slice(0, 72)))
    .map((opp, i) => {
      const stepId = opp.stepIds?.trim();
      let stepTitle = "Journey phase";
      let phaseTitle = journey.phases[0]?.title ?? "Journey";
      let touch: (typeof journey.phases)[0]["steps"][0]["touchpoints"][0] | undefined;
      if (stepId) {
        for (const phase of journey.phases) {
          const step = phase.steps.find((s) => s.id === stepId);
          if (step) {
            stepTitle = step.title;
            phaseTitle = phase.title;
            touch = step.touchpoints[0];
            break;
          }
        }
      }
      const persona = selectPersona(journey.personas, i + painRequirements.length);
      const personaLabel = persona ? personaAsA(persona) : "journey users";
      return {
        references: {
          ...personaRef(persona),
          stepId: stepId ?? undefined,
          stepTitle,
          phaseTitle,
          opportunity: opp.title,
        },
        tag: "UX" as const,
        title: opp.title.slice(0, 72),
        problemStatement: `Workshop opportunity on ${phaseTitle}: ${opp.title}`,
        businessContext: `${journey.title} — ${phaseTitle} (${stepTitle}).`,
        whyImportant: journey.goal || `Deliver this improvement for ${personaLabel}.`,
        businessObjective: "Customer experience",
        priority: "Medium" as const,
        hypothesis: {
          if: `${personaLabel} still lacks: ${opp.title.slice(0, 100)}`,
          then: `We implement: ${opp.title.slice(0, 120)}`,
          resultingIn: persona?.goals?.trim()?.split(/[.;]/)[0] || "Less friction on this phase",
        },
        locations: {
          module: touch?.module ?? undefined,
          screen: touch?.screen ?? undefined,
          workflowStep: stepTitle,
        },
        researchEvidence: ["Workshop opportunities row", "Journey map import"],
        inScope: opp.title,
        outScope: "Other modules and future-phase ideas",
        constraints: "Match current platform patterns; confirm effort with engineering",
        edgeCases: "Slow network, missing permissions, empty data",
        successCriteria: `Stakeholders see ${opp.title.slice(0, 80)} delivered on the map step`,
        acceptanceCriteria: "Behaviour matches the opportunity intent; UX signed off in review.",
      };
    });

  return [...painRequirements, ...oppRequirements].slice(0, 16);
}

export function generateUserStoriesHeuristic(
  journey: LoadedJourney,
  requirements: RequirementTemplate[]
): UserStoryTemplate[] {
  return requirements.map((req, i) => {
    const fromRef = req.references?.personaId
      ? journey.personas.find((p) => p.id === req.references!.personaId)
      : null;
    const persona = fromRef ?? selectPersona(journey.personas, i);
    const asA = persona ? personaAsA(persona) : "user";
    const goalSnippet = persona?.goals?.trim().split(/[.;]/)[0]?.trim();

    return {
    references: req.references,
    title: req.title,
    asA,
    iWant:
      req.references?.opportunity?.trim() ||
      (persona?.frustrations?.trim()
        ? `avoid or fix: ${persona.frustrations.trim().slice(0, 100)}`
        : req.problemStatement.slice(0, 160)),
    soThat: goalSnippet || req.hypothesis.resultingIn,
    designReference: "Figma / prototype — link when ready",
    userFlow: persona
      ? `As ${asA}, at ${req.locations.workflowStep || req.title} → outcome supports their goal`
      : `${req.locations.workflowStep || req.title} → expected outcome is obvious`,
    scope: req.inScope,
    dependencies: "Backend APIs and design tokens as needed",
    edgeCases: req.edgeCases,
    acceptanceCriteria: persona
      ? `${req.acceptanceCriteria} Validated for ${asA}.`
      : req.acceptanceCriteria,
  };
  });
}

export async function maybeEnhanceWithAzureOpenAI(
  journey: LoadedJourney,
  reqs: RequirementTemplate[]
): Promise<RequirementTemplate[]> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !key || !deployment) return reqs;

  try {
    const res = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`,
      {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Refine requirement drafts using ONLY the journey map. Return JSON: {"requirements": RequirementTemplate[]}. Preserve step/pain links. Mark unknowns TBD.',
            },
            {
              role: "user",
              content: JSON.stringify({ journey: buildMapContextForAi(journey), drafts: reqs }),
            },
          ],
        }),
      }
    );
    if (!res.ok) return reqs;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return reqs;
    const parsed = JSON.parse(content) as { requirements?: RequirementTemplate[] } | RequirementTemplate[];
    return Array.isArray(parsed) ? parsed : (parsed.requirements ?? reqs);
  } catch {
    return reqs;
  }
}

export function requirementToMarkdown(r: RequirementTemplate): string {
  return `# [${r.tag}] ${r.title}

## Problem statement
${r.problemStatement}

## Business Context
${r.businessContext}

### Why is this important?
${r.whyImportant}

### Business objective
${r.businessObjective}

### Priority
${r.priority}

## Hypothesis
- If… ${r.hypothesis.if}
- Then… ${r.hypothesis.then}
- Resulting in… ${r.hypothesis.resultingIn}

## Locations
- Module: ${r.locations.module ?? "TBD"}
- Screen: ${r.locations.screen ?? "TBD"}
- Panel: ${r.locations.panel ?? "TBD"}
- Dialog: ${r.locations.dialog ?? "TBD"}
- Workflow step: ${r.locations.workflowStep ?? "TBD"}

## Research & Evidence
${r.researchEvidence.map((e) => `- ${e}`).join("\n")}

## In Scope
${r.inScope}

## Out Scope
${r.outScope}

## Constraints
${r.constraints}

## Edge Cases
${r.edgeCases}

## Success Criteria
${r.successCriteria}

## Acceptance Criteria (High-level)
${r.acceptanceCriteria}
`;
}

export function userStoryToMarkdown(s: UserStoryTemplate): string {
  return `# [UX] ${s.title}

## Description
As a ${s.asA}
I want ${s.iWant}
So that ${s.soThat}

## Design Reference
${s.designReference}

## User Flow / Scenario
${s.userFlow}

## Scope
${s.scope}

## Dependencies
${s.dependencies}

## Edge Cases
${s.edgeCases}

## Acceptance Criteria
${s.acceptanceCriteria}
`;
}