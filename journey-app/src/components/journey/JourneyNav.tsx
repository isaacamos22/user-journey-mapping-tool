import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLocalWorkbenchModeClient } from "@/lib/runtime/appMode";

const ALL_LINKS: {
  href: string;
  label: string;
  icon: LucideIcon;
  legacySegments?: string[];
}[] = [
  {
    href: "share",
    label: "Share",
    icon: Users,
    legacySegments: ["workspace", "export", "summary", "synthesis"],
  },
];

function journeyNavLinks() {
  const local = isLocalWorkbenchModeClient();
  return ALL_LINKS.filter((l) => (local ? l.href !== "share" : true));
}

function navLinkActive(segment: string, l: (typeof ALL_LINKS)[number]) {
  if (segment === l.href) return true;
  return l.legacySegments?.includes(segment) ?? false;
}

export function JourneyNav({
  journeyId,
  segment,
  layout = "bar",
  suppressActive = false,
}: {
  journeyId: string;
  segment: string;
  layout?: "bar" | "rail" | "rail-icons" | "header";
  /** When true, no tab is marked active (hydration-safe first paint). */
  suppressActive?: boolean;
}) {
  const isActive = (l: (typeof ALL_LINKS)[number]) =>
    !suppressActive && navLinkActive(segment, l);
  const links = journeyNavLinks();
  if (layout === "header") {
    return (
      <nav
        className="flex items-center justify-center gap-0.5 sm:gap-1 flex-nowrap"
        aria-label="Journey sections"
      >
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={`/journeys/${journeyId}/${l.href}`}
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap",
                isActive(l)
                  ? "bg-white text-brand"
                  : "text-white/90 hover:bg-white/15"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{l.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  if (layout === "rail-icons") {
    return (
      <nav className="flex flex-col gap-1" aria-label="Journey sections">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={`/journeys/${journeyId}/${l.href}`}
              title={l.label}
              aria-label={l.label}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md",
                isActive(l)
                  ? "bg-brand text-white"
                  : "text-brand border border-border hover:bg-canvas"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          );
        })}
      </nav>
    );
  }

  if (layout === "rail") {
    return (
      <nav className="flex flex-col gap-0.5 w-full" aria-label="Journey sections">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={`/journeys/${journeyId}/${l.href}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium min-h-[2.5rem]",
                isActive(l)
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-canvas hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              {l.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3 mb-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={`/journeys/${journeyId}/${l.href}`}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm",
            isActive(l)
              ? "bg-brand text-white"
              : "text-muted hover:bg-surface hover:text-foreground"
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}