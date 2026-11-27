import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { isGuestAuthEnabled } from "@/lib/auth/guestAuth";

const useEntra =
  Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID) &&
  Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as Parameters<typeof PrismaAdapter>[0]),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(useEntra
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
            issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "common"}/v2.0`,
          }),
        ]
      : []),
    Credentials({
      id: "dev",
      name: "Development",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "production" && !useEntra) return null;
        const email = credentials?.email as string;
        if (!email?.includes("@")) return null;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return user;
      },
    }),
    ...(isGuestAuthEnabled()
      ? [
          Credentials({
            id: "guest",
            name: "Guest",
            credentials: {
              displayName: { label: "Your name", type: "text" },
            },
            async authorize(credentials) {
              const raw = String(credentials?.displayName ?? "").trim();
              if (raw.length < 2 || raw.length > 40) return null;
              const email = `guest-${randomBytes(12).toString("hex")}@guest.invalid`;
              const user = await prisma.user.create({
                data: {
                  email,
                  name: raw,
                  isGuest: true,
                },
              });
              return { ...user, isGuest: true };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        if ("isGuest" in user && typeof (user as { isGuest?: boolean }).isGuest === "boolean") {
          token.isGuest = Boolean((user as { isGuest?: boolean }).isGuest);
        } else if (user.email?.endsWith("@guest.invalid")) {
          token.isGuest = true;
        } else {
          token.isGuest = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.isGuest = Boolean(token.isGuest);
      }
      return session;
    },
  },
});