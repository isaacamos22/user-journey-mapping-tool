import type { SessionUser } from "@/lib/auth/sessionUser";

export function isGuestAuthEnabled(): boolean {
  return process.env.GUEST_AUTH_ENABLED === "true";
}

export function assertNotGuest(user: SessionUser, message = "Guests cannot perform this action"): void {
  if (user.isGuest) {
    throw new Error(message);
  }
}