import type { ImportDraft } from "@/lib/import/types";

export function mergeImportDrafts(drafts: ImportDraft[]): ImportDraft {
  if (drafts.length === 0) {
    throw new Error("No drafts to merge");
  }
  if (drafts.length === 1) return drafts[0]!;

  const packDrafts = drafts.filter((d) => d.exportPackV1);
  if (packDrafts.length > 1) {
    throw new Error("Cannot merge multiple app export packs — import each zip separately.");
  }

  const phaseKeys = new Set<string>();
  const phases: ImportDraft["phases"] = [];
  for (const d of drafts) {
    for (const p of d.phases) {
      const key = p.title.trim().toLowerCase();
      if (phaseKeys.has(key)) continue;
      phaseKeys.add(key);
      phases.push(p);
    }
  }

  return {
    title: drafts.find((d) => d.title)?.title ?? "Combined import",
    personas: drafts.flatMap((d) => d.personas),
    phases,
    steps: drafts.flatMap((d) => d.steps),
    sourceNotes: drafts
      .map((d) => d.sourceNotes)
      .filter(Boolean)
      .join("\n\n---\n\n"),
    exportPackV1: packDrafts[0]?.exportPackV1,
  };
}