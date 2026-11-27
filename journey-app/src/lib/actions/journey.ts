"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { assertNotGuest } from "@/lib/auth/guestAuth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { canRead, canWrite, canFacilitate, canOwnJourney, getJourneyRole } from "@/lib/rbac";
import { MemberRole } from "@prisma/client";
import { createJourneyRevision } from "@/lib/journey/snapshot";
import { setHomeJourneyOrder, getHomeJourneyOrder } from "@/lib/homeJourneyOrder";
import { RevisionSource } from "@prisma/client";
import {
  inheritOrCreateSiblingLaneId,
  writeActionFlowBranchId,
} from "@/lib/journey/actionFlowBranch";

async function requireUser() {
  return requireSessionUser();
}

export async function createJourney(formData: FormData) {
  const user = await requireUser();
  assertNotGuest(user, "Guests cannot create journeys. Open a guest link from your facilitator.");
  const title = String(formData.get("title") || "Untitled journey");
  const journey = await prisma.journey.create({
    data: {
      title,
      slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
      createdByUserId: user.id,
      members: { create: { userId: user.id, role: MemberRole.OWNER } },
      phases: { create: { title: "Main flow", order: 0 } },
    },
  });
  revalidatePath("/");
  redirect(`/journeys/${journey.id}/map`);
}

export async function savePersona(journeyId: string, data: FormData) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const id = data.get("id") as string | null;
  const payload = {
    name: String(data.get("name")),
    role: String(data.get("role") || ""),
    goals: String(data.get("goals") || ""),
    frustrations: String(data.get("frustrations") || ""),
  };
  if (id) {
    await prisma.persona.update({ where: { id }, data: payload });
  } else {
    await prisma.persona.create({ data: { journeyId, ...payload } });
  }
  revalidatePath(`/journeys/${journeyId}`);
}

export async function deletePersona(personaId: string, journeyId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await prisma.persona.delete({ where: { id: personaId } });
  revalidatePath(`/journeys/${journeyId}`);
}

export async function saveStep(phaseId: string, journeyId: string, data: FormData) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const id = data.get("id") as string | null;
  const parentStepId = (data.get("parentStepId") as string | null) || null;
  const newActionFlowBranch = data.get("newActionFlowBranch") === "1";
  const insertAfterRaw = data.get("insertAfterStepId");
  const insertAfterStepId =
    !newActionFlowBranch &&
    typeof insertAfterRaw === "string" &&
    insertAfterRaw.trim().length > 0
      ? insertAfterRaw.trim()
      : null;
  const userAction = String(data.get("userAction") || "");
  const titleRaw = String(data.get("title") || "").trim();
  const payload = {
    title: titleRaw || userAction || "User action",
    userAction,
    channel: String(data.get("channel") || ""),
  };
  const lightSave = data.get("lightSave") === "1";

  if (id) {
    await prisma.step.update({ where: { id }, data: payload });
  } else {
    const priorSiblingCount = parentStepId
      ? await prisma.step.count({ where: { phaseId, parentStepId } })
      : await prisma.step.count({ where: { phaseId, parentStepId: null } });

    let createOrder = priorSiblingCount;
    let actionFlowBranchId: string | null = null;

    if (parentStepId && insertAfterStepId) {
      const anchor = await prisma.step.findFirst({
        where: { id: insertAfterStepId, phaseId, parentStepId },
        select: { id: true, order: true },
      });
      if (anchor) {
        createOrder = anchor.order + 1;
        actionFlowBranchId = await inheritOrCreateSiblingLaneId(insertAfterStepId);
        await prisma.step.updateMany({
          where: { phaseId, parentStepId, order: { gte: createOrder } },
          data: { order: { increment: 1 } },
        });
      } else {
        actionFlowBranchId = await inheritOrCreateSiblingLaneId(insertAfterStepId);
      }
    } else if (parentStepId && newActionFlowBranch) {
      actionFlowBranchId = `lane:${randomUUID()}`;
    }

    const created = await prisma.step.create({
      data: {
        phaseId,
        order: createOrder,
        parentStepId,
        ...payload,
      },
    });

    if (parentStepId && actionFlowBranchId) {
      await writeActionFlowBranchId(created.id, actionFlowBranchId);
    }

    if (parentStepId && insertAfterStepId) {
      try {
        await prisma.stepFlowLink.upsert({
          where: {
            fromStepId_toStepId: {
              fromStepId: insertAfterStepId,
              toStepId: created.id,
            },
          },
          create: {
            journeyId,
            fromStepId: insertAfterStepId,
            toStepId: created.id,
            kind: "continues",
          },
          update: {},
        });
      } catch {
        /* StepFlowLink table optional until migrate */
      }
    }
  }

  if (!lightSave) {
    await createJourneyRevision(journeyId, {
      source: RevisionSource.AUTO_SAVE,
      userId: user.id,
    });
  }
  revalidatePath(`/journeys/${journeyId}/map`);
}

