import type { CanvasStep } from "@/components/journey/JourneyCanvas";
import type { loadJourneyExport } from "@/lib/journey/loadJourney";

export function flattenJourneyForMap(
  journey: NonNullable<Awaited<ReturnType<typeof loadJourneyExport>>>,
  branchByStepId: Map<string, string | null>,
  opportunityByStepId: Map<string, string[]>
): { phaseTitles: string[]; steps: CanvasStep[] } {
  const phaseTitles = journey.phases.map((p) => p.title);

  const flat = journey.phases.flatMap((ph) =>
    ph.steps.map((s) => {
      const pains = [...s.painPoints];
      const topPain = [...pains].sort((a, b) => b.severity - a.severity)[0];
      const touch = s.touchpoints[0];
      const experienceGoal =
        s.feelings.find((f) => f.title === "Experience goal")?.freeText?.trim() ?? null;
      const actionRunBlurb =
        s.feelings.find((f) => f.title === "Map action blurb")?.freeText?.trim() ?? null;
      const isRoot = !s.parentStepId;
      const oppBullets = isRoot ? opportunityByStepId.get(s.id) : undefined;
      const painOpportunityItems = isRoot ? (oppBullets ?? []) : [];
      const painFrictionItems = isRoot ? pains.map((p) => p.description).filter(Boolean) : [];
      const painFrictionBullets = isRoot
        ? pains
            .filter((p) => p.description.trim())
            .map((p) => ({
              id: p.id,
              description: p.description,
              hearted: Boolean((p as { facilitatorHeart?: boolean }).facilitatorHeart),
            }))
        : undefined;
      return {
        id: s.id,
        title: s.title,
        userAction: s.userAction,
        parentStepId: s.parentStepId,
        actionFlowBranchId: branchByStepId.get(s.id) ?? null,
        order: s.order,
        phaseTitle: ph.title,
        painSeverity: isRoot ? (topPain?.severity ?? 0) : 0,
        painFrictionItems,
        painFrictionBullets,
        painOpportunityItems,
        touchpoint:
          touch?.module || touch?.screen
            ? [touch.module, touch.screen].filter(Boolean).join(" · ")
            : null,
        experienceGoal,
        actionRunBlurb,
      };
    })
  );

  return { phaseTitles, steps: flat };
}