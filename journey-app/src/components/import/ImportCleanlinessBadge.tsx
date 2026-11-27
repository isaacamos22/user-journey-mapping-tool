import type { ImportQualityReport } from "@/lib/import/importQuality";
import { cn } from "@/lib/utils";

export function ImportCleanlinessBadge({
  quality,
  className,
  compact = false,
  tone = "default",
}: {
  quality: ImportQualityReport;
  className?: string;
  compact?: boolean;
  /** Light badge on brand/dark headers (journey chrome). */
  tone?: "default" | "on-brand";
}) {
  const needsClean = quality.needsFigjamCleaning;
  const score = quality.cleanlinessScore;

  const toneClass =
    tone === "on-brand"
      ? needsClean
        ? "border-amber-100/55 bg-white/14 text-amber-50 shadow-sm"
        : "border-white/40 bg-white/16 text-white shadow-sm"
      : needsClean
        ? "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
        : "border-emerald-500/35 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        toneClass,
        className
      )}
      title={
        needsClean
          ? `Import structure ${score}% — FigJam cleaning recommended. ${quality.orderingIssues[0] ?? quality.recommendations[0] ?? ""}`
          : `Import structure ${score}% — grid fidelity looks acceptable.`
      }
    >
      <span aria-hidden>{needsClean ? "⚠" : "✓"}</span>
      {compact ? (
        <span>Import {score}%</span>
      ) : (
        <span>{needsClean ? `FigJam cleanup · ${score}%` : `Import clean · ${score}%`}</span>
      )}
    </span>
  );
}