/** Bottom + only: new horizontal lane under a step (not a sibling). */
export async function createActionFlowBranch(
  phaseId: string,
  journeyId: string,
  parentStepId: string,
  userAction: string
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const trimmed = userAction.trim();
  if (!trimmed) throw new Error("User action is required");
  const title = trimmed;

  const laneId = `lane:${randomUUID()}`;
  const priorSiblingCount = await prisma.step.count({
    where: { phaseId, parentStepId },
  });
  // Every bottom+ flow gets its own lane (including the first action under a step).

  const created = await prisma.step.create({
    data: {
      phaseId,
      order: priorSiblingCount,
      parentStepId,
      title,
      userAction: trimmed,
      channel: "",
    },
  });

  await writeActionFlowBranchId(created.id, laneId);

  try {
    const rows = await prisma.$queryRaw<{ actionFlowBranchId: string | null }[]>`
      SELECT "actionFlowBranchId" FROM "Step" WHERE "id" = ${created.id} LIMIT 1
    `;
    const persisted = rows[0]?.actionFlowBranchId;
    if (persisted !== laneId) {
      throw new Error(
        "Could not persist action branch. Ensure database migrations are applied."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Could not persist")) throw e;
    throw new Error(
      "Could not persist action branch. Ensure database migrations are applied."
    );
  }

  revalidatePath(`/journeys/${journeyId}/map`);

  return {
    id: created.id,
    title,
    userAction: trimmed,
    order: priorSiblingCount,
    parentStepId,
    actionFlowBranchId: laneId,
  };
}

export async function saveTouchpoint(stepId: string, journeyId: string, data: FormData) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const existing = await prisma.touchpoint.findFirst({ where: { stepId } });
  const payload = {
    module: String(data.get("module") || ""),
    screen: String(data.get("screen") || ""),
    panel: String(data.get("panel") || ""),
    dialog: String(data.get("dialog") || ""),
  };
  if (existing) await prisma.touchpoint.update({ where: { id: existing.id }, data: payload });
  else await prisma.touchpoint.create({ data: { stepId, ...payload } });
  revalidatePath(`/journeys/${journeyId}`);
}

export async function savePainPoint(stepId: string, journeyId: string, data: FormData) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const id = data.get("id") as string | null;
  const payload = {
    description: String(data.get("description")),
    severity: Number(data.get("severity") || 3),
    evidence: String(data.get("evidence") || ""),
    opportunity: String(data.get("opportunity") || "") || null,
  };
  if (id) {
    await prisma.painPoint.update({ where: { id }, data: payload });
  } else {
    await prisma.painPoint.create({ data: { stepId, ...payload } });
  }
  revalidatePath(`/journeys/${journeyId}`);
}

export async function deletePainPoint(painId: string, journeyId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await prisma.painPoint.delete({ where: { id: painId } });
  revalidatePath(`/journeys/${journeyId}`);
}

