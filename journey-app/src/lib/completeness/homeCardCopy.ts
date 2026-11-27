import type { ImportQualityReport } from "@/lib/import/importQuality";
import type { CompletenessResult } from "@/lib/completeness/scoreJourney";

export type HomeInformationCardCopy = {
  headline: string;
  subline: string;
  tips: string[];
};

function gapPriority(g: CompletenessResult["gaps"][number]): number {
  return g.severity === "warn" ? 0 : 1;
}

/** Home card: what to fill in on the map (not import / file fidelity). */
export function buildHomeInformationCardCopy(
  result: CompletenessResult,
  importQuality?: ImportQualityReport | null
): HomeInformationCardCopy | null {
  const tips: string[] = [];

  if (importQuality && importQuality.assumedFieldCount > 0) {
    tips.push(
      importQuality.assumedFieldCount === 1
        ? "One map field was auto-filled—open the map and set the right wording."
        : `${importQuality.assumedFieldCount} map fields were auto-filled—confirm them on the map.`
    );
  }

  const sortedGaps = [...result.gaps].sort((a, b) => gapPriority(a) - gapPriority(b));
  for (const g of sortedGaps) {
    tips.push(g.message);
  }

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const tip of tips) {
    const key = tip.toLowerCase().slice(0, 72);
    if (!tip || seen.has(key)) continue;
    seen.add(key);
    uniq.push(tip);
  }

  if (uniq.length === 0) return null;

  const score = result.score;
  const headline =
    score >= 88
      ? "Small gaps to close"
      : score >= 72
        ? "Add missing journey details"
        : score >= 50
          ? "Build out the map"
          : "Start with core information";

  return {
    headline,
    subline:
      "What’s filled in on the map: personas, user actions, touchpoints, pains, and opportunities.",
    tips: uniq.slice(0, 2),
  };
}