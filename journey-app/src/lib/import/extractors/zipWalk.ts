import JSZip from "jszip";
import { mergeImportDrafts } from "@/lib/import/mergeDrafts";
import type { ImportDraft } from "@/lib/import/types";
import {
  JOURNEY_EXPORT_PACK_FILENAME,
  isJourneyExportPackV1,
  type JourneyExportPackV1,
} from "@/lib/export/journeyPackV1";
import { parseBufferByFileName } from "@/lib/import/extractors/parseBufferByFileName";

function shouldSkipZipPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  if (norm.includes("__MACOSX/")) return true;
  if (norm.endsWith(".DS_Store") || norm.endsWith("Thumbs.db")) return true;
  const base = norm.split("/").pop() ?? "";
  if (base.startsWith(".")) return true;
  return false;
}

function packToImportDraft(pack: JourneyExportPackV1): ImportDraft {
  const { journey } = pack;
  const steps: ImportDraft["steps"] = [];

  for (const phase of journey.phases) {
    const walk = (step: (typeof phase.steps)[0], phaseTitle: string) => {
      steps.push({
        title: step.title,
        userAction: step.userAction ?? undefined,
        phaseTitle,
        touchpoint: step.touchpoints[0]
          ? {
              module: step.touchpoints[0].module ?? undefined,
              screen: step.touchpoints[0].screen ?? undefined,
            }
          : undefined,
        pain: step.painPoints[0]
          ? {
              description: step.painPoints[0].description,
              severity: step.painPoints[0].severity,
            }
          : undefined,
        confidence: "high",
      });
      for (const child of step.children ?? []) {
        walk({ ...child, children: [] }, phaseTitle);
      }
    };
    for (const step of phase.steps) walk(step, phase.title);
  }

  return {
    title: journey.title,
    personas: journey.personas.map((p) => ({
      name: p.name,
      goals: p.goals ?? undefined,
      frustrations: p.frustrations ?? undefined,
      confidence: "high" as const,
    })),
    phases: journey.phases.map((p) => ({ title: p.title, confidence: "high" as const })),
    steps,
    sourceNotes: `App export pack (${pack.exportedAt})`,
    exportPackV1: pack,
  };
}

async function legacyPackToDraft(zip: JSZip): Promise<ImportDraft | null> {
  const readme = await zip.file("README.txt")?.async("string");
  const summary = await zip.file("stakeholder-summary.md")?.async("string");
  if (!readme && !summary) return null;

  const titleMatch = readme?.match(/^Journey:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || "Imported export pack";

  const steps: ImportDraft["steps"] = [];
  if (summary) {
    const phaseBlocks = summary.split(/^###\s+/m).slice(1);
    for (const block of phaseBlocks) {
      const [phaseLine, ...rest] = block.split("\n");
      const phaseTitle = phaseLine?.trim() || "Journey";
      for (const line of rest.join("\n").split("\n")) {
        const m = line.match(/^-\s+(.+)$/);
        if (m?.[1]) {
          steps.push({
            title: m[1].trim(),
            phaseTitle,
            confidence: "medium",
          });
        }
      }
    }
  }

  if (steps.length === 0) return null;

  return {
    title,
    personas: [],
    phases: [...new Set(steps.map((s) => s.phaseTitle || "Journey"))].map((t) => ({
      title: t,
      confidence: "medium" as const,
    })),
    steps,
    sourceNotes:
      "Legacy export pack (no journey-export.v1.json). Map and Discovery items may be incomplete — re-export from a current app version for full restore.",
  };
}

async function walkZipEntries(zip: JSZip): Promise<ImportDraft[]> {
  const drafts: ImportDraft[] = [];
  const paths = Object.keys(zip.files).sort();

  for (const path of paths) {
    const entry = zip.files[path];
    if (!entry || entry.dir || shouldSkipZipPath(path)) continue;

    const buf = await entry.async("nodebuffer");
    try {
      const draft = await parseBufferByFileName(buf, path);
      if (!draft) continue;
      drafts.push({
        ...draft,
        sourceNotes: [path, draft.sourceNotes].filter(Boolean).join(" — "),
      });
    } catch {
      continue;
    }
  }

  return drafts;
}

export async function parseExportPackZipBuffer(buf: Buffer): Promise<ImportDraft> {
  const zip = await JSZip.loadAsync(buf);
  const jsonEntry =
    zip.file(JOURNEY_EXPORT_PACK_FILENAME) ??
    zip.file("journey-export.json") ??
    zip.file("journey.json");

  if (jsonEntry) {
    const raw = JSON.parse(await jsonEntry.async("string")) as unknown;
    if (!isJourneyExportPackV1(raw)) {
      throw new Error("Invalid journey export JSON in zip");
    }
    return packToImportDraft(raw);
  }

  const legacy = await legacyPackToDraft(zip);
  if (legacy) return legacy;

  const walked = await walkZipEntries(zip);
  const packInside = walked.filter((d) => d.exportPackV1);
  if (packInside.length === 1 && walked.length === 1) {
    return packInside[0]!;
  }

  if (walked.length === 0) {
    const names = Object.keys(zip.files)
      .filter((k) => !zip.files[k]?.dir)
      .map((k) => k.split("/").pop())
      .filter(Boolean)
      .slice(0, 12)
      .join(", ");
    throw new Error(
      names
        ? `Could not parse any supported files in zip (found: ${names}${Object.keys(zip.files).length > 12 ? ", …" : ""}). Add CSV, Excel, Word, PDF, JSON, HTML, or another export pack.`
        : "Zip archive is empty."
    );
  }

  return mergeImportDrafts(walked);
}