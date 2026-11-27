"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import { ImportSuccessCta } from "@/components/import/ImportSuccessCta";
import { usePathname } from "next/navigation";
import {
  isJourneySummaryPath,
  isJourneyUnifiedWorkbenchPath,
  isJourneyWorkspacePath,
} from "@/lib/navigation/journeySegment";
import type { JourneyInsights } from "@/lib/journey/buildJourneyInsights";
import type { JourneyPersona } from "@/components/journey/PersonaRailPanel";
import {
  JourneyChromeProvider,
  useJourneyChrome,
} from "@/components/journey/JourneyChromeContext";
import { JourneyChromeRail } from "@/components/journey/JourneyChromeRail";
import type { ImportQualityReport } from "@/lib/import/importQuality";
import { cn } from "@/lib/utils";

export function JourneyLayoutFrame({
  journeyId,
  insights,
  personas,
  importQuality,
  children,
}: {
  journeyId: string;
  insights: JourneyInsights;
  personas: JourneyPersona[];
  importQuality?: ImportQualityReport | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [isWorkspace, setIsWorkspace] = useState<boolean | null>(null);
  const [isSummary, setIsSummary] = useState(false);
  const [isDiscovery, setIsDiscovery] = useState(false);

  const unifiedWorkbench = isJourneyUnifiedWorkbenchPath(pathname);

  useEffect(() => {
    setIsWorkspace(isJourneyWorkspacePath(pathname));
    setIsSummary(isJourneySummaryPath(pathname));
    setIsDiscovery(unifiedWorkbench);
  }, [pathname, unifiedWorkbench]);

  return (
    <JourneyChromeProvider
      key={unifiedWorkbench ? "workbench" : "journey-chrome"}
      defaultCollapsed={unifiedWorkbench}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <JourneyChromeRail journeyId={journeyId} insights={insights} personas={personas} />
        <JourneyMainColumn
          journeyId={journeyId}
          isWorkspace={isWorkspace}
          isSummary={isSummary}
          isDiscovery={isDiscovery}
          importQuality={importQuality}
        >
          {children}
        </JourneyMainColumn>
      </div>
    </JourneyChromeProvider>
  );
}

function JourneyMainColumn({
  journeyId,
  isWorkspace,
  isSummary,
  isDiscovery,
  importQuality,
  children,
}: {
  journeyId: string;
  isWorkspace: boolean | null;
  isSummary: boolean;
  isDiscovery: boolean;
  importQuality?: ImportQualityReport | null;
  children: ReactNode;
}) {
  const { railWidth } = useJourneyChrome();
  const isMap = isWorkspace === true;
  const inset = !isMap;

  return (
    <div
      className={cn(
        "min-h-0 w-full min-w-0 flex-1 transition-[padding-left] duration-200 ease-out",
        isMap ? "flex flex-col" : inset && "pt-2"
      )}
      style={{ paddingLeft: railWidth }}
    >
      <div
        className={cn(
          "w-full min-w-0",
          isMap && "flex min-h-0 flex-1 flex-col",
          inset && !isDiscovery && "mx-auto px-2 sm:px-4",
          inset && isDiscovery && "mx-auto w-full max-w-none px-2 sm:px-3",
          inset && !isDiscovery && (isSummary ? "w-full max-w-none" : "max-w-5xl")
        )}
      >
        {isWorkspace ? (
          <Suspense fallback={null}>
            <ImportSuccessCta journeyId={journeyId} importQuality={importQuality} />
          </Suspense>
        ) : null}
        {children}
      </div>
    </div>
  );
}