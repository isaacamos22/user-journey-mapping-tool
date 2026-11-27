import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";

/** Step to highlight on the stakeholder map from discovery references. */
export function resolveMapFocusStepId(
  ref: DiscoveryReference | undefined,
  steps: DiscoveryStepOption[]
): string | null {
  if (!ref) return null;
  if (ref.stepId) return ref.stepId;
  if (ref.painId) {
    const host = steps.find((s) => s.pains.some((p) => p.id === ref.painId));
    return host?.id ?? null;
  }
  return null;
}

/** Text to mark inside the focused map card (pain line, action title, or step title). */
export function resolveMapHighlightText(ref: DiscoveryReference | undefined): string | null {
  if (!ref) return null;
  const pain = ref.painDescription?.trim();
  if (pain) return pain;
  const opportunity = ref.opportunity?.trim();
  if (opportunity) return opportunity;
  if (ref.stepKind === "action") {
    const action = ref.userAction?.trim() || ref.stepTitle?.trim();
    return action || null;
  }
  const title = ref.stepTitle?.trim();
  if (title) return title;
  return ref.userAction?.trim() || null;
}