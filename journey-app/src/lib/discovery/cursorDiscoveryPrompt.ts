import type { CanvasStep } from "@/components/journey/JourneyCanvas";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import type { DiscoveryScopeTarget } from "@/lib/discovery/discoveryScope";
import {
  enrichScopeTargetWithEngagement,
  formatFacilitatorCommentsForPrompt,
  formatScopeForPrompt,
} from "@/lib/discovery/discoveryScope";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";

export function buildCursorDiscoveryPrompt(
  journey: {
    id: string;
    title: string;
  },
  scope?: DiscoveryScopeTarget[],
  context?: {
    mapEngagement?: MapEngagement;
    stepOptions?: DiscoveryStepOption[];
    canvasSteps?: CanvasStep[];
  }
): string {
  const journeyId = journey.id;
  const title = journey.title.replace(/"/g, '\\"');
  const enrichedScope = context?.mapEngagement
    ? scope?.map((t) => enrichScopeTargetWithEngagement(t, context.mapEngagement))
    : scope;
  const scopeBlock = enrichedScope?.length
    ? formatScopeForPrompt(enrichedScope)
    : "";
  const commentsBlock =
    context?.mapEngagement && enrichedScope?.length && context.stepOptions && context.canvasSteps
      ? formatFacilitatorCommentsForPrompt(
          context.mapEngagement,
          enrichedScope,
          context.stepOptions,
          context.canvasSteps
        )
      : "";
  const scopeSections = [scopeBlock, commentsBlock].filter(Boolean).join("\n\n");
  const scopeBlockOut = scopeSections ? `\n${scopeSections}\n` : "";

  const scopeIntro = scope?.length
    ? "The facilitator already selected map anchors in Discovery (interactive map). Honor the scope section below — do not choose pains/opportunities yourself."
    : "If no scope section is present, ask the user to select pains/opportunities on the Discovery map first, or synthesize only from map evidence without inventing scope.";

  return `Analyze the user journey map "${title}" (journey id: ${journeyId}) and produce Discovery outputs for our User Journey Mapping Tool.

Do this in Cursor — not in the app UI.

${scopeIntro}
${scopeBlockOut}
## How to read this map (stakeholder view)

Open \`/journeys/${journeyId}/map\` or load journey data from the repo.

- **Phases** = horizontal columns. Each column has **one phase card** (root \`Step\` with \`parentStepId\` null).
- **Friction, opportunity, experience goal** live on that **phase card only** — not on nested user actions.
- **User actions** are child steps under the phase card: **lanes** (\`actionLane\` / flow links) = horizontal screen flows; use them for \`locations.workflowStep\`, \`userFlow\`, and acceptance criteria, but **anchor requirements to the parent phase step** unless fixing a specific screen action.
- Insights rail **Friction on map** = same phase-level pains (sort by severity).

When citing evidence, prefer **root step \`stepId\`** and **\`painId\`** on that step. Mention phase title and concrete action text from nested steps when describing UX flows.

## Before you write JSON

1. Read personas, phases, **root steps only** for pains/opportunities, then nested actions for touchpoints and chains.
2. Ground every requirement in map evidence — real \`stepId\`, \`painId\`, \`personaId\` in \`references\`.
3. Synthesize themes across phases; tie priority to pain **severity on phase cards** (typically 1–5).
4. Do not invent steps, pains, personas, or opportunities absent from the map.

## Save and apply

Save draft JSON under \`journey-app/.cursor-discovery/\` then run from \`journey-app\`:

npm run discovery:apply -- ${journeyId} <file.json>

One Cursor pass → **one** discovery set (all requirements share one \`synthesisBatchId\`). Re-running \`discovery:apply\` within a few minutes **replaces** that set (agent retry). Start a **new** Cursor chat and pass \`--append\` to add discovery set 2 without deleting set 1.

npm run discovery:apply -- ${journeyId} <file.json> --append

Report: \`/journeys/${journeyId}/map\`

## JSON shape

\`\`\`json
{
  "analysisSummary": "2–4 sentences: themes, top friction phases, opportunities already on the map",
  "requirements": [
    {
      "tag": "UX",
      "title": "Concise outcome statement",
      "problemStatement": "Tied to phase pain / opportunity text",
      "businessContext": "",
      "whyImportant": "",
      "businessObjective": "",
      "priority": "High",
      "hypothesis": { "if": "", "then": "", "resultingIn": "" },
      "locations": { "module": "", "screen": "", "panel": "", "dialog": "", "workflowStep": "Phase name or nested action" },
      "researchEvidence": ["Journey map: <phase title>"],
      "inScope": "",
      "outScope": "",
      "constraints": "",
      "edgeCases": "",
      "successCriteria": "",
      "acceptanceCriteria": "",
      "references": {
        "personaId": "",
        "stepId": "Root phase step id (not child action id unless action-specific)",
        "painId": "",
        "stepTitle": "Phase column title or root step title",
        "painDescription": "Snippet from phase card friction"
      },
      "userStory": {
        "title": "",
        "asA": "",
        "iWant": "",
        "soThat": "",
        "designReference": "",
        "userFlow": "Optional: action lane chain under the phase",
        "scope": "",
        "dependencies": "",
        "edgeCases": "",
        "acceptanceCriteria": ""
      }
    }
  ]
}
\`\`\`

Rules:
- ${scope?.length ? "One requirement per **numbered scope item** (each map selection is its own row); one \`userStory\` each." : "3–10 requirements; one \`userStory\` per requirement."}
- Priority: High when phase pain severity ≥ 4; Medium 3; Low otherwise — adjust for persona impact.
- ${scope?.length ? "Do **not** add requirements outside the user-selected scope." : "Requirements should address **each friction bullet** and **each opportunity bullet** on phase cards (import splits `;` lists into separate pains / Opportunity rows)."}
- Honor every **facilitator comment** in scope and in **Facilitator map comments** — treat them as primary qualitative evidence.
- Follow project rule \`journey-discovery\` if present.

Full doc: \`journey-app/docs/CURSOR_DISCOVERY.md\``;
}