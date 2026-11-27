"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MemberRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { assertNotGuest } from "@/lib/auth/guestAuth";
import { prisma } from "@/lib/db";
import { canManageMembers, canOwnJourney, getJourneyRole } from "@/lib/rbac";

const INVITE_ROLES: MemberRole[] = [MemberRole.VIEWER, MemberRole.CONTRIBUTOR, MemberRole.FACILITATOR];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function assertCanManage(journeyId: string, userId: string) {
  const role = await getJourneyRole(userId, journeyId);
  if (!canManageMembers(role)) throw new Error("Forbidden");
}

export async function createJourneyInvite(journeyId: string, formData: FormData) {
  const user = await requireSessionUser();
  await assertCanManage(journeyId, user.id);

  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!email.includes("@")) throw new Error("Invalid email");

  const roleRaw = String(formData.get("role") || "CONTRIBUTOR") as MemberRole;
  const role = INVITE_ROLES.includes(roleRaw) ? roleRaw : MemberRole.CONTRIBUTOR;

  const existingMember = await prisma.journeyMember.findFirst({
    where: { journeyId, user: { email } },
  });
  if (existingMember) throw new Error("User is already a member");

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.journeyInvite.create({
    data: {
      journeyId,
      email,
      role,
      token,
      expiresAt,
      invitedByUserId: user.id,
    },
  });

  revalidatePath(`/journeys/${journeyId}/share`);
  return token;
}

export async function revokeJourneyInvite(inviteId: string, journeyId: string) {
  const user = await requireSessionUser();
  await assertCanManage(journeyId, user.id);
  await prisma.journeyInvite.delete({ where: { id: inviteId } });
  revalidatePath(`/journeys/${journeyId}/share`);
}

export async function removeJourneyMember(journeyId: string, memberId: string) {
  const user = await requireSessionUser();
  await assertCanManage(journeyId, user.id);

  const member = await prisma.journeyMember.findUnique({ where: { id: memberId } });
  if (!member || member.journeyId !== journeyId) throw new Error("Not found");
  if (member.role === MemberRole.OWNER) {
    const ownerCount = await prisma.journeyMember.count({
      where: { journeyId, role: MemberRole.OWNER },
    });
    if (ownerCount <= 1) throw new Error("Cannot remove the only owner");
  }

  await prisma.journeyMember.delete({ where: { id: memberId } });
  revalidatePath(`/journeys/${journeyId}/share`);
}

export async function updateMemberRole(journeyId: string, memberId: string, formData: FormData) {
  const user = await requireSessionUser();
  await assertCanManage(journeyId, user.id);

  const nextRole = String(formData.get("role") || "") as MemberRole;
  if (!Object.values(MemberRole).includes(nextRole)) throw new Error("Invalid role");

  const member = await prisma.journeyMember.findUnique({ where: { id: memberId } });
  if (!member || member.journeyId !== journeyId) throw new Error("Not found");

  if (nextRole === MemberRole.OWNER) {
    throw new Error("Use transfer ownership to assign owner");
  }

  if (member.role === MemberRole.OWNER) {
    throw new Error("Transfer ownership before changing the owner role");
  }

  await prisma.journeyMember.update({
    where: { id: memberId },
    data: { role: nextRole },
  });
  revalidatePath(`/journeys/${journeyId}/share`);
}

export async function transferJourneyOwnership(journeyId: string, memberId: string) {
  const user = await requireSessionUser();
  const role = await getJourneyRole(user.id, journeyId);
  if (!canOwnJourney(role)) throw new Error("Forbidden");

  const target = await prisma.journeyMember.findUnique({ where: { id: memberId } });
  if (!target || target.journeyId !== journeyId) throw new Error("Not found");

  await prisma.$transaction([
    prisma.journeyMember.updateMany({
      where: { journeyId, userId: user.id, role: MemberRole.OWNER },
      data: { role: MemberRole.FACILITATOR },
    }),
    prisma.journeyMember.update({
      where: { id: memberId },
      data: { role: MemberRole.OWNER },
    }),
  ]);

  revalidatePath(`/journeys/${journeyId}/share`);
}

export async function acceptJourneyInvite(token: string) {
  const user = await requireSessionUser();
  assertNotGuest(user, "Guests should use a guest link from Share, not an email invite.");
  const invite = await prisma.journeyInvite.findUnique({ where: { token } });
  if (!invite) throw new Error("Invite not found");
  if (invite.acceptedAt) redirect(`/journeys/${invite.journeyId}/map`);
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");

  const email = normalizeEmail(user.email);
  if (email !== normalizeEmail(invite.email)) {
    throw new Error("This invite was sent to a different email address");
  }

  await prisma.$transaction(async (tx) => {
    await tx.journeyMember.upsert({
      where: { journeyId_userId: { journeyId: invite.journeyId, userId: user.id } },
      create: { journeyId: invite.journeyId, userId: user.id, role: invite.role },
      update: {},
    });
    await tx.journeyInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  redirect(`/journeys/${invite.journeyId}/map`);
}