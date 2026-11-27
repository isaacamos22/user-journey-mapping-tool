import { MemberRole } from "@prisma/client";
import { prisma } from "@/lib/db";

const ROLE_ORDER: Record<MemberRole, number> = {
  VIEWER: 1,
  CONTRIBUTOR: 2,
  FACILITATOR: 3,
  OWNER: 4,
};

function isLocalMode(): boolean {
  return process.env.LOCAL_MODE !== "false";
}

export async function getJourneyRole(
  userId: string,
  journeyId: string
): Promise<MemberRole | null> {
  if (isLocalMode()) {
    const exists = await prisma.journey.findUnique({
      where: { id: journeyId },
      select: { id: true },
    });
    return exists ? MemberRole.OWNER : null;
  }
  const m = await prisma.journeyMember.findUnique({
    where: { journeyId_userId: { journeyId, userId } },
  });
  return m?.role ?? null;
}

export function canRead(role: MemberRole | null): boolean {
  if (isLocalMode()) return role !== null;
  return role !== null;
}

export function canWrite(role: MemberRole | null): boolean {
  if (isLocalMode()) return role !== null;
  return role !== null && ROLE_ORDER[role] >= ROLE_ORDER.CONTRIBUTOR;
}

export function canFacilitate(role: MemberRole | null): boolean {
  if (isLocalMode()) return role !== null;
  return role !== null && ROLE_ORDER[role] >= ROLE_ORDER.FACILITATOR;
}

export function canManageMembers(role: MemberRole | null): boolean {
  if (isLocalMode()) return role !== null;
  return role === MemberRole.OWNER || role === MemberRole.FACILITATOR;
}

export function canOwnJourney(role: MemberRole | null): boolean {
  if (isLocalMode()) return role !== null;
  return role === MemberRole.OWNER;
}