import { mergeImportDrafts } from "@/lib/import/mergeDrafts";
import type { ImportDraft } from "@/lib/import/types";
import { parseCsvImport, parseJsonImport } from "@/lib/import/extractors/csvJson";
import { parseXlsxBuffer } from "@/lib/import/extractors/xlsx";
import { parseDocxBuffer } from "@/lib/import/extractors/docx";
import { parseHtmlImport } from "@/lib/import/extractors/html";
import { parsePdfBuffer } from "@/lib/import/extractors/pdf";
import { parseExportPackZipBuffer } from "@/lib/import/extractors/zipWalk";

function baseName(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return (parts[parts.length - 1] ?? filePath).toLowerCase();
}

function parsePlainTextImport(text: string, titleHint: string): ImportDraft | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const steps: ImportDraft["steps"] = [];
  for (const line of lines) {
    const bullet = line.match(/^[-*•\d.)\]]+\s*(.+)$/);
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (bullet?.[1]) {
      steps.push({ title: bullet[1].trim(), confidence: "medium" });
    } else if (heading?.[1]) {
      steps.push({ title: heading[1].trim(), phaseTitle: "Notes", confidence: "medium" });
    }
  }

  if (steps.length === 0 && lines.length > 0) {
    steps.push({
      title: lines[0].slice(0, 120),
      userAction: lines.slice(1, 8).join(" ").slice(0, 500) || undefined,
      confidence: "low",
    });
  }

  if (steps.length === 0) return null;

  return {
    title: titleHint.replace(/\.[^.]+$/, "") || "Imported document",
    personas: [],
    phases: [{ title: "Imported", confidence: "medium" }],
    steps,
    sourceNotes: titleHint,
  };
}

function sniffTextDraft(buf: Buffer, fileName: string): ImportDraft | null {
  const text = buf.toString("utf-8");
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return parseJsonImport(trimmed);
    } catch {
      /* fall through */
    }
  }
  if (trimmed.includes(",") && trimmed.split("\n").length > 1) {
    try {
      return parseCsvImport(trimmed);
    } catch {
      /* fall through */
    }
  }
  if (trimmed.includes("<") && trimmed.includes(">")) {
    try {
      return parseHtmlImport(trimmed);
    } catch {
      /* fall through */
    }
  }
  return parsePlainTextImport(trimmed, fileName);
}

export async function parseBufferByFileName(buf: Buffer, filePath: string): Promise<ImportDraft | null> {
  const name = baseName(filePath);

  if (name.endsWith(".zip")) {
    return parseExportPackZipBuffer(buf);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseXlsxBuffer(buf);
  }
  if (name.endsWith(".docx")) {
    return await parseDocxBuffer(buf);
  }
  if (name.endsWith(".pdf")) {
    return await parsePdfBuffer(buf);
  }
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    return parseHtmlImport(buf.toString("utf-8"));
  }
  if (name.endsWith(".csv")) {
    return parseCsvImport(buf.toString("utf-8"));
  }
  if (name.endsWith(".json")) {
    return parseJsonImport(buf.toString("utf-8"));
  }
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) {
    return parsePlainTextImport(buf.toString("utf-8"), filePath);
  }

  return sniffTextDraft(buf, filePath);
}