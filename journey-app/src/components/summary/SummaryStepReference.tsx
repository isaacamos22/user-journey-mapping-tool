"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";
import type { JourneyCoachField, JourneyCoachTab } from "@/lib/completeness/journeyCoach";
import { cn } from "@/lib/utils";
import { useSummaryStepModalOptional } from "@/components/summary/SummaryStepModalHost";

export function SummaryStepReference({
  journeyId: _journeyId,
  stepId,
  tab = "details",
  field,
  children,
  className,
  title = "Open step editor",
}: {
  journeyId: string;
  stepId: string;
  tab?: JourneyCoachTab;
  field?: JourneyCoachField;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const modal = useSummaryStepModalOptional();

  const onClick = (e: MouseEvent) => {
    if (!modal) return;
    e.preventDefault();
    modal.openStep(stepId, tab, field);
  };

  if (!modal) {
    return <div className={className}>{children}</div>;
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "block w-full text-left rounded-lg transition-colors",
        "hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Optional footer link when modal is unavailable (e.g. exports). */
export function SummaryMapLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("font-semibold text-brand hover:underline", className)}>
      {children}
    </Link>
  );
}