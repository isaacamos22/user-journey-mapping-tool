import Link from "next/link";
import { signOut } from "@/auth";
import { getSessionUser, hasActiveAuthSession } from "@/lib/auth/sessionUser";
import { isLocalWorkbenchMode } from "@/lib/runtime/appMode";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export async function UserMenu() {
  if (isLocalWorkbenchMode()) return null;

  const user = await getSessionUser();
  if (!user) return null;

  const signedInWithAuth = await hasActiveAuthSession();
  const label = user.isGuest ? `Guest · ${user.name ?? "Visitor"}` : user.name ?? user.email;

  return (
    <div className="flex items-center gap-2 pl-2 border-l border-white/20 ml-2">
      <span
        className="hidden sm:inline text-xs text-white/90 max-w-[160px] truncate"
        title={user.isGuest ? String(user.name) : user.email}
      >
        {label}
      </span>
      {signedInWithAuth ? (
        <form action={signOutAction}>
          <button type="submit" className="text-xs px-2 py-1 rounded-md hover:bg-white/10">
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/login" className="text-xs px-2 py-1 rounded-md hover:bg-white/10">
          Sign in
        </Link>
      )}
    </div>
  );
}