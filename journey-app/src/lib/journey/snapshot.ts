import { RevisionSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { journeyInclude } from "@/lib/journey/loadJourney";
import { scoreJourney } from "@/lib/completeness/scoreJourney";

export async function createJourneyRevision(
  journeyId: string,
  opts: { label?: string; source: RevisionSource; userId?: string }
) {
  const journey = await prisma.journey.findUniqueOrThrow({
    where: { id: journeyId },
    include: journeyInclude,
  });
  const last = await prisma.journeyRevision.findFirst({
    where: { journeyId },
    orderBy: { revisionNumber: "desc" },
  });
  const revisionNumber = (last?.revisionNumber ?? 0) + 1;
  const { score } = scoreJourney({
    personas: journey.personas,
    phases: journey.phases,
    opportunities: journey.opportunities,
  });
  const revision = await prisma.journeyRevision.create({
    data: {
      journeyId,
      revisionNumber,
      label: opts.label,
      source: opts.source,
      completenessScore: score,
      snapshotJson: JSON.stringify(journey),
      createdById: opts.userId,
    },
  });
  await prisma.journey.update({
    where: { id: journeyId },
    data: { completenessScore: score },
  });
  return revision;
}

export async function publishJourney(journeyId: string, userId: string) {
  const rev = await createJourneyRevision(journeyId, {
    label: "Published",
    source: RevisionSource.PUBLISH,
    userId,
  });
  await prisma.journey.update({
    where: { id: journeyId },
    data: { status: "PUBLISHED", publishedRevisionId: rev.id },
  });
  await prisma.activityLog.create({
    data: { journeyId, userId, action: "journey.published", meta: rev.id },
  });
  return rev;
}