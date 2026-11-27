import { aiEnrichImportDraft } from "@/lib/ai/importAnalysis";
import { enrichImportDraftAssumptions } from "@/lib/import/assumptionEnrich";
import { enrichImportDraftHeuristic } from "@/lib/import/heuristicEnrich";
import { enrichImportDraftOpportunities } from "@/lib/import/opportunityEnrich";
import { softenIncompleteImportDraft } from "@/lib/import/incompleteImportPhase";
import { sanitizeImportDraftWorkshopRows } from "@/lib/import/workshopRowSemantics";
import type { ImportDraft } from "@/lib/import/types";
import { isCuratedWorkshopImport } from "@/lib/import/workshopDraftFidelity";

export type ImportEnrichment = "none" | "heuristic" | "ai";

export async function enrichImportDraft(
  draft: ImportDraft
): Promise<{ draft: ImportDraft; enrichment: ImportEnrichment }> {
  if (draft.exportPackV1) {
    return { draft, enrichment: "none" };
  }

  const curated = isCuratedWorkshopImport(draft);
  let base = softenIncompleteImportDraft(draft);
  let working = sanitizeImportDraftWorkshopRows(
    enrichImportDraftOpportunities(enrichImportDraftHeuristic(base), { verbatim: curated })
  );
  const hasAzure =
    !curated &&
    Boolean(process.env.AZURE_OPENAI_ENDPOINT) &&
    Boolean(process.env.AZURE_OPENAI_API_KEY) &&
    Boolean(process.env.AZURE_OPENAI_DEPLOYMENT);

  if (hasAzure) {
    const ai = await aiEnrichImportDraft(working);
    const changed =
      ai.steps.length !== working.steps.length ||
      ai.personas.length !== working.personas.length ||
      ai.phases.length !== working.phases.length;
    working = softenIncompleteImportDraft(sanitizeImportDraftWorkshopRows(ai));
    const enriched = enrichImportDraftAssumptions(working);
    return { draft: enriched, enrichment: changed ? "ai" : "heuristic" };
  }

  if (curated) {
    const enriched = enrichImportDraftAssumptions(working);
    return { draft: enriched, enrichment: "none" };
  }

  return { draft: enrichImportDraftAssumptions(working), enrichment: "heuristic" };
}