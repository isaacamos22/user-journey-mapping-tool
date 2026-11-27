import { cache } from "react";
import { prisma } from "@/lib/db";

const nestedStepInclude = {
  touchpoints: true,
  painPoints: true,
  feelings: { orderBy: { id: "asc" as const } },
  emotions: true,
};

const stepTreeInclude = {
  orderBy: { order: "asc" as const },
  include: {
    ...nestedStepInclude,
    children: {
      orderBy: { order: "asc" as const },
      include: nestedStepInclude,
    },
  },
};

/** Full graph for snapshots, APIs, and admin flows. */
export const journeyInclude = {
  personas: true,
  phases: {
    orderBy: { order: "asc" as const },
    include: {
      steps: stepTreeInclude,
    },
  },
  opportunities: true,
  members: { include: { user: true } },
  requirements: { include: { stories: true } },
  userStories: true,
  comments: { include: { author: true }, orderBy: { createdAt: "desc" as const }, take: 50 },
  activities: { orderBy: { createdAt: "desc" as const }, take: 30, include: { user: true } },
  revisions: { orderBy: { revisionNumber: "desc" as const }, take: 20 },
  sources: true,
  publishedRevision: true,
};

/** Header, persona rail, and completeness — no nested actions or audit tables. */
export const journeyShellInclude = {
  personas: true,
  opportunities: true,
  phases: {
    orderBy: { order: "asc" as const },
    include: {
      steps: {
        orderBy: { order: "asc" as const },
        include: nestedStepInclude,
      },
    },
  },
};

/** Map / workspace canvas — first phase only, with nested user actions. */
export const journeyWorkspaceInclude = {
  phases: {
    orderBy: { order: "asc" as const },
    take: 1,
    include: {
      steps: stepTreeInclude,
    },
  },
};

export const journeySynthesisInclude = {
  personas: true,
  opportunities: true,
  requirements: { include: { stories: true }, orderBy: { id: "asc" as const } },
  userStories: true,
  phases: {
    orderBy: { order: "asc" as const },
    include: {
      steps: stepTreeInclude,
    },
  },
};

export const journeySummaryInclude = {
  personas: true,
  opportunities: true,
  phases: {
    orderBy: { order: "asc" as const },
    include: {
      steps: stepTreeInclude,
    },
  },
};

export const journeyExportInclude = {
  phases: {
    orderBy: { order: "asc" as const },
    include: {
      steps: {
        orderBy: { order: "asc" as const },
        select: {
          id: true,
          title: true,
          userAction: true,
          parentStepId: true,
          order: true,
          painPoints: {
            select: { id: true, severity: true, description: true, evidence: true },
            orderBy: { id: "asc" as const },
          },
          touchpoints: {
            select: { module: true, screen: true },
            take: 1,
          },
          feelings: {
            select: { title: true, freeText: true },
            take: 6,
          },
        },
      },
    },
  },
};

async function findJourney(idOrSlug: string, include: object) {
  return prisma.journey.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: include as typeof journeyInclude,
  });
}

export const loadJourney = cache((idOrSlug: string) => findJourney(idOrSlug, journeyInclude));

export const loadJourneyShell = cache((idOrSlug: string) => findJourney(idOrSlug, journeyShellInclude));

export const loadJourneyWorkspace = cache((idOrSlug: string) =>
  findJourney(idOrSlug, journeyWorkspaceInclude)
);

export const loadJourneySynthesis = cache((idOrSlug: string) =>
  findJourney(idOrSlug, journeySynthesisInclude)
);

export const loadJourneySummary = cache((idOrSlug: string) => findJourney(idOrSlug, journeySummaryInclude));

export const loadJourneyExport = cache((idOrSlug: string) => findJourney(idOrSlug, journeyExportInclude));

export type LoadedJourney = NonNullable<Awaited<ReturnType<typeof loadJourney>>>;