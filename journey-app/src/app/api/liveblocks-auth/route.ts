import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { canRead, getJourneyRole } from "@/lib/rbac";
import { presenceColorForUserId } from "@/lib/liveblocks/colors";

const secret = process.env.LIVEBLOCKS_SECRET_KEY;

export async function POST(request: Request) {
  if (!secret) {
    return new NextResponse("Liveblocks not configured", { status: 503 });
  }

  const user = await requireSessionUser().catch(() => null);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as { room?: string };
  const room = body.room ?? "";
  const match = /^journey:(.+)$/.exec(room);
  if (!match) {
    return new NextResponse("Invalid room", { status: 400 });
  }
  const journeyId = match[1];
  const role = await getJourneyRole(user.id, journeyId);
  if (!canRead(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.name ?? user.email.split("@")[0],
      color: presenceColorForUserId(user.id),
    },
  });
  session.allow(room, session.FULL_ACCESS);
  const { body: authBody, status } = await session.authorize();
  return new NextResponse(authBody, { status });
}