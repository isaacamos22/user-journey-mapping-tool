"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { canWrite, getJourneyRole } from "@/lib/rbac";

async function requireUser() {
  return requireSessionUser();
}

async function assertPainOnJourney(journeyId: string, painPointId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p.id
    FROM PainPoint p
    INNER JOIN Step s ON p.stepId = s.id
    INNER JOIN Phase ph ON s.phaseId = ph.id
    WHERE p.id = ${painPointId} AND ph.journeyId = ${journeyId}
    LIMIT 1
  `;
  if (!rows.length) throw new Error("Pain point not found");
}

export async function togglePainPointHeart(journeyId: string, painPointId: string, hearted: boolean) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  await assertPainOnJourney(journeyId, painPointId);
  await prisma.$executeRaw`
    UPDATE PainPoint SET facilitatorHeart = ${hearted ? 1 : 0} WHERE id = ${painPointId}
  `;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}

export async function addPainPointComment(journeyId: string, painPointId: string, body: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const text = body.trim();
  if (!text) throw new Error("Comment is required");
  await assertPainOnJourney(journeyId, painPointId);
  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO Comment (id, journeyId, painPointId, authorId, body, createdAt)
    VALUES (${id}, ${journeyId}, ${painPointId}, ${user.id}, ${text}, ${now})
  `;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}

async function loadPainComment(journeyId: string, commentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; authorId: string; body: string; painPointId: string | null }>
  >`
    SELECT id, authorId, body, painPointId
    FROM Comment
    WHERE id = ${commentId} AND journeyId = ${journeyId} AND painPointId IS NOT NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updatePainPointComment(journeyId: string, commentId: string, body: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const text = body.trim();
  if (!text) throw new Error("Comment is required");
  const comment = await loadPainComment(journeyId, commentId);
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== user.id && !canWrite(role)) throw new Error("Forbidden");
  await prisma.$executeRaw`UPDATE Comment SET body = ${text} WHERE id = ${commentId}`;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}

export async function deletePainPointComment(journeyId: string, commentId: string) {
  const user = await requireUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canWrite(role)) throw new Error("Forbidden");
  const comment = await loadPainComment(journeyId, commentId);
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== user.id && !canWrite(role)) throw new Error("Forbidden");
  await prisma.$executeRaw`DELETE FROM Comment WHERE id = ${commentId}`;
  revalidatePath(`/journeys/${journeyId}/map`);
  revalidatePath(`/journeys/${journeyId}/synthesis`);
}