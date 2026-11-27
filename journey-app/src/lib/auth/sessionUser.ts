import { auth } from "@/auth";
import { getLocalUser, type LocalUser } from "@/lib/auth/localUser";
import { prisma } from "@/lib/db";

export type SessionUser = LocalUser & {
  isGuest: boolean;
};

function isLocalMode(): boolean {
  return process.env.LOCAL_MODE !== "false";
}

async function userFromAuthSession(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const id = session.user.id;
  if (!id) return null;

  let isGuest = session.user.isGuest ?? false;
  if (session.user.isGuest === undefined) {
    const row = await prisma.user.findUnique({
      where: { id },
      select: { isGuest: true },
    });
    isGuest = row?.isGuest ?? false;
  }

  return {
    id,
    email: session.user.email,
    name: session.user.name ?? null,
    isGuest,
  };
}

export async function hasActiveAuthSession(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user?.id);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isLocalMode()) {
    const user = await getLocalUser();
    return { ...user, isGuest: false };
  }
  const fromAuth = await userFromAuthSession();
  if (fromAuth) return fromAuth;
  return null;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}