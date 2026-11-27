import type { DiscoveryRequirementRecord } from "@/components/discovery/RequirementDiscoveryCard";

export function dedupeDiscoveryRequirements(
  requirements: DiscoveryRequirementRecord[]
): DiscoveryRequirementRecord[] {
  const byId = new Map<string, DiscoveryRequirementRecord>();
  for (const r of requirements) {
    const seenStory = new Set<string>();
    const stories = r.stories.filter((s) => {
      if (seenStory.has(s.id)) return false;
      seenStory.add(s.id);
      return true;
    });
    byId.set(r.id, { ...r, stories });
  }
  return [...byId.values()];
}