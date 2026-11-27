type ShellJourney = {
  title: string;
  goal?: string | null;
  personas: { name: string; role?: string | null; goals?: string | null }[];
  phases: { title: string }[];
};

/** First human sentence from import notes in `goal`, if present. */
function leadFromGoal(goal?: string | null): string | null {
  const g = goal?.trim();
  if (!g || g.startsWith("{")) return null;
  const first = g.split(/\n|[.!?]\s/)[0]?.trim();
  if (!first || first.length > 220) return null;
  if (/^figjam|^inventory|^source:/i.test(first) && first.length > 80) return null;
  return first;
}

function lowercaseLead(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function mergeGoalPhrases(goals: string): string {
  const parts = goals
    .split(/[;·]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${lowercaseLead(parts[1])}`;
  return `${parts[0]}, then ${lowercaseLead(parts[parts.length - 1])}`;
}

function phaseSpanSentence(phases: string[]): string | null {
  if (phases.length < 2) return phases[0] ? `Workshop phases include ${phases[0]}.` : null;
  const first = phases[0];
  const last = phases[phases.length - 1];
  return `The map runs from ${first} to ${last}.`;
}

/** Poster tiles are ~200px wide — single visible line. */
const HOME_CARD_SUMMARY_MAX = 72;

function shortenBlurb(text: string, max = HOME_CARD_SUMMARY_MAX): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const slice = normalized.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = (lastSpace > 48 ? slice.slice(0, lastSpace) : slice).trim();
  return `${trimmed}…`;
}

/** Two short prose sentences — who/what/outcome plus phase span when available. */
export function buildHomeJourneyCardSummary(journey: ShellJourney): string {
  const fromGoal = leadFromGoal(journey.goal);
  if (fromGoal) return shortenBlurb(fromGoal);

  const persona = journey.personas[0];
  const phases = journey.phases.map((p) => p.title).filter(Boolean);
  const span = phaseSpanSentence(phases);

  if (persona?.goals?.trim()) {
    const who = persona.name;
    const work = lowercaseLead(mergeGoalPhrases(persona.goals));
    return shortenBlurb(`${who}: ${work}`);
  }

  if (span) return shortenBlurb(span.replace(/^The map runs from /, ""));

  if (persona) {
    return shortenBlurb(`Workshop for ${persona.name}.`);
  }

  return shortenBlurb(journey.title, 80);
}

export type HomeJourneyCardTheme = "drillnet" | "lighthouse" | "mapping";

export const HOME_JOURNEY_CARD_ART: Record<HomeJourneyCardTheme, string> = {
  drillnet: "/home/journey-card-drillnet.png",
  lighthouse: "/home/journey-card-lighthouse.png",
  mapping: "/home/journey-card-mapping.png",
};

/** RGB triplets for poster hover glow (matched to card art). */
export const HOME_JOURNEY_CARD_GLOW: Record<HomeJourneyCardTheme, string> = {
  drillnet: "14 116 144",
  lighthouse: "217 119 6",
  mapping: "79 70 229",
};

export function resolveHomeJourneyCardTheme(title: string): HomeJourneyCardTheme {
  const t = title.toLowerCase();
  if (t.includes("drillnet") || t.includes("drill") || t.includes("ddr")) return "drillnet";
  if (t.includes("lighthouse") || t.includes("lar ") || t.includes("passdown")) return "lighthouse";
  return "mapping";
}