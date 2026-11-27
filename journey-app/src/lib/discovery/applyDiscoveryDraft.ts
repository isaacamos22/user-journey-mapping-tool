import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { canFacilitate, getJourneyRole } from "@/lib/rbac";
import type { RequirementTemplate, UserStoryTemplate } from "@/lib/ai/synthesis";
import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";
import { defaultRequirementBody } from "@/lib/discovery/discoveryText";

export type DiscoveryDraftRequirement = RequirementTemplate & {
  references?: DiscoveryReference;
  userStory?: UserStoryTemplate;
};

export type DiscoveryDraft = {
  analysisSummary?: string;
  requirements: DiscoveryDraftRequirement[];
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asPriority(v: unknown): RequirementTemplate["priority"] {
  if (v === "High" || v === "Medium" || v === "Low") return v;
  return "Medium";
}

function normalizeRequirement(raw: DiscoveryDraftRequirement): RequirementTemplate {
  const base = defaultRequirementBody();
  const hypothesis = raw.hypothesis ?? base.hypothesis;
  return {
    references: raw.references,
    tag: asString(raw.tag, "UX") || "UX",
    title: asString(raw.title, "Improve journey step") || "Improve journey step",
    problemStatement: asString(raw.problemStatement, base.problemStatement),
    businessContext: asString(raw.businessContext, base.businessContext),
    whyImportant: asString(raw.whyImportant, base.whyImportant),
    businessObjective: asString(raw.businessObjective, base.businessObjective),
    priority: asPriority(raw.priority),
    hypothesis: {
      if: asString(hypothesis.if, base.hypothesis.if),
      then: asString(hypothesis.then, base.hypothesis.then),
      resultingIn: asString(hypothesis.resultingIn, base.hypothesis.resultingIn),
    },
    locations: {
      module: raw.locations?.module,
      screen: raw.locations?.screen,
      panel: raw.locations?.panel,
      dialog: raw.locations?.dialog,
      workflowStep: raw.locations?.workflowStep,
    },
    researchEvidence:
      Array.isArray(raw.researchEvidence) && raw.researchEvidence.length
        ? raw.researchEvidence.map((e) => asString(e)).filter(Boolean)
        : base.researchEvidence,
    inScope: asString(raw.inScope, base.inScope),
    outScope: asString(raw.outScope, base.outScope),
    constraints: asString(raw.constraints, base.constraints),
    edgeCases: asString(raw.edgeCases, base.edgeCases),
    successCriteria: asString(raw.successCriteria, base.successCriteria),
    acceptanceCriteria: asString(raw.acceptanceCriteria, base.acceptanceCriteria),
  };
}

function normalizeUserStory(
  raw: UserStoryTemplate | undefined,
  req: RequirementTemplate
): UserStoryTemplate {
  const title = asString(raw?.title, req.title) || req.title;
  return {
    references: raw?.references ?? req.references,
    title,
    asA: asString(raw?.asA, "user"),
    iWant: asString(raw?.iWant, req.problemStatement.slice(0, 200)),
    soThat: asString(raw?.soThat, req.hypothesis.resultingIn),
    designReference: asString(raw?.designReference, "Figma / prototype — link when ready"),
    userFlow: asString(raw?.userFlow, req.locations.workflowStep ?? req.title),
    scope: asString(raw?.scope, req.inScope),
    dependencies: asString(raw?.dependencies, "APIs and design tokens as needed"),
    edgeCases: asString(raw?.edgeCases, req.edgeCases),
    acceptanceCriteria: asString(raw?.acceptanceCriteria, req.acceptanceCriteria),
  };
}

export function parseDiscoveryDraft(text: string): DiscoveryDraft {
  const parsed = JSON.parse(text) as DiscoveryDraft;
  if (!parsed.requirements?.length) {
    throw new Error("Discovery JSON must include a non-empty requirements array.");
  }
  return parsed;
}

/** If the agent re-runs apply in the same Cursor pass, replace that batch instead of adding set 2. */
const RECENT_BATCH_COALESCE_MS = 4 * 60 * 1000;

export type ApplyDiscoveryOptions = {
  /** Keep all prior sets; always create a new discovery set. Use on a later Cursor chat pass. */
  append?: boolean;
  /** Delete every draft requirement/story before apply (redo from scratch). */
  replaceAll?: boolean;
};

async function deleteSynthesisBatch(journeyId: string, synthesisBatchId: string) {
  await prisma.userStory.deleteMany({
    where: { journeyId, requirement: { synthesisBatchId } },
  });
  await prisma.requirement.deleteMany({ where: { journeyId, synthesisBatchId } });
}

async function coalesceRecentDiscoveryBatch(journeyId: string) {
  const recent = await prisma.requirement.findFirst({
    where: { journeyId, synthesisBatchId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { synthesisBatchId: true, createdAt: true },
  });
  const batchId = recent?.synthesisBatchId;
  if (!batchId || !recent.createdAt) return false;
  if (Date.now() - recent.createdAt.getTime() > RECENT_BATCH_COALESCE_MS) return false;
  await deleteSynthesisBatch(journeyId, batchId);
  return true;
}

export async function applyDiscoveryDraft(
  journeyId: string,
  draft: DiscoveryDraft,
  actorUserId: string,
  options: ApplyDiscoveryOptions = {}
): Promise<{
  synthesisBatchId: string;
  requirementCount: number;
  discoveryPath: string;
  replacedRecentBatch?: boolean;
}> {
  const journey = await prisma.journey.findFirst({
    where: { id: journeyId },
    select: { id: true, title: true },
  });
  if (!journey) throw new Error(`Journey not found: ${journeyId}`);

  const role = await getJourneyRole(actorUserId, journeyId);
  if (!canFacilitate(role)) {
    throw new Error("You need facilitator access on this journey to apply discovery.");
  }

  let replacedRecentBatch = false;
  if (options.replaceAll) {
    await prisma.userStory.deleteMany({ where: { journeyId, requirement: { status: "draft" } } });
    await prisma.requirement.deleteMany({ where: { journeyId, status: "draft" } });
  } else if (!options.append) {
    replacedRecentBatch = await coalesceRecentDiscoveryBatch(journeyId);
  }

  const synthesisBatchId = randomUUID();
  const reqs = draft.requirements.slice(0, 24);

  for (const raw of reqs) {
    const req = normalizeRequirement(raw);
    const story = normalizeUserStory(raw.userStory, req);
    const bodyJson = JSON.stringify({ ...req, references: req.references });

    const rec = await prisma.requirement.create({
      data: {
        journeyId,
        tag: req.tag,
        title: req.title,
        bodyJson,
        status: "draft",
        synthesisBatchId,
      },
    });

    await prisma.userStory.create({
      data: {
        journeyId,
        requirementId: rec.id,
        title: story.title,
        bodyJson: JSON.stringify({ ...story, references: story.references }),
        status: "draft",
      },
    });
  }

  return {
    synthesisBatchId,
    requirementCount: reqs.length,
    discoveryPath: `/journeys/${journeyId}/map`,
    replacedRecentBatch,
  };
}