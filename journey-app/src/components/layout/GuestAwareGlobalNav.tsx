import Link from "next/link";
import { LogIn, Upload, Settings } from "lucide-react";
import { getSessionUser, hasActiveAuthSession } from "@/lib/auth/sessionUser";
import { isLocalWorkbenchMode } from "@/lib/runtime/appMode";

export async function GuestAwareGlobalNav() {
  const user = await getSessionUser();
  const isGuest = user?.isGuest ?? false;
  const authSession = await hasActiveAuthSession();
  const showSignInLink = !isLocalWorkbenchMode() && !authSession;

  return (
    <nav className="flex items-center gap-1 text-sm shrink-0" aria-label="Application">
      {showSignInLink ? (
        <Link
          href="/login"
          className="px-2 py-1 rounded-md hover:bg-white/10 flex items-center gap-1 text-xs sm:text-sm"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Sign in</span>
        </Link>
      ) : null}
      {!isGuest ? (
        <Link
          href="/import"
          className="px-2 py-1 rounded-md hover:bg-white/10 flex items-center gap-1 text-xs sm:text-sm"
        >
          <Upload className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Import</span>
        </Link>
      ) : null}
      <Link
        href="/settings"
        className="px-2 py-1 rounded-md hover:bg-white/10 flex items-center gap-1 text-xs sm:text-sm"
      >
        <Settings className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Settings</span>
      </Link>
    </nav>
  );
}