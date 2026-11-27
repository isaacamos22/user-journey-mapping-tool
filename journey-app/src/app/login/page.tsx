import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { isEntraConfigured } from "@/lib/auth/entraConfigured";
import { isGuestAuthEnabled } from "@/lib/auth/guestAuth";
import { isLocalWorkbenchMode } from "@/lib/runtime/appMode";

async function signInWithEntra(formData: FormData) {
  "use server";
  const redirectTo = String(formData.get("callbackUrl") || "/");
  await signIn("microsoft-entra-id", { redirectTo });
}

async function signInDev(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  const redirectTo = String(formData.get("callbackUrl") || "/");
  await signIn("dev", { email, redirectTo });
}

async function signInAsGuest(formData: FormData) {
  "use server";
  if (!isGuestAuthEnabled()) return;
  const displayName = String(formData.get("displayName") || "").trim();
  const redirectTo = String(formData.get("callbackUrl") || "/");
  await signIn("guest", { displayName, redirectTo, redirect: true });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  if (isLocalWorkbenchMode()) redirect(callbackUrl || "/");
  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl || "/");
  }

  const entra = isEntraConfigured();
  const showDev = process.env.NODE_ENV !== "production" || !entra;
  const showGuest = isGuestAuthEnabled();
  const isProductionAuth = process.env.LOCAL_MODE === "false";

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-border p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand mb-2">User journeys</h1>
        <p className="text-sm text-muted mb-8">
          {isProductionAuth
            ? "Sign in with Microsoft for your team journeys, or continue as a guest when a facilitator shared a link with you."
            : "Sign in to open and collaborate on journey maps."}
        </p>

        {entra ? (
          <form action={signInWithEntra}>
            <input type="hidden" name="callbackUrl" value={callbackUrl || "/"} />
            <button
              type="submit"
              className="w-full rounded-lg bg-brand text-white px-4 py-2.5 text-sm font-medium hover:bg-brand-hover"
            >
              Sign in with Microsoft
            </button>
          </form>
        ) : (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Entra is not configured. Set AUTH_MICROSOFT_ENTRA_ID_* in the environment for production.
          </p>
        )}

        {showGuest ? (
          <form action={signInAsGuest} className="mt-6 space-y-3 border-t border-border pt-6">
            <input type="hidden" name="callbackUrl" value={callbackUrl || "/"} />
            <p className="text-xs text-muted uppercase tracking-wide">Guest</p>
            <p className="text-xs text-muted">
              Use the guest link your facilitator sent. Enter your name as you want it shown on the map.
            </p>
            <input
              name="displayName"
              type="text"
              required
              minLength={2}
              maxLength={40}
              placeholder="Your name"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-container"
            >
              Continue as guest
            </button>
          </form>
        ) : null}

        {showDev ? (
          <form action={signInDev} className="mt-6 space-y-3 border-t border-border pt-6">
            <input type="hidden" name="callbackUrl" value={callbackUrl || "/"} />
            <p className="text-xs text-muted uppercase tracking-wide">Development sign-in</p>
            <input
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-container"
            >
              Continue with email
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}