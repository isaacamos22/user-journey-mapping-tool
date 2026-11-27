import { prisma } from "@/lib/db";
import {
  mergeWorkshopBulletLists,
  splitWorkshopBullets,
} from "@/lib/import/splitWorkshopBullets";

/** Legacy single-string opportunity per step (first PainPoint column). */
export async function loadPainOpportunitiesByStep(
  journeyId: string
): Promise<Map<string, string>> {
  const bullets = await loadOpportunityBulletsByStep(journeyId);
  const map = new Map<string, string>();
  for (const [stepId, items] of bullets) {
    if (items.length) map.set(stepId, items.join("; "));
  }
  return map;
}

/** Opportunity bullets for map cards and discovery (rows + pain column + split cells). */
export async function loadOpportunityBulletsByStep(
  journeyId: string
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  const journeyOpps = await prisma.opportunity.findMany({
    where: { journeyId },
    select: { title: true, stepIds: true },
    orderBy: { id: "asc" },
  });
  for (const o of journeyOpps) {
    const stepId = o.stepIds?.trim();
    const title = o.title.trim();
    if (!stepId || !title) continue;
    const list = map.get(stepId) ?? [];
    list.push(title);
    map.set(stepId, list);
  }

  try {
    const rows = await prisma.$queryRaw<
      { stepId: string; opportunity: string | null }[]
    >`
      SELECT pp."stepId", pp.opportunity
      FROM "PainPoint" pp
      INNER JOIN "Step" s ON s.id = pp."stepId"
      INNER JOIN "Phase" p ON p.id = s."phaseId"
      WHERE p."journeyId" = ${journeyId}
        AND pp.opportunity IS NOT NULL
        AND TRIM(pp.opportunity) <> ''
      ORDER BY pp.id ASC
    `;
    for (const row of rows) {
      const text = row.opportunity?.trim();
      if (!text) continue;
      const fromPain = splitWorkshopBullets(text);
      const existing = map.get(row.stepId) ?? [];
      map.set(row.stepId, mergeWorkshopBulletLists(existing, fromPain));
    }
  } catch {
    /* opportunity column missing until migrate */
  }

  return map;
}