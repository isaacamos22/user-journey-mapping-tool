import { RevisionSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ImportDraft,
  ImportDraftFeeling,
  ImportDraftPain,
  ImportDraftStep,
} from "@/lib/import/types";
import {
  IMPORT_ASSUMED_EVIDENCE,
  assumedBodyCopy,
  meaningfulAssumedTitle,
} from "@/lib/import/importAssumptions";
import {
  expandStepActions,
  type ExpandedActionSeed,
} from "@/lib/import/expandImportActions";
import {
  parseJourneyBusinessContext,
  scoreImportDraftQuality,
  serializeImportQualityMeta,
} from "@/lib/import/importQuality";
import { normalizeHomeCoverImagePath } from "@/lib/home/homeCoverImage";
import { softenIncompleteImportDraft } from "@/lib/import/incompleteImportPhase";
import { sanitizeImportDraftWorkshopRows } from "@/lib/import/workshopRowSemantics";
import { backfillActionLanesForParents } from "@/lib/journey/backfillActionLanes";
import { generateActionRunBlurbFromDraftStep } from "@/lib/journey/actionRunBlurb";
import type { FlowLink } from "@/lib/journey/flowLinks";
import { slugify } from "@/lib/utils";
import { createJourneyRevision } from "@/lib/journey/snapshot";
import {
  resolveFrictionBullets,
  resolveOpportunityBullets,
} from "@/lib/import/splitWorkshopBullets";

function painDescription(pain: ImportDraftPain): string {
  if (pain.assumed) {
    return assumedBodyCopy(pain.description, "Possible friction — validate with workshop notes.");
  }
  return pain.description;
}

function distinctActionLanes(step: ImportDraftStep): number {
  if (!step.actions?.length) return 0;
  return new Set(
    step.actions.map((a, i) =>
      a.actionLane !== undefined && a.actionLane !== null && a.actionLane !== ""
        ? String(a.actionLane)
        : `row-${i + 1}`
    )
  ).size;
}

async function attachMapActionBlurb(
  stepId: string,
  step: ImportDraftStep,
  hasNestedActions: boolean
) {
  if (!hasNestedActions) return;
  if (distinctActionLanes(step) > 1) {
    const manual = step.actionRunBlurb?.trim();
    if (!manual) return;
  }
  const text = (step.actionRunBlurb?.trim() || generateActionRunBlurbFromDraftStep(step)).trim();
  if (!text) return;
  await prisma.stepFeeling.create({
    data: {
      stepId,
      title: "Map action blurb",
      confidence: 4,
      frustration: 4,
      delight: 4,
      freeText: text,
    },
  });
}

async function attachFeelings(stepId: string, feelings: ImportDraftFeeling[] | undefined) {
  if (!feelings?.length) return;
  for (const f of feelings) {
    const title = f.assumed
      ? meaningfulAssumedTitle(f.title || f.freeText || "Workshop sentiment gap")
      : f.title?.trim() || "Feeling";
    const freeText = f.assumed
      ? assumedBodyCopy(f.freeText || "", "Inferred from step context — refine on the map.")
      : f.freeText;
    await prisma.stepFeeling.create({
      data: {
        stepId,
        title,
        confidence: f.confidence ?? 4,
        frustration: f.frustration ?? 4,
        delight: f.delight ?? 4,
        freeText,
      },
    });
  }
}

async function attachTouchpoint(stepId: string, touchpoint: ImportDraftStep["touchpoint"]) {
  if (!touchpoint) return;
  await prisma.touchpoint.create({
    data: {
      stepId,
      module: touchpoint.module,
      screen: touchpoint.screen,
    },
  });
}

async function attachSimplePain(stepId: string, pain: ImportDraftPain | undefined) {
  if (!pain?.description?.trim()) return;
  const created = await prisma.painPoint.create({
    data: {
      stepId,
      description: painDescription(pain),
      severity: pain.severity ?? 3,
      evidence: pain.assumed ? IMPORT_ASSUMED_EVIDENCE : undefined,
    },
  });
  const opp = pain.opportunity?.trim();
  if (opp) {
    try {
      await prisma.$executeRaw`
        UPDATE "PainPoint" SET opportunity = ${opp} WHERE id = ${created.id}
      `;
    } catch {
      /* opportunity column missing until migrate */
    }
  }
}

