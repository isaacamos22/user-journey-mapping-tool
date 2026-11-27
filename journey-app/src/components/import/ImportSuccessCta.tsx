"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ImportCleanlinessBadge } from "@/components/import/ImportCleanlinessBadge";
import type { ImportQualityReport } from "@/lib/import/importQuality";

export function ImportSuccessCta({
  journeyId,
  importQuality,
}: {
  journeyId: string;
  importQuality?: ImportQualityReport | null;
}) {
  const searchParams = useSearchParams();
  if (searchParams.get("imported") !== "1") return null;

  return (
    <div
      className="fixed left-1/2 z-20 -translate-x-1/2 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-brand/30 bg-surface px-4 py-3 text-sm shadow-lg"
      style={{ top: "calc(var(--app-header-px, 56px) + 12px)" }}
      role="status"
    >
      <span className="text-foreground flex flex-wrap items-center gap-2">
        Import applied. Review the map and personas, then capture requirements in Discovery.
        {importQuality ? <ImportCleanlinessBadge quality={importQuality} /> : null}
      </span>
      <Link
        href={`/journeys/${journeyId}/map`}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
      >
        Open Discovery
      </Link>
    </div>
  );
}