export async function deleteStep(stepId: string, journeyId: string, phaseId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const target = await prisma.step.findUnique({
    where: { id: stepId },
    select: { parentStepId: true },
  });
  await prisma.$transaction([
    prisma.step.deleteMany({ where: { parentStepId: stepId } }),
    prisma.step.delete({ where: { id: stepId } }),
  ]);
  const remaining = await prisma.step.findMany({
    where: { phaseId, parentStepId: target?.parentStepId ?? null },
    orderBy: { order: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    await prisma.step.update({ where: { id: remaining[i]!.id }, data: { order: i } });
  }
  revalidatePath(`/journeys/${journeyId}`);
}

export async function reorderSteps(phaseId: string, journeyId: string, stepIds: string[]) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await Promise.all(
    stepIds.map((id, order) => prisma.step.update({ where: { id }, data: { order } }))
  );
  revalidatePath(`/journeys/${journeyId}`);
}

/** Move nested user actions under another root step (supports multi-select). */
export async function reparentChildSteps(
  phaseId: string,
  journeyId: string,
  childStepIds: string[],
  newParentStepId: string,
  beforeChildId?: string | null
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  if (childStepIds.length === 0) return;

  const parent = await prisma.step.findFirst({
    where: { id: newParentStepId, phaseId, parentStepId: null },
    select: { id: true },
  });
  if (!parent) throw new Error("Invalid target step");

  const children = await prisma.step.findMany({
    where: { id: { in: childStepIds }, phaseId, parentStepId: { not: null } },
    select: { id: true, parentStepId: true, order: true },
    orderBy: { order: "asc" },
  });
  if (children.length !== childStepIds.length) throw new Error("Invalid child steps");

  const oldParentIds = [...new Set(children.map((c) => c.parentStepId).filter(Boolean))] as string[];

  const targetSiblings = await prisma.step.findMany({
    where: { phaseId, parentStepId: newParentStepId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  const movingSet = new Set(childStepIds);
  const remainingTarget = targetSiblings.filter((s) => !movingSet.has(s.id));
  let insertAt = beforeChildId ? remainingTarget.findIndex((s) => s.id === beforeChildId) : remainingTarget.length;
  if (insertAt < 0) insertAt = remainingTarget.length;

  const nextTargetIds = [
    ...remainingTarget.slice(0, insertAt).map((s) => s.id),
    ...childStepIds,
    ...remainingTarget.slice(insertAt).map((s) => s.id),
  ];

  await prisma.$transaction(async (tx) => {
    for (let order = 0; order < nextTargetIds.length; order++) {
      const id = nextTargetIds[order]!;
      const patch: { order: number; parentStepId?: string } = { order };
      if (movingSet.has(id)) patch.parentStepId = newParentStepId;
      await tx.step.update({ where: { id }, data: patch });
    }

    for (const oldParentId of oldParentIds) {
      if (oldParentId === newParentStepId) continue;
      const siblings = await tx.step.findMany({
        where: { phaseId, parentStepId: oldParentId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      for (let order = 0; order < siblings.length; order++) {
        await tx.step.update({ where: { id: siblings[order]!.id }, data: { order } });
      }
    }
  });

  revalidatePath(`/journeys/${journeyId}`);
}

export async function saveStepFeeling(stepId: string, journeyId: string, data: FormData) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const id = data.get("id") as string | null;
  const payload = {
    title: String(data.get("title") ?? ""),
    confidence: Number(data.get("confidence") || 4),
    frustration: Number(data.get("frustration") || 4),
    delight: Number(data.get("delight") || 4),
    freeText: String(data.get("freeText") || ""),
  };
  if (id) {
    await prisma.stepFeeling.update({ where: { id }, data: payload });
  } else {
    await prisma.stepFeeling.create({ data: { stepId, ...payload } });
  }
  revalidatePath(`/journeys/${journeyId}`);
}

export async function deleteStepFeeling(feelingId: string, journeyId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await prisma.stepFeeling.delete({ where: { id: feelingId } });
  revalidatePath(`/journeys/${journeyId}`);
}

export async function addComment(journeyId: string, stepId: string | null, body: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canRead(role)) throw new Error("Forbidden");
  await prisma.comment.create({
    data: { journeyId, stepId, authorId: user.id, body },
  });
  await prisma.activityLog.create({
    data: { journeyId, userId: user.id, action: "comment.created", meta: stepId ?? "" },
  });
  revalidatePath(`/journeys/${journeyId}`);
}

export async function updateJourneyMeta(journeyId: string, formData: FormData) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required");
  await prisma.journey.update({
    where: { id: journeyId },
    data: { title },
  });
  revalidatePath("/");
  revalidatePath(`/journeys/${journeyId}`);
}

export async function updateDiscoveryRequirement(
  journeyId: string,
  requirementId: string,
  data: { tag: string; title: string; bodyJson: string }
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await prisma.requirement.update({
    where: { id: requirementId },
    data: {
      tag: data.tag,
      title: data.title,
      bodyJson: data.bodyJson,
    },
  });
}

export async function updateDiscoveryUserStory(
  journeyId: string,
  storyId: string,
  data: { title: string; bodyJson: string }
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await prisma.userStory.update({
    where: { id: storyId },
    data: {
      title: data.title,
      bodyJson: data.bodyJson,
    },
  });
}

function safeRevalidateDiscovery(journeyId: string) {
  try {
    revalidatePath(`/journeys/${journeyId}/synthesis`);
  } catch {
    /* revalidatePath requires a request context — deletes still succeed from Discovery UI */
  }
}

export async function deleteDiscoveryBatch(
  journeyId: string,
  batchId: string,
  requirementIds: string[]
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");

  const uniqueIds = [...new Set(requirementIds.filter(Boolean))];

  if (batchId && !batchId.startsWith("legacy:")) {
    const inBatch = await prisma.requirement.count({
      where: { journeyId, synthesisBatchId: batchId },
    });
    if (inBatch > 0) {
      await prisma.userStory.deleteMany({
        where: { journeyId, requirement: { synthesisBatchId: batchId } },
      });
      await prisma.requirement.deleteMany({
        where: { journeyId, synthesisBatchId: batchId },
      });
      safeRevalidateDiscovery(journeyId);
      return;
    }
  }

  if (!uniqueIds.length) throw new Error("Nothing to delete");

  const owned = await prisma.requirement.findMany({
    where: { journeyId, id: { in: uniqueIds } },
    select: { id: true },
  });
  if (!owned.length) return;

  const deleteIds = owned.map((r) => r.id);
  await prisma.userStory.deleteMany({
    where: { journeyId, requirementId: { in: deleteIds } },
  });
  await prisma.requirement.deleteMany({
    where: { journeyId, id: { in: deleteIds } },
  });

  safeRevalidateDiscovery(journeyId);
}

export async function deleteJourney(journeyId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canOwnJourney(role)) throw new Error("Forbidden");
  await prisma.journey.delete({ where: { id: journeyId } });
  const order = (await getHomeJourneyOrder()).filter((id) => id !== journeyId);
  await setHomeJourneyOrder(order);
  revalidatePath("/");
}

export async function reorderHomeJourneys(orderedIds: string[]) {
  await requireUser();
  const unique = [...new Set(orderedIds)];
  await setHomeJourneyOrder(unique);
  revalidatePath("/");
}