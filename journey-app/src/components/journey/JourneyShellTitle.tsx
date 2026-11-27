import { ImportCleanlinessBadge } from "@/components/import/ImportCleanlinessBadge";
import type { ImportQualityReport } from "@/lib/import/importQuality";

export function JourneyShellTitle({
  title,
  score,
  importQuality,
}: {
  title: string;
  score: number;
  importQuality?: ImportQualityReport | null;
}) {
  return (
    <div className="min-w-0 border-l border-white/20 pl-2 ml-1 hidden sm:flex sm:items-center sm:gap-2">
      <p
        className="text-sm text-white truncate leading-snug min-w-0"
        title={`${title} — ${score}% complete`}
      >
        <span className="font-semibold">{title}</span>
        <span className="text-white/80 font-normal text-xs ml-1.5">{score}%</span>
      </p>
      {importQuality ? (
        <ImportCleanlinessBadge
          quality={importQuality}
          compact
          tone="on-brand"
          className="shrink-0 !text-[10px]"
        />
      ) : null}
    </div>
  );
}