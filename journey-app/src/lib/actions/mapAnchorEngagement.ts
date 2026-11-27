"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { canWrite, getJourneyRole } from "@/lib/rbac";

async function requireUser() {
  return requireSessionUser();
}

async function assertStepOnJourney(journeyId: string, stepId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT s.id
    FROM Step s
    INNER JOIN Phase p ON s.phaseId = p.id
    WHERE s.id = ${stepId} AND p.journeyId = ${journeyId}
    LIMIT 1
  `;
  if (!rows.length) throw new Error("Step not found");
}

async function ensureFacilitatorAnchor(
  journeyId: string,
  stepId: string,
  kind: string,
  labelKey: string
): Promise<string> {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM MapFacilitatorAnchor
    WHERE journeyId = ${journeyId}
      AND stepId = ${stepId}
      AND kind = ${kind}
      AND labelKey = ${labelKey}
    LIMIT 1
  `;
  if (existing[0]?.id) return existing[0].id;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO MapFacilitatorAnchor (id, journeyId, stepId, kind, labelKey, facilitatorHeart)
    VALUES (${id}, ${journeyId}, ${stepId}, ${kind}, ${labelKey}, 0)
  `;
  return id;
}

export async function toggleFacilitatorAnchorHeart(
  journeyId: string,
  stepId: string,
  kind: "opportunity" | "action",
  labelKey: string,
  hearted: boolean
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await assertStepOnJourney(journeyId, stepId);
  const anchorId = await ensureFacilitatorAnchor(journeyId, stepId, kind, labelKey);
  await prisma.$executeRaw`
    UPDATE MapFacilitatorAnchor SET facilitatorHeart = ${hearted ? 1 : 0} WHERE id = ${anchorId}
  `;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}

export async function addFacilitatorAnchorComment(
  journeyId: string,
  stepId: string,
  kind: "opportunity" | "action",
  labelKey: string,
  body: string
) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const text = body.trim();
  if (!text) throw new Error("Comment is required");
  await assertStepOnJourney(journeyId, stepId);
  const anchorId = await ensureFacilitatorAnchor(journeyId, stepId, kind, labelKey);
  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO Comment (id, journeyId, facilitatorAnchorId, authorId, body, createdAt)
    VALUES (${id}, ${journeyId}, ${anchorId}, ${user.id}, ${text}, ${now})
  `;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}

async function loadAnchorComment(journeyId: string, commentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; authorId: string; body: string; facilitatorAnchorId: string | null }>
  >`
    SELECT id, authorId, body, facilitatorAnchorId
    FROM Comment
    WHERE id = ${commentId} AND journeyId = ${journeyId} AND facilitatorAnchorId IS NOT NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateFacilitatorAnchorComment(journeyId: string, commentId: string, body: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const text = body.trim();
  if (!text) throw new Error("Comment is required");
  const comment = await loadAnchorComment(journeyId, commentId);
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== user.id && !canWrite(role)) throw new Error("Forbidden");
  await prisma.$executeRaw`UPDATE Comment SET body = ${text} WHERE id = ${commentId}`;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}

export async function deleteFacilitatorAnchorComment(journeyId: string, commentId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const comment = await loadAnchorComment(journeyId, commentId);
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== user.id && !canWrite(role)) throw new Error("Forbidden");
  await prisma.$executeRaw`DELETE FROM Comment WHERE id = ${commentId}`;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}