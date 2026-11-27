import * as cheerio from "cheerio";
import type { ImportDraft } from "@/lib/import/types";

export function parseHtmlImport(html: string): ImportDraft {
  const $ = cheerio.load(html);
  const steps: ImportDraft["steps"] = [];
  let currentPhase = "Main flow";

  $("body")
    .find("*")
    .each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase();
      const text = $(el).text().trim();
      if (!text) return;
      if (tag === "h1" || tag === "h2" || tag === "h3") {
        if (text.length < 80) currentPhase = text;
        if (/persona/i.test(text)) return;
        if (tag === "h1" && text.length < 100) return;
      }
      if (tag === "li" && text.length > 3) {
        steps.push({ title: text.slice(0, 200), phaseTitle: currentPhase, confidence: "medium" });
      }
    });

  if (steps.length === 0) {
    $("h1, h2, h3").each((_, el) => {
      const title = $(el).text().trim();
      if (title) steps.push({ title, confidence: "medium" });
    });
  }

  return {
    personas: [],
    phases: [...new Set(steps.map((s) => s.phaseTitle).filter(Boolean))].map((t) => ({
      title: String(t),
      confidence: "medium" as const,
    })),
    steps,
    sourceNotes: "HTML document",
  };
}