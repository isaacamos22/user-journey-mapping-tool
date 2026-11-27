import { buildSummaryMetrics } from "@/lib/journey/buildSummaryMetrics";
import {
  computeMapCoverageScore,
  mapCoverageDepth,
} from "@/lib/journey/computeMapCoverage";
import type { DepthTier } from "@/lib/completeness/scoreJourney";

type ShellStep = {
  id: string;
  title: string;
  parentStepId?: string | null;
  userAction?: string | null;
  painPoints: {
    description: string;
    severity: number;
    evidence?: string | null;
    opportunity?: string | null;
  }[];
  feelings: { confidence: number; frustration: number; delight: number; title?: string }[];
  emotions?: { confidence: number; frustration: number; delight: number } | null;
};

type ShellPhase = { id: string; title: string; steps: ShellStep[] };

export type JourneyInsightHighlight = {
  id: string;
  label: string;
  detail: string;
  emphasis?: "neutral" | "attention";
  /** Map step to focus when this highlight is activated (pain hotspots). */
  stepId?: string;
};

export type JourneyPainHotspot = {
  stepId: string;
  /** Phase column title (matches map). */
  phaseTitle: string;
  severity: number;
  snippet: string;
};

export type JourneyPhaseFriction = {
  phase: string;
  /** Peak severity on any step in the phase (same signal as map cards). */
  peakSeverity: number;
  painCount: number;
};

export type JourneyInsights = {
  narrative: string;
  coverageScore: number;
  coverageLabel: string;
  persona?: { name: string; role?: string | null };
  painHotspots: JourneyPainHotspot[];
  phaseFriction: JourneyPhaseFriction[];
  kpis: {
    phases: number;
    steps: number;
    nestedActions: number;
    painPoints: number;
    opportunities: number;
    assumedMarkers: number;
  };
  highlights: JourneyInsightHighlight[];
};

const COVERAGE_LABEL: Record<DepthTier, string> = {
  shallow: "Light coverage",
  adequate: "Balanced coverage",
  strong: "Rich coverage",
};

function phasesWithStepTree(phases: ShellPhase[]) {
  return phases.map((ph) => ({
    id: ph.id,
    title: ph.title,
    steps: ph.steps
      .filter((s) => !s.parentStepId)
      .map((s) => ({
        ...s,
        children: ph.steps.filter((c) => c.parentStepId === s.id),
      })),
  }));
}

