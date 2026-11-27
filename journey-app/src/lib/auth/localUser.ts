import { prisma } from "@/lib/db";

const DEFAULT_EMAIL = "facilitator@example.com";

export type LocalUser = {
  id: string;
  email: string;
  name: string | null;
};

function localEmail(): string {
  return process.env.LOCAL_DEFAULT_USER_EMAIL?.trim() || DEFAULT_EMAIL;
}

export async function getLocalUser(): Promise<LocalUser> {
  const email = localEmail();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: email.split("@")[0] ?? "Local user",
    },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export async function requireLocalUser(): Promise<LocalUser> {
  return getLocalUser();
}