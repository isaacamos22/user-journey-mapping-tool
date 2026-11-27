import Link from "next/link";
import { redirect } from "next/navigation";
import { redeemGuestLink } from "@/lib/actions/guestLink";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";
import { isLocalWorkbenchMode } from "@/lib/runtime/appMode";

export default async function JoinGuestLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (isLocalWorkbenchMode()) redirect("/");
  const link = await prisma.journeyGuestLink.findUnique({
    where: { token },
    include: { journey: { select: { title: true, id: true } } },
  });

  if (!link) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 rounded-xl border border-border bg-surface">
        <h1 className="text-lg font-semibold">Link not found</h1>
        <Link href="/login" className="text-brand text-sm mt-4 inline-block">
          Go to sign in
        </Link>
      </div>
    );
  }

  const revoked = Boolean(link.revokedAt);
  const expired = link.expiresAt < new Date();
  const user = await getSessionUser();

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${token}`)}`);
  }

  if (revoked || expired) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 rounded-xl border border-border bg-surface space-y-3">
        <h1 className="text-lg font-semibold">Cannot open journey</h1>
        <p className="text-sm text-muted">
          {revoked ? "This guest link was revoked." : "This guest link has expired."} Ask the facilitator for a new
          link.
        </p>
        <Link href="/" className="text-brand text-sm font-medium">
          Home
        </Link>
      </div>
    );
  }

  await redeemGuestLink(token);
}