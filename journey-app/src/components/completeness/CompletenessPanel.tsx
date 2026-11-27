import type { CompletenessResult } from "@/lib/completeness/scoreJourney";
import { completenessBarColor, completenessTrackColor } from "@/lib/completeness/completenessColors";
import { cn } from "@/lib/utils";

export function CompletenessPanel({
  journeyId: _journeyId,
  result,
  compact = false,
  readOnly = false,
}: {
  journeyId: string;
  result: CompletenessResult;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const barColor = completenessBarColor(result.score);
  const trackColor = completenessTrackColor(result.score);

  return (
    <div
      className={cn(
        "m3-panel m3-panel-tonal",
        compact ? "p-3 mt-3" : "p-4"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
          {readOnly ? "Journey insights" : "Journey coach"}
        </h3>
        <span className="m3-eyebrow text-on-surface-variant normal-case tracking-normal">
          {result.depth}
        </span>
      </div>
      <div
        className={cn("h-2 rounded-full overflow-hidden", compact ? "mb-2" : "mb-3")}
        style={{ backgroundColor: trackColor }}
        role="progressbar"
        aria-valuenow={result.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={readOnly ? "Journey analysis coverage" : "Journey completeness"}
      >
        <div
          className="h-full transition-all rounded-full"
          style={{ width: `${result.score}%`, backgroundColor: barColor }}
        />
      </div>
      <p
        className={cn("font-bold tabular-nums", compact ? "text-xl mb-2" : "text-2xl mb-4")}
        style={{ color: barColor }}
      >
        {result.score}%
      </p>
      <ul className={cn("space-y-2", compact ? "text-xs leading-snug" : "m3-body")}>
        {result.gaps.slice(0, 6).map((g) => (
            <li
              key={g.id}
              className={cn(
                "rounded-lg",
                compact ? "px-2.5 py-2" : "px-3 py-2.5",
                g.severity === "warn"
                  ? "bg-amber-50 text-amber-950"
                  : "bg-surface-container-high text-foreground"
              )}
            >
              <p>
                <span className="font-semibold">{g.section}</span>
                <span className="text-foreground/40"> · </span>
                {g.message}
              </p>
            </li>
          ))}
      </ul>
    </div>
  );
}