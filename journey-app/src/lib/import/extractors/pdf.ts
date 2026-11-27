import type { ImportDraft } from "@/lib/import/types";

export async function parsePdfBuffer(buffer: Buffer): Promise<ImportDraft> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  const text = textResult.text ?? "";
  await parser.destroy();
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 4);
  const steps = lines.slice(0, 50).map((line) => ({
    title: line.slice(0, 120),
    confidence: "low" as const,
  }));
  return {
    personas: [],
    phases: [],
    steps,
    sourceNotes: "PDF text extraction — please review low-confidence rows.",
  };
}