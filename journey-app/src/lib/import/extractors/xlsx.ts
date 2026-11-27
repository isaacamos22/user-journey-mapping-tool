import * as XLSX from "xlsx";
import type { ImportDraft } from "@/lib/import/types";

export function parseXlsxBuffer(buffer: Buffer): ImportDraft {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const personas: ImportDraft["personas"] = [];
  const steps: ImportDraft["steps"] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
  if (/persona/i.test(sheetName)) {
      for (const row of rows) {
        const lower = Object.fromEntries(
          Object.keys(row).map((k) => [k.toLowerCase(), String(row[k] ?? "")])
        );
        const name = lower.name || lower.persona || lower.role;
        if (!name?.trim()) continue;
        personas.push({
          name: name.trim(),
          goals: lower.goals || lower.goal,
          frustrations: lower.frustrations || lower.pain_points || lower.frustration,
          confidence: "high",
        });
      }
      continue;
    }

    for (const row of rows) {
      const lower = Object.fromEntries(
        Object.keys(row).map((k) => [k.toLowerCase(), String(row[k] ?? "")])
      );
      const title = lower.step || lower.title || lower.stage || lower["journey step"];
      if (!title?.trim()) continue;
      steps.push({
        title: title.trim(),
        userAction: lower.action || lower.user_action || lower["user action"],
        phaseTitle: lower.phase || lower.stage || sheetName,
        touchpoint:
          lower.module || lower.screen
            ? { module: lower.module, screen: lower.screen }
            : undefined,
        pain: lower.pain
          ? { description: lower.pain, severity: Number(lower.severity) || 3 }
          : undefined,
        confidence: "high",
      });
    }
  }

  return {
    title: wb.SheetNames[0],
    personas,
    phases: [...new Set(steps.map((s) => s.phaseTitle).filter(Boolean))].map((t) => ({
      title: String(t),
      confidence: "high" as const,
    })),
    steps,
    sourceNotes: `Excel workbook: ${wb.SheetNames.join(", ")}`,
  };
}