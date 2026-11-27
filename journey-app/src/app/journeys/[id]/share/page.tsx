import { notFound, redirect } from "next/navigation";
import { isLocalWorkbenchMode } from "@/lib/runtime/appMode";
import { MemberRole } from "@prisma/client";
import { ShareInviteForm } from "@/components/journey/ShareInviteForm";
import { GuestLinkForm } from "@/components/journey/GuestLinkForm";
import { revokeGuestLink } from "@/lib/actions/guestLink";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";
import {
  removeJourneyMember,
  revokeJourneyInvite,
  transferJourneyOwnership,
  updateMemberRole,
} from "@/lib/actions/members";
import { canManageMembers, canOwnJourney, canRead, getJourneyRole } from "@/lib/rbac";

export default async function JourneySharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isLocalWorkbenchMode()) redirect(`/journeys/${id}/map`);
  const user = await getSessionUser();
  if (!user) notFound();

  const role = await getJourneyRole(user.id, id);
  if (!canRead(role)) notFound();

  const [members, invites, guestLinks] = await Promise.all([
    prisma.journeyMember.findMany({
      where: { journeyId: id },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { role: "asc" },
    }),
    prisma.journeyInvite.findMany({
      where: { journeyId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.journeyGuestLink.findMany({
      where: { journeyId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const manage = canManageMembers(role);
  const owner = canOwnJourney(role);

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Share journey</h1>
        <p className="text-sm text-muted mt-1">
          Invite colleagues by email (Microsoft sign-in) or share a guest link for viewers without company email.
        </p>
      </header>

      {manage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Guest link</h2>
          <p className="text-xs text-muted">
            Anyone with the link can sign in with a display name and view the map (no email required).
          </p>
          <GuestLinkForm journeyId={id} />
        </section>
      ) : null}

      {manage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Email invite</h2>
          <ShareInviteForm journeyId={id} />
        </section>
      ) : (
        <p className="text-sm text-muted">Only facilitators and owners can send invites.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Members</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-muted truncate">{m.user.email}</p>
              </div>
              {manage && m.role !== MemberRole.OWNER ? (
                <form action={updateMemberRole.bind(null, id, m.id)} className="flex items-center gap-2">
                  <select name="role" defaultValue={m.role} className="text-xs rounded border border-border px-2 py-1">
                    {Object.values(MemberRole)
                      .filter((r) => r !== MemberRole.OWNER)
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                  </select>
                  <button type="submit" className="text-xs text-brand font-medium">
                    Update
                  </button>
                </form>
              ) : (
                <span className="text-xs uppercase text-muted">{m.role}</span>
              )}
              {owner && m.role !== MemberRole.OWNER && m.userId !== user.id ? (
                <form action={transferJourneyOwnership.bind(null, id, m.id)}>
                  <button type="submit" className="text-xs text-amber-800 font-medium">
                    Make owner
                  </button>
                </form>
              ) : null}
              {manage && m.role !== MemberRole.OWNER ? (
                <form action={removeJourneyMember.bind(null, id, m.id)}>
                  <button type="submit" className="text-xs text-red-700 font-medium">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {manage && guestLinks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Active guest links</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {guestLinks.map((link) => (
              <li key={link.id} className="flex items-center gap-2 px-4 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{link.label ?? "Guest link"}</p>
                  <p className="text-xs text-muted">
                    {link.role} · expires {link.expiresAt.toLocaleDateString()}
                  </p>
                </div>
                <a href={`/join/${link.token}`} className="text-xs text-brand font-medium">
                  Open link
                </a>
                <form action={revokeGuestLink.bind(null, link.id, id)}>
                  <button type="submit" className="text-xs text-red-700">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {manage && invites.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Pending email invites</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-2 px-4 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate">{inv.email}</p>
                  <p className="text-xs text-muted">
                    {inv.role} · expires {inv.expiresAt.toLocaleDateString()}
                  </p>
                </div>
                <a href={`/invite/${inv.token}`} className="text-xs text-brand font-medium">
                  Open link
                </a>
                <form action={revokeJourneyInvite.bind(null, inv.id, id)}>
                  <button type="submit" className="text-xs text-red-700">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}