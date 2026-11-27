import { prisma } from "@/lib/db";

const ORDER_KEY = "homeJourneyOrder";

export async function getHomeJourneyOrder(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: ORDER_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function setHomeJourneyOrder(orderedIds: string[]): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: ORDER_KEY },
    create: { key: ORDER_KEY, value: JSON.stringify(orderedIds) },
    update: { value: JSON.stringify(orderedIds) },
  });
}

/** Drop IDs that no longer exist (e.g. after delete + re-import). */
export function pruneHomeJourneyOrder(order: string[], existingIds: Set<string>): string[] {
  const pruned = order.filter((id) => existingIds.has(id));
  return pruned.length === order.length ? order : pruned;
}

export function sortJourneysByHomeOrder<T extends { id: string; updatedAt: Date }>(
  journeys: T[],
  order: string[]
): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...journeys].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}