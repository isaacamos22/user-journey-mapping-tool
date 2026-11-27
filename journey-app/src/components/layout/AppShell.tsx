import type { ReactNode } from "react";
import Link from "next/link";
import { Home, Plus } from "lucide-react";
import {
  APP_HEADER_BASE_PX,
  APP_HEADER_JOURNEY_PX,
} from "@/lib/layout/appHeader";
import { UserMenu } from "@/components/layout/UserMenu";
import { GuestAwareGlobalNav } from "@/components/layout/GuestAwareGlobalNav";
import { AppShellMain } from "@/components/layout/AppShellMain";

function HomeBrandLink() {
  return (
    <Link
      href="/"
      className="font-semibold tracking-tight flex items-center gap-2 shrink-0 text-sm sm:text-base"
      aria-label="Home — User journeys"
    >
      <Home className="h-5 w-5" aria-hidden />
      <span className="hidden md:inline">User journeys</span>
    </Link>
  );
}

export function AppShell({
  children,
  journeyTitle,
  journeyNav,
}: {
  children: React.ReactNode;
  journeyTitle?: ReactNode;
  journeyNav?: ReactNode;
}) {
  const isJourney = Boolean(journeyTitle || journeyNav);
  const headerPx = isJourney ? APP_HEADER_JOURNEY_PX : APP_HEADER_BASE_PX;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ "--app-header-px": `${headerPx}px` } as React.CSSProperties}
    >
      <header className="fixed top-0 left-0 right-0 z-[60] h-14 bg-brand text-white shadow-sm">
        {isJourney ? (
          <div className="w-full px-3 sm:px-4 lg:px-6 h-14 flex items-center gap-2">
            <div className="flex flex-1 min-w-0 items-center gap-1 justify-start">
              <HomeBrandLink />
              {journeyTitle}
            </div>
            <div className="flex shrink-0 justify-center px-1 max-w-[min(52vw,520px)] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {journeyNav}
            </div>
            <div className="flex flex-1 min-w-0 justify-end items-center">
              <GuestAwareGlobalNav />
              <UserMenu />
            </div>
          </div>
        ) : (
          <div className="w-full px-4 lg:px-6 h-14 flex items-center gap-2">
            <HomeBrandLink />
            <div className="ml-auto flex items-center">
              <GuestAwareGlobalNav />
              <UserMenu />
            </div>
          </div>
        )}
      </header>
      <AppShellMain paddingTop={`calc(${headerPx}px + 1rem)`} className={isJourney ? "flex flex-col" : undefined}>
        {children}
      </AppShellMain>
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover ${className}`}
    >
      <Plus className="h-4 w-4" />
      {children}
    </span>
  );
}