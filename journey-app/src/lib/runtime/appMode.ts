/** Local workbench: single user on this machine, no sign-in or sharing. */
export function isLocalWorkbenchMode(): boolean {
  return process.env.LOCAL_MODE !== "false";
}

/** Client-safe mirror of {@link isLocalWorkbenchMode} via next.config `env`. */
export function isLocalWorkbenchModeClient(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_WORKBENCH === "true";
}