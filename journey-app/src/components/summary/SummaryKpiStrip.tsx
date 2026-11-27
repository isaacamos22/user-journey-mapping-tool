import type { SummaryKpis } from "@/lib/journey/buildSummaryMetrics";

const cards: { key: keyof SummaryKpis; label: string; accent: string }[] = [
  { key: "steps", label: "Journey steps", accent: "border-l-teal-600" },
  { key: "nestedActions", label: "Nested actions", accent: "border-l-brand" },
  { key: "painPoints", label: "Pain points", accent: "border-l-red-500" },
  { key: "feelings", label: "Feelings", accent: "border-l-amber-500" },
  { key: "opportunities", label: "Opportunities", accent: "border-l-violet-600" },
  { key: "assumedMarkers", label: "Assumed fields", accent: "border-l-slate-400" },
];

export function SummaryKpiStrip({ kpis, dense }: { kpis: SummaryKpis; dense?: boolean }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {cards.map(({ key, label, accent }) => (
        <article
          key={key}
          className={`rounded-md border border-border bg-surface border-l-[3px] ${accent} ${
            dense ? "px-2 py-2" : "px-3 py-2 border-l-4"
          }`}
        >
          <p className="summary-kpi-label">{label}</p>
          <p className="summary-kpi-value">{kpis[key]}</p>
        </article>
      ))}
    </div>
  );
}