import { notFound } from "next/navigation";
import { loadJourneyExport, loadJourneySynthesis } from "@/lib/journey/loadJourney";
import { flattenJourneySteps } from "@/lib/discovery/flattenJourneySteps";
import { flattenJourneyForMap } from "@/lib/journey/flattenJourneyForMap";
import { loadStepFlowLinks } from "@/lib/journey/loadStepFlowLinks";
import { loadStepBranchIdsForJourney } from "@/lib/journey/loadStepBranchIds";
import { loadOpportunityBulletsByStep } from "@/lib/journey/loadPainOpportunities";
import { loadMapPainEngagement } from "@/lib/journey/loadMapPainEngagement";
import {
  parseRequirementBody,
  parseUserStoryBody,
  defaultRequirementBody,
} from "@/lib/discovery/discoveryText";
import type { DiscoveryRequirementRecord } from "@/components/discovery/RequirementDiscoveryCard";

export async function loadDiscoveryWorkbenchPage(journeyId: string) {
  const journey = await loadJourneySynthesis(journeyId);
  if (!journey) notFound();

  const steps = flattenJourneySteps(journey.phases);

  const mapExport = await loadJourneyExport(journeyId);
  const [flowLinks, branchByStepId, opportunityByStepId] = mapExport
    ? await Promise.all([
        loadStepFlowLinks(journeyId),
        loadStepBranchIdsForJourney(journeyId),
        loadOpportunityBulletsByStep(journeyId),
      ])
    : [
        [] as Awaited<ReturnType<typeof loadStepFlowLinks>>,
        new Map<string, string | null>(),
        new Map<string, string[]>(),
      ];
  const painEngagement = await loadMapPainEngagement(journeyId);
  const mapFlattened = mapExport
    ? flattenJourneyForMap(mapExport, branchByStepId, opportunityByStepId)
    : null;
  const mapPreview = mapFlattened
    ? {
        journeyId: journey.id,
        journeyTitle: journey.title,
        steps: mapFlattened.steps,
        phaseTitles: mapFlattened.phaseTitles,
        flowLinks,
        painEngagement,
      }
    : null;

  const createdAtById: Record<string, string> = {};
  const requirements: DiscoveryRequirementRecord[] = journey.requirements.map((r) => {
    createdAtById[r.id] =
      "createdAt" in r && r.createdAt instanceof Date ? r.createdAt.toISOString() : "";
    const body = parseRequirementBody(r.bodyJson);
    const merged = { ...defaultRequirementBody(), ...body, tag: r.tag, title: r.title };
    return {
      id: r.id,
      tag: r.tag,
      title: r.title,
      status: r.status,
      synthesisBatchId: r.synthesisBatchId,
      body: merged,
      stories: r.stories.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        body: { ...parseUserStoryBody(s.bodyJson), title: s.title },
      })),
    };
  });

  return {
    journeyId: journey.id,
    journeyTitle: journey.title,
    requirements,
    steps,
    createdAtById,
    mapPreview,
  };
}