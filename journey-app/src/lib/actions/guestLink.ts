"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MemberRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";
import { canManageMembers, getJourneyRole } from "@/lib/rbac";

const GUEST_LINK_DAYS = 30;

async function assertCanManage(journeyId: string, userId: string) {
  const role = await getJourneyRole(userId, journeyId);
  if (!canManageMembers(role)) throw new Error("Forbidden");
}

export async function createGuestLink(journeyId: string, formData: FormData) {
  const user = await requireSessionUser();
  await assertCanManage(journeyId, user.id);

  const label = String(formData.get("label") || "").trim() || null;
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + GUEST_LINK_DAYS * 24 * 60 * 60 * 1000);

  await prisma.journeyGuestLink.create({
    data: {
      journeyId,
      token,
      role: MemberRole.VIEWER,
      label,
      expiresAt,
      createdByUserId: user.id,
    },
  });

  revalidatePath(`/journeys/${journeyId}/share`);
  return token;
}

export async function revokeGuestLink(linkId: string, journeyId: string) {
  const user = await requireSessionUser();
  await assertCanManage(journeyId, user.id);

  const link = await prisma.journeyGuestLink.findUnique({ where: { id: linkId } });
  if (!link || link.journeyId !== journeyId) throw new Error("Not found");

  await prisma.journeyGuestLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/journeys/${journeyId}/share`);
}

export async function redeemGuestLink(token: string) {
  const user = await requireSessionUser();
  const link = await prisma.journeyGuestLink.findUnique({ where: { token } });

  if (!link) throw new Error("Link not found");
  if (link.revokedAt) throw new Error("This link has been revoked");
  if (link.expiresAt < new Date()) throw new Error("This link has expired");

  const allowedRoles: MemberRole[] = [MemberRole.VIEWER];
  const role = allowedRoles.includes(link.role) ? link.role : MemberRole.VIEWER;

  await prisma.journeyMember.upsert({
    where: { journeyId_userId: { journeyId: link.journeyId, userId: user.id } },
    create: { journeyId: link.journeyId, userId: user.id, role },
    update: {},
  });

  redirect(`/journeys/${link.journeyId}/map`);
}