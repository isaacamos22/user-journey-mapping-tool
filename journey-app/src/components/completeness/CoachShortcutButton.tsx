"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { parseCoachFromUrl } from "@/components/journey/WorkspaceStepFocus";
import { applyJourneyCoachFocus } from "@/lib/completeness/journeyCoach";
import { cn } from "@/lib/utils";

export function CoachShortcutButton({
  href,
  label,
  compact,
}: {
  href: string;
  label: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pathOnly = href.split("?")[0] ?? "";
  const samePage = Boolean(pathname && pathOnly && pathname === pathOnly);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!samePage) return;
    const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    const detail = parseCoachFromUrl(new URLSearchParams(query));
    if (!detail) return;
    e.preventDefault();
    router.replace(href, { scroll: false });
    window.setTimeout(() => applyJourneyCoachFocus(detail), 0);
  };

  return (
    <Link
      href={href}
      scroll={!samePage}
      onClick={onClick}
      className={cn(
        "mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand/12 px-2 py-1 font-semibold text-brand",
        "hover:bg-brand/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
        compact ? "text-[11px]" : "text-xs"
      )}
    >
      {label}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}