/** Root phase cards: split workshop friction/opportunity into many pains + Opportunity rows for discovery. */
async function attachPhaseFrictionAndOpportunity(
  journeyId: string,
  stepId: string,
  step: ImportDraftStep,
  pain: ImportDraftPain | undefined
) {
  const severity = pain?.severity ?? 3;
  const assumed = pain?.assumed;
  const frictionItems = resolveFrictionBullets(step, pain);
  const opportunityItems = resolveOpportunityBullets(step, pain);

  for (const desc of frictionItems) {
    const body = assumed
      ? assumedBodyCopy(desc, "Possible friction — validate with workshop notes.")
      : desc;
    await prisma.painPoint.create({
      data: {
        stepId,
        description: body.slice(0, 2000),
        severity,
        evidence: assumed ? IMPORT_ASSUMED_EVIDENCE : undefined,
      },
    });
  }

  for (const title of opportunityItems) {
    await prisma.opportunity.create({
      data: {
        journeyId,
        title: title.slice(0, 500),
        stepIds: stepId,
      },
    });
  }

  if (opportunityItems.length > 0 && frictionItems.length > 0) {
    try {
      const first = await prisma.painPoint.findFirst({
        where: { stepId },
        orderBy: { id: "asc" },
      });
      if (first) {
        await prisma.$executeRaw`
          UPDATE "PainPoint" SET opportunity = ${opportunityItems.join("; ")} WHERE id = ${first.id}
        `;
      }
    } catch {
      /* optional column */
    }
  }
}

async function createActionStep(
  phaseId: string,
  parentStepId: string,
  order: number,
  seed: ExpandedActionSeed
) {
  const actionTitle = seed.userActionAssumed
    ? meaningfulAssumedTitle(seed.userAction).slice(0, 200)
    : seed.title;
  const created = await prisma.step.create({
    data: {
      phaseId,
      parentStepId,
      title: actionTitle,
      userAction: seed.userAction,
      order,
    },
  });
  await attachTouchpoint(created.id, seed.touchpoint);
  const blurb = seed.actionRunBlurb?.trim();
  if (blurb) {
    await prisma.stepFeeling.create({
      data: {
        stepId: created.id,
        title: "Map action blurb",
        confidence: 4,
        frustration: 4,
        delight: 4,
        freeText: blurb,
      },
    });
  }
  return created.id;
}

export async function applyImportDraft(
  draft: ImportDraft,
  userId: string,
  targetJourneyId?: string,
  mode: "create" | "append" = "create"
) {
  draft = sanitizeImportDraftWorkshopRows(softenIncompleteImportDraft(draft));
  const importQuality = scoreImportDraftQuality(draft);
  const homeCoverImage = normalizeHomeCoverImagePath(draft.homeCoverImage);
  if (!homeCoverImage && draft.homeCoverImage?.trim()) {
    console.warn(
      "[import] homeCoverImage ignored — use a public path under /home/covers/, e.g. /home/covers/my-journey.png"
    );
  }
  if (!homeCoverImage) {
    console.warn(
      "[import] homeCoverImage missing — generate new Home cover art on every import (see cursorImportPrompt.ts)"
    );
  }

  let journeyId = mode === "append" ? targetJourneyId : undefined;
  if (!journeyId) {
    const title = draft.title || "Imported journey";
    const journey = await prisma.journey.create({
      data: {
        title,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        goal: draft.sourceNotes,
        businessContext: serializeImportQualityMeta(importQuality, homeCoverImage),
        createdByUserId: userId,
        members: { create: { userId, role: "OWNER" } },
      },
    });
    journeyId = journey.id;
  }

  for (const persona of draft.personas) {
    await prisma.persona.create({
      data: {
        journeyId: journeyId!,
        name: persona.name,
        role: persona.role,
        tags: persona.tags,
        goals: persona.goals,
        frustrations: persona.frustrations,
      },
    });
  }

  const phaseMap = new Map<string, string>();
  for (const phase of draft.phases) {
    const p = await prisma.phase.create({
      data: { journeyId: journeyId!, title: phase.title, order: phaseMap.size },
    });
    phaseMap.set(phase.title, p.id);
  }

  let defaultPhaseId: string | null = null;
  if (phaseMap.size === 0) {
    const p = await prisma.phase.create({
      data: { journeyId: journeyId!, title: "Journey", order: 0 },
    });
    defaultPhaseId = p.id;
    phaseMap.set("General", p.id);
    phaseMap.set("Journey", p.id);
  }

  let order = await prisma.step.count({
    where: { phase: { journeyId: journeyId! } },
  });

  const parentActionGraph: {
    id: string;
    children: {
      id: string;
      order: number;
      parentStepId: string | null;
      actionFlowBranchId?: string | null;
    }[];
  }[] = [];
  const importFlowLinks: FlowLink[] = [];

  function resolvePhaseTitle(step: ImportDraftStep): string {
    return (step.phaseTitle ?? "").trim() || step.title.trim();
  }

  for (const step of draft.steps) {
    const phaseTitle = resolvePhaseTitle(step);
    const phaseId =
      (step.phaseTitle && phaseMap.get(step.phaseTitle)) ||
      phaseMap.get(phaseTitle) ||
      defaultPhaseId ||
      [...phaseMap.values()][0]!;
    const { seeds: actionSeeds, continues: actionContinues } = expandStepActions(step);

    const created = await prisma.step.create({
      data: {
        phaseId,
        title: step.title,
        order: order++,
      },
    });

    const hasSignals =
      step.pain?.description?.trim() ||
      step.opportunity?.trim() ||
      (step.frictions?.length ?? 0) > 0 ||
      (step.opportunities?.length ?? 0) > 0;

    if (actionSeeds.length === 0) {
      await attachTouchpoint(created.id, step.touchpoint);
      if (hasSignals) {
        await attachPhaseFrictionAndOpportunity(journeyId!, created.id, step, step.pain);
      }
      await attachFeelings(created.id, step.feelings);
    } else {
      await attachTouchpoint(created.id, step.touchpoint);
      if (hasSignals) {
        await attachPhaseFrictionAndOpportunity(journeyId!, created.id, step, step.pain);
      }
      await attachFeelings(created.id, step.feelings);

      const laneOrder: string[] = [];
      for (const seed of actionSeeds) {
        if (!laneOrder.includes(seed.actionLane)) laneOrder.push(seed.actionLane);
      }

      const keyToId = new Map<string, string>();
      const children: {
        id: string;
        order: number;
        parentStepId: string | null;
        actionFlowBranchId?: string | null;
      }[] = [];
      let childOrder = 0;

      for (const lane of laneOrder) {
        for (const seed of actionSeeds.filter((s) => s.actionLane === lane)) {
          const childId = await createActionStep(phaseId, created.id, childOrder++, seed);
          keyToId.set(seed.actionKey, childId);
          children.push({
            id: childId,
            order: childOrder - 1,
            parentStepId: created.id,
            actionFlowBranchId: null,
          });
        }
      }

      for (const link of actionContinues) {
        const fromId = keyToId.get(link.fromKey);
        const toId = keyToId.get(link.toKey);
        if (!fromId || !toId || fromId === toId) continue;
        try {
          await prisma.stepFlowLink.create({
            data: {
              journeyId: journeyId!,
              fromStepId: fromId,
              toStepId: toId,
              kind: "continues",
            },
          });
          importFlowLinks.push({ fromStepId: fromId, toStepId: toId });
        } catch {
          /* StepFlowLink table optional until migrate */
        }
      }

      if (children.length) {
        parentActionGraph.push({ id: created.id, children });
      }
    }

    const goal = step.experienceGoal?.trim();
    if (goal) {
      await prisma.stepFeeling.create({
        data: {
          stepId: created.id,
          title: "Experience goal",
          confidence: 4,
          frustration: 4,
          delight: 4,
          freeText: goal,
        },
      });
    }

    await attachMapActionBlurb(created.id, step, actionSeeds.length > 0);
  }

  if (parentActionGraph.length > 0) {
    await backfillActionLanesForParents(parentActionGraph, importFlowLinks);
  }

  await createJourneyRevision(journeyId!, {
    label: "Imported",
    source: RevisionSource.IMPORT,
    userId,
  });

  if (journeyId && mode === "append") {
    const existing = await prisma.journey.findUnique({
      where: { id: journeyId },
      select: { businessContext: true },
    });
    const prev = parseJourneyBusinessContext(existing?.businessContext);
    const coverForMeta = homeCoverImage ?? prev.homeCoverImage;
    await prisma.journey.update({
      where: { id: journeyId },
      data: {
        businessContext: serializeImportQualityMeta(importQuality, coverForMeta),
      },
    });
  }

  return journeyId!;
}