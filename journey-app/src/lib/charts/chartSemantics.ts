/** Shared semantic palette for journey analytics (distinct from brand chrome). */

export const EMOTION_SERIES = {
  confidence: { stroke: "#0d9488", fill: "rgba(13, 148, 136, 0.15)", label: "Confidence" },
  frustration: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.12)", label: "Frustration" },
  delight: { stroke: "#d97706", fill: "rgba(217, 119, 6, 0.15)", label: "Delight" },
} as const;

export const NEUTRAL_BAND = { y: 4, stroke: "#cbd5e1", label: "Neutral (4)" };

/** Severity 1 (mild) → 5 (critical): green → amber → red */
export function painSeverityColor(severity: number): string {
  const v = Math.max(1, Math.min(5, severity));
  const t = (v - 1) / 4;
  const hue = (1 - t) * 95;
  return `hsl(${hue} 72% ${42 + t * 8}%)`;
}

export function painSeverityLabel(severity: number): string {
  if (severity >= 5) return "Critical";
  if (severity >= 4) return "High";
  if (severity >= 3) return "Medium";
  if (severity >= 2) return "Low";
  return "Minimal";
}

/** iOS-style friction chip fill + label for map cards (severity 2–5). */
export const opportunitySurface = {
  background: "rgba(52, 199, 89, 0.14)",
  label: "#248a3d",
} as const;

export function painSeveritySurface(severity: number): { background: string; label: string } {
  const v = Math.max(2, Math.min(5, Math.round(severity)));
  const surfaces: Record<number, { background: string; label: string }> = {
    2: { background: "rgba(52, 199, 89, 0.14)", label: "#248a3d" },
    3: { background: "rgba(255, 204, 0, 0.22)", label: "#9a6f00" },
    4: { background: "rgba(255, 149, 0, 0.2)", label: "#c2410c" },
    5: { background: "rgba(255, 59, 48, 0.16)", label: "#c41e12" },
  };
  return surfaces[v] ?? surfaces[3]!;
}

export function emotionTone(score: number): "positive" | "neutral" | "negative" {
  if (score >= 5) return "positive";
  if (score <= 3) return "negative";
  return "neutral";
}