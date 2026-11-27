import mammoth from "mammoth";
import type { ImportDraft } from "@/lib/import/types";

export async function parseDocxBuffer(buffer: Buffer): Promise<ImportDraft> {
  const { value } = await mammoth.extractRawText({ buffer });
  const lines = value.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const steps: ImportDraft["steps"] = [];
  const phases: ImportDraft["phases"] = [];
  let currentPhase = "General";
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line) || line.length < 60 && line === line.toUpperCase()) {
      currentPhase = line.replace(/^#+\s*/, "");
      phases.push({ title: currentPhase, confidence: "medium" });
      continue;
    }
    if (line.match(/^[-*•]\s/)) {
      steps.push({
        title: line.replace(/^[-*•]\s/, "").slice(0, 120),
        phaseTitle: currentPhase,
        confidence: "medium",
      });
    }
  }
  return { personas: [], phases, steps };
}