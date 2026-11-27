import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GuidedTour } from "@/components/guidance/GuidedTour";
import { JourneyHomeSessions } from "@/components/home/JourneySessionGrid";
import { prisma } from "@/lib/db";
import {
  getHomeJourneyOrder,
  pruneHomeJourneyOrder,
  setHomeJourneyOrder,
  sortJourneysByHomeOrder,
} from "@/lib/homeJourneyOrder";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { journeyShellInclude } from "@/lib/journey/loadJourney";
import { resolveHomeJourneyCardTheme } from "@/lib/home/homeJourneyCardSummary";
import { parseJourneyBusinessContext } from "@/lib/import/importQuality";

/** Home is per-user and changes on import/delete — do not serve a stale journey list from cache. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  const [journeysRaw, order] = await Promise.all([
    user
      ? prisma.journey.findMany({
          where: { members: { some: { userId: user.id } } },
          include: journeyShellInclude,
        })
      : Promise.resolve([]),
    getHomeJourneyOrder(),
  ]);
  const existingIds = new Set(journeysRaw.map((j) => j.id));
  const prunedOrder = pruneHomeJourneyOrder(order, existingIds);
  if (prunedOrder.length !== order.length) {
    await setHomeJourneyOrder(prunedOrder);
  }
  const journeys = sortJourneysByHomeOrder(journeysRaw, prunedOrder);

  const cards = journeys.map((j) => {
    const { homeCoverImage } = parseJourneyBusinessContext(j.businessContext);
    return {
      id: j.id,
      title: j.title,
      cardTheme: resolveHomeJourneyCardTheme(j.title),
      homeCoverImage,
    };
  });

  return (
    <AppShell>
      <GuidedTour />
      <JourneyHomeSessions
        journeys={cards}
        newSessionForm={
          <Link
            href="/import"
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-hover"
          >
            Import journey
          </Link>
        }
        emptyStateMessage="No user journeys yet. Import a Figma export pack or workshop JSON from Cursor."
        showImportInEmpty
      />
    </AppShell>
  );
}