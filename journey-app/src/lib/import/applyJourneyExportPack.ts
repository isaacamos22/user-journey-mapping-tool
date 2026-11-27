import { JourneyStatus, RevisionSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { JourneyExportPackV1, ExportPackStepV1 } from "@/lib/export/journeyPackV1";
import { slugify } from "@/lib/utils";
import { createJourneyRevision } from "@/lib/journey/snapshot";

const VALID_STATUS = new Set<string>(Object.values(JourneyStatus));

async function createStepTree(
  phaseId: string,
  step: ExportPackStepV1,
  parentStepId: string | null
) {
  const created = await prisma.step.create({
    data: {
      phaseId,
      parentStepId,
      title: step.title,
      userAction: step.userAction,
      order: step.order,
      channel: step.channel,
    },
  });

  for (const t of step.touchpoints) {
    await prisma.touchpoint.create({
      data: {
        stepId: created.id,
        module: t.module,
        screen: t.screen,
        panel: t.panel,
        dialog: t.dialog,
      },
    });
  }

  for (const p of step.painPoints) {
    await prisma.painPoint.create({
      data: {
        stepId: created.id,
        description: p.description,
        severity: p.severity ?? 3,
        evidence: p.evidence,
        opportunity: p.opportunity ?? null,
      },
    });
  }

  const feelingRows =
    step.feelings?.length
      ? step.feelings
      : step.thoughtsFeelings
        ? [
            {
              title: step.thoughtsFeelings.freeText?.trim() || "Feeling",
              confidence: step.thoughtsFeelings.confidence,
              frustration: step.thoughtsFeelings.frustration,
              delight: step.thoughtsFeelings.delight,
              freeText: step.thoughtsFeelings.freeText,
            },
          ]
        : [];

  for (const f of feelingRows) {
    await prisma.stepFeeling.create({
      data: {
        stepId: created.id,
        title: f.title ?? "",
        confidence: f.confidence ?? 4,
        frustration: f.frustration ?? 4,
        delight: f.delight ?? 4,
        freeText: f.freeText,
      },
    });
  }

  for (const child of step.children ?? []) {
    await createStepTree(phaseId, { ...child, children: [] }, created.id);
  }

  return created.id;
}

export async function applyJourneyExportPack(pack: JourneyExportPackV1, userId: string) {
  const j = pack.journey;
  const status =
    j.status && VALID_STATUS.has(j.status) ? (j.status as JourneyStatus) : JourneyStatus.DRAFT;

  const journey = await prisma.journey.create({
    data: {
      title: j.title,
      slug: `${slugify(j.title)}-${Date.now().toString(36)}`,
      goal: j.goal,
      businessContext: j.businessContext,
      status,
      members: { create: { userId, role: "OWNER" } },
    },
  });

  for (const persona of j.personas) {
    await prisma.persona.create({
      data: {
        journeyId: journey.id,
        name: persona.name,
        role: persona.role,
        goals: persona.goals,
        frustrations: persona.frustrations,
        tags: persona.tags,
      },
    });
  }

  for (const phase of j.phases.sort((a, b) => a.order - b.order)) {
    const phaseRow = await prisma.phase.create({
      data: { journeyId: journey.id, title: phase.title, order: phase.order },
    });
    for (const step of phase.steps.sort((a, b) => a.order - b.order)) {
      await createStepTree(phaseRow.id, step, null);
    }
  }

  for (const o of j.opportunities) {
    await prisma.opportunity.create({
      data: {
        journeyId: journey.id,
        title: o.title,
        ifClause: o.ifClause,
        thenClause: o.thenClause,
        resultingIn: o.resultingIn,
        painPointIds: o.painPointIds,
        stepIds: o.stepIds,
      },
    });
  }

  const reqByTitle = new Map<string, string>();
  for (const r of j.requirements) {
    const row = await prisma.requirement.create({
      data: {
        journeyId: journey.id,
        tag: r.tag ?? "UX",
        title: r.title,
        bodyJson: r.bodyJson,
        status: r.status ?? "draft",
      },
    });
    reqByTitle.set(r.title, row.id);
  }

  for (const s of j.userStories) {
    const requirementId = s.requirementTitle
      ? reqByTitle.get(s.requirementTitle) ?? null
      : null;
    await prisma.userStory.create({
      data: {
        journeyId: journey.id,
        requirementId,
        title: s.title,
        bodyJson: s.bodyJson,
        status: s.status ?? "draft",
      },
    });
  }

  await createJourneyRevision(journey.id, {
    label: "Imported export pack",
    source: RevisionSource.IMPORT,
    userId,
  });

  return journey.id;
}