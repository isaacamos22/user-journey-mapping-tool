import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptJourneyInvite } from "@/lib/actions/members";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";
import { isLocalWorkbenchMode } from "@/lib/runtime/appMode";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (isLocalWorkbenchMode()) redirect("/");
  const invite = await prisma.journeyInvite.findUnique({
    where: { token },
    include: { journey: { select: { title: true, id: true } } },
  });

  if (!invite) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 rounded-xl border border-border bg-surface">
        <h1 className="text-lg font-semibold">Invite not found</h1>
        <Link href="/" className="text-brand text-sm mt-4 inline-block">
          Back to home
        </Link>
      </div>
    );
  }

  const user = await getSessionUser();
  const expired = invite.expiresAt < new Date();

  return (
    <div className="max-w-md mx-auto mt-12 p-6 rounded-xl border border-border bg-surface space-y-4">
      <h1 className="text-lg font-semibold">Join user journey</h1>
      <p className="text-sm text-muted">
        You are invited to collaborate on <strong className="text-foreground">{invite.journey.title}</strong> as{" "}
        <span className="uppercase text-xs">{invite.role}</span>.
      </p>
      {expired ? (
        <p className="text-sm text-red-700">This invite has expired. Ask the owner for a new link.</p>
      ) : invite.acceptedAt ? (
        <Link href={`/journeys/${invite.journey.id}/map`} className="text-brand font-medium text-sm">
          Open journey →
        </Link>
      ) : user ? (
        <form action={acceptJourneyInvite.bind(null, token)}>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-hover"
          >
            Accept invite
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="text-brand font-medium">
            Sign in
          </Link>{" "}
          with <strong>{invite.email}</strong> to accept.
        </p>
      )}
    </div>
  );
}