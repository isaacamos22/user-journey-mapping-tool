import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SummaryTile({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "min-w-0 w-full rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col",
        className
      )}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 shrink-0">
        <h3 className="summary-tile-title">{title}</h3>
        {hint ? <p className="summary-tile-hint">{hint}</p> : null}
      </header>
      <div className="min-h-0 flex-1 flex flex-col justify-start">{children}</div>
    </article>
  );
}