export function buildJourneyInsights(journey: {
  personas: { name: string; role?: string | null }[];
  phases: ShellPhase[];
  opportunities: unknown[];
  sourceNotes?: string | null;
}): JourneyInsights {
  const mapCoverageScore = computeMapCoverageScore(journey.phases);
  const depth = mapCoverageDepth(mapCoverageScore);
  const treePhases = phasesWithStepTree(journey.phases);
  const { kpis, painData, phaseInsights } = buildSummaryMetrics({
    phases: treePhases,
    opportunities: journey.opportunities,
  });

  const personaLine =
    journey.personas.length === 0
      ? "No personas were captured in this import."
      : journey.personas.length === 1
        ? `Primary persona: ${journey.personas[0]!.name}${journey.personas[0]!.role ? ` (${journey.personas[0]!.role})` : ""}.`
        : `${journey.personas.length} personas: ${journey.personas.map((p) => p.name).join(", ")}.`;

  const narrativeParts = [
    `${kpis.phases} phase${kpis.phases === 1 ? "" : "s"}, ${kpis.steps} step${kpis.steps === 1 ? "" : "s"}, and ${kpis.nestedActions} nested action${kpis.nestedActions === 1 ? "" : "s"}.`,
    personaLine,
  ];

  if (kpis.painPoints > 0) {
    const topPhase = [...phaseInsights].sort(
      (a, b) =>
        b.peakPainSeverity - a.peakPainSeverity ||
        b.avgPainSeverity - a.avgPainSeverity ||
        b.painCount - a.painCount
    )[0];
    if (topPhase && topPhase.painCount > 0) {
      narrativeParts.push(
        `Pain signals are strongest in “${topPhase.phase}” (${topPhase.painCount} point${topPhase.painCount === 1 ? "" : "s"} across ${topPhase.stepCount} step${topPhase.stepCount === 1 ? "" : "s"}).`
      );
    }
  } else {
    narrativeParts.push("No pain points were recorded on this map.");
  }

  const highlights: JourneyInsightHighlight[] = [];

  highlights.push({
    id: "scope",
    label: "Scope",
    detail: `${kpis.phases} phases · ${kpis.steps} steps · ${kpis.nestedActions} actions`,
  });

  if (kpis.painPoints > 0) {
    for (const row of painData.slice(0, 3)) {
      highlights.push({
        id: `pain-${row.stepId}`,
        stepId: row.stepId,
        label: "Pain hotspot",
        detail: `${row.step} — ${row.topPain || "unspecified"} (severity ${row.severity})`,
        emphasis: row.severity >= 4 ? "attention" : "neutral",
      });
    }
  }

  if (kpis.opportunities > 0) {
    highlights.push({
      id: "opportunities",
      label: "Opportunities",
      detail: `${kpis.opportunities} improvement idea${kpis.opportunities === 1 ? "" : "s"} linked to the journey.`,
    });
  }

  if (kpis.assumedMarkers > 0) {
    highlights.push({
      id: "assumed",
      label: "Import assumptions",
      detail: `${kpis.assumedMarkers} field${kpis.assumedMarkers === 1 ? "" : "s"} marked as assumed during import.`,
      emphasis: "attention",
    });
  }

  const avgFrustration = phaseInsights
    .map((p) => p.avgFrustration)
    .filter((n) => n > 0);
  if (avgFrustration.length) {
    const peak = Math.max(...avgFrustration);
    const label =
      peak >= 3.5 ? "elevated frustration" : peak >= 2.5 ? "moderate frustration" : "low frustration";
    highlights.push({
      id: "emotion",
      label: "Emotional tone",
      detail: `Average frustration across phases suggests ${label} (scale 1–5).`,
    });
  }

  const stepById = new Map<string, { phaseTitle: string; step: ShellStep }>();
  for (const ph of journey.phases) {
    for (const s of ph.steps) {
      stepById.set(s.id, { phaseTitle: ph.title, step: s });
    }
  }

  const painHotspots = painData.slice(0, 5).map((row) => {
    const hit = stepById.get(row.stepId);
    const pains = hit?.step.painPoints ?? [];
    const topPain = [...pains].sort((a, b) => b.severity - a.severity)[0];
    const rawSnippet = row.topPain || topPain?.description || "Friction noted";
    return {
      stepId: row.stepId,
      phaseTitle: hit?.phaseTitle ?? row.step,
      severity: row.severity,
      snippet: rawSnippet.split(/[;•\n]/)[0]?.trim().slice(0, 72) || "Friction noted",
    };
  });

  const phaseFriction = [...phaseInsights]
    .filter((p) => p.peakPainSeverity > 0)
    .sort(
      (a, b) =>
        b.peakPainSeverity - a.peakPainSeverity ||
        b.painCount - a.painCount ||
        b.avgPainSeverity - a.avgPainSeverity
    )
    .map((p) => ({
      phase: p.phase,
      peakSeverity: p.peakPainSeverity,
      painCount: p.painCount,
    }));

  const persona =
    journey.personas.length > 0
      ? { name: journey.personas[0]!.name, role: journey.personas[0]!.role }
      : undefined;

  return {
    narrative: narrativeParts.join(" "),
    coverageScore: mapCoverageScore,
    coverageLabel: COVERAGE_LABEL[depth],
    persona,
    painHotspots,
    phaseFriction,
    kpis: {
      phases: kpis.phases,
      steps: kpis.steps,
      nestedActions: kpis.nestedActions,
      painPoints: kpis.painPoints,
      opportunities: kpis.opportunities,
      assumedMarkers: kpis.assumedMarkers,
    },
    highlights,
  };
}