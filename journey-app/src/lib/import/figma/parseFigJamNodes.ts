import type { ImportDraft } from "@/lib/import/types";

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number };
};

function walk(nodes: FigmaNode[], fn: (n: FigmaNode) => void) {
  for (const n of nodes) {
    fn(n);
    if (n.children) walk(n.children, fn);
  }
}

export function parseFigJamDocument(doc: { document: FigmaNode }): ImportDraft {
  const phases: ImportDraft["phases"] = [];
  const steps: ImportDraft["steps"] = [];
  const personas: ImportDraft["personas"] = [];
  const stickies: { text: string; x: number; y: number }[] = [];

  walk([doc.document], (n) => {
  if (n.type === "SECTION" || (n.type === "FRAME" && n.name.toLowerCase().includes("phase"))) {
    phases.push({ title: n.name, confidence: "high" });
  }
  const text = n.characters || (n.type === "TEXT" ? n.name : "");
  if (!text) return;
  const lower = text.toLowerCase();
  if (lower.includes("persona")) {
    personas.push({ name: text.slice(0, 80), confidence: "medium" });
  } else if (n.type === "STICKY" || n.type === "SHAPE_WITH_TEXT") {
    const box = n.absoluteBoundingBox;
    stickies.push({ text, x: box?.x ?? 0, y: box?.y ?? 0 });
  }
  });

  stickies.sort((a, b) => a.x - b.x || a.y - b.y);
  for (const s of stickies) {
    const isPain = /pain|friction|problem/i.test(s.text);
    steps.push({
      title: s.text.slice(0, 100),
      userAction: isPain ? undefined : s.text,
      pain: isPain ? { description: s.text, severity: 3 } : undefined,
      confidence: "medium",
    });
  }

  return {
    title: doc.document.name,
    personas,
    phases,
    steps,
    sourceNotes: "Imported via Figma API — review step order and grouping.",
  };
}

export async function fetchFigmaFile(fileKey: string, token: string) {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Figma API: ${res.status} ${await res.text()}`);
  return res.json();
}

export function fileKeyFromFigJamUrl(url: string): string | null {
  const m = url.match(/figma\.com\/(?:board|file|design)\/([a-zA-Z0-9]+)/);
  return m?.[1] ?? null;
}