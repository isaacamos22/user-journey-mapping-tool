import type { ImportDraft } from "@/lib/import/types";
import { isCuratedWorkshopImport } from "@/lib/import/workshopDraftFidelity";

type AiImportShape = {
  title?: string;
  personas?: {
    name: string;
    goals?: string;
    frustrations?: string;
  }[];
  phases?: { title: string }[];
  steps?: {
    title: string;
    userAction?: string;
    phaseTitle?: string;
    touchpoint?: { module?: string; screen?: string };
    pain?: { description: string; severity?: number };
  }[];
};

function parseJsonFromModel(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? content.trim();
  return JSON.parse(raw);
}

function toDraft(parsed: AiImportShape, fallback: ImportDraft): ImportDraft {
  const personas =
    parsed.personas?.map((p) => ({
      name: p.name,
      goals: p.goals,
      frustrations: p.frustrations,
      confidence: "medium" as const,
    })) ?? fallback.personas;

  const phases =
    parsed.phases?.map((p) => ({
      title: p.title,
      confidence: "medium" as const,
    })) ?? fallback.phases;

  const steps =
    parsed.steps?.map((s) => ({
      title: s.title,
      userAction: s.userAction,
      phaseTitle: s.phaseTitle,
      touchpoint: s.touchpoint,
      pain: s.pain,
      confidence: "medium" as const,
    })) ?? fallback.steps;

  return {
    ...fallback,
    title: parsed.title?.trim() || fallback.title,
    personas: personas.length ? personas : fallback.personas,
    phases: phases.length ? phases : fallback.phases,
    steps: steps.length ? steps : fallback.steps,
  };
}

export async function aiEnrichImportDraft(draft: ImportDraft): Promise<ImportDraft> {
  if (draft.exportPackV1 || isCuratedWorkshopImport(draft)) return draft;

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !key || !deployment) return draft;

  const excerpt = [
    draft.title ? `Title hint: ${draft.title}` : "",
    draft.sourceNotes ?? "",
    "",
    "Current extracted steps (may be incomplete):",
    ...draft.steps.slice(0, 60).map((s, i) => {
      const parts = [
        `${i + 1}. ${s.title}`,
        s.userAction ? `Action: ${s.userAction}` : null,
        s.phaseTitle ? `Phase: ${s.phaseTitle}` : null,
        s.touchpoint?.screen ? `Screen: ${s.touchpoint.screen}` : null,
        s.pain?.description ? `Pain: ${s.pain.description}` : null,
      ].filter(Boolean);
      return parts.join(" | ");
    }),
  ]
    .join("\n")
    .slice(0, 14000);

  if (excerpt.trim().length < 40) return draft;

  try {
    const res = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`,
      {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a UX facilitator. Read workshop import material and output ONE JSON object with keys: title, personas (name, goals, frustrations), phases (title), steps (title, userAction, phaseTitle, touchpoint {module, screen}, pain {description, severity 1-5}). Rules: preserve verbatim phrases from the source in titles, userAction, and pain.description — do not summarize; userAction is a verbose task sentence (verb + goal), never a bare screen or menu name — put screen paths in touchpoint.screen; group steps into logical journey phases; infer 1-3 personas only when named in the source; do not invent product names not hinted in the text; prefer 5-25 steps; severity default 3.`,
            },
            {
              role: "user",
              content: excerpt,
            },
          ],
        }),
      }
    );
    if (!res.ok) return draft;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return draft;
    const parsed = parseJsonFromModel(content) as AiImportShape;
    const enriched = toDraft(parsed, draft);
    return {
      ...enriched,
      sourceNotes: [draft.sourceNotes, "Structured with Azure OpenAI from imported sources."]
        .filter(Boolean)
        .join("\n\n"),
    };
  } catch {
    return draft;
  }
}