export type FigmaMapExportPromptInput = {
  journeyId: string;
  journeyTitle: string;
  /** Full figma.com/design/… or figma.com/board/… URL (paste from user). */
  figmaDestinationUrl: string;
  /** Optional absolute map URL for the agent (e.g. http://localhost:3000/journeys/.../map). */
  mapPageUrl?: string;
  includeInsightsRail?: boolean;
};

const FIGMA_BOARD_PLACEHOLDER =
  "https://www.figma.com/board/FILE_KEY/Your-Board?node-id=0-1";

function isFigJamUrl(url: string): boolean {
  return /figma\.com\/board\//i.test(url);
}

/**
 * Cursor chat prompt: rebuild the stakeholder map in Figma / FigJam via MCP,
 * matching JourneyCanvas layout (columns, lanes, spacing).
 */
export function buildCursorFigmaMapExportPrompt(input: FigmaMapExportPromptInput): string {
  const {
    journeyId,
    journeyTitle,
    figmaDestinationUrl,
    mapPageUrl,
    includeInsightsRail = true,
  } = input;

  const destination = figmaDestinationUrl.trim() || FIGMA_BOARD_PLACEHOLDER;
  const figjam = isFigJamUrl(destination);
  const mapPath = `/journeys/${journeyId}/map`;
  const mapRef = mapPageUrl?.trim() || mapPath;

  const insightsBlock = includeInsightsRail
    ? `
## Insights rail (FigJam: companion section, right of map grid)

Use **stickies** or a **FigJam section** — do not float loose text without a container.
- Section title: **Journey insights** + coverage label from export pack
- KPI row (3 stickies or one wide sticky): **Phases** | **Phase steps** | **User actions**
- **Friction on map**: one sticky per root-phase pain (severity + phase title + snippet) — same order as map
- Place insights section **to the right of the rightmost phase column**; top-aligned with phase root row
- Horizontal gap from map grid ≈ **80px** (map column width + padding)`
    : `
## Insights rail

Skip for this export (map grid only).`;

  const figJamBlock = figjam
    ? `
## FigJam mode (required for \`figma.com/board/\` URLs)

**Do NOT** use \`createShapeWithText\`, Design frames, or \`generate_figma_design\` on FigJam boards.

Use **FigJam MCP only**:
1. \`create_session\` → load **figma-use** + **figma-use-figjam**
2. \`get_figjam\` at destination \`node-id\` to read existing sections; place the new map **beside** destination content (do not overlap the workshop grid unless asked)
3. \`use_figma\`: **\`figma.createSticky()\`** for every phase card and user action; **\`figma.createConnector()\`** for all continues and phase-to-phase links

### Sticky roles

| Map element | FigJam |
|-------------|--------|
| Root phase card (goal, friction, opportunity) | **One sticky per phase** — taller copy block; use a distinct color (e.g. blue/gray) for roots only |
| Nested user action | **One sticky per action** — shorter text: title + \`userAction\` only (no pain/opportunity on children) |
| Phase label | First line of root sticky or small text node above root (optional) |
| Insights KPIs / friction list | Stickies inside insights **section** |

**Connectors**
- **Within a lane:** \`connectorStart\` RIGHT → \`connectorEnd\` LEFT on the next action sticky (straight, brand blue)
- **Between phase roots:** root sticky i → root sticky i+1, RIGHT → LEFT (neutral gray)
- **Do not** connect unrelated lanes or skip order from \`StepFlowLink\` / export pack

### Layout algorithm (match \`JourneyCanvas\` — same math as the app)

Replicate \`layoutColumnPositions\` in \`journey-app/src/components/journey/JourneyCanvas.tsx\`:

Constants (px):
- \`NODE_W = 252\` — column content width; sticky **x** step per sibling in a lane
- \`PHASE_GAP_PX = 96\` — added to each column width (\`colW = maxLaneRunWidth + 96\`)
- \`MAP_STACK_GAP_PX = 28\` — vertical gap root→first lane, and between lane rows
- \`ACTION_H_GAP = 28\` — horizontal gap between stickies in the same lane
- Lane width for n actions: \`252 + (n-1) * (252 + 28)\`

Procedure:
1. Order phases left→right from \`phases[]\` / root step \`order\`.
2. For each phase column, \`phaseX\` starts at 0 and increases by \`colW\`.
3. Place **root sticky** at \`(phaseX, columnY)\` with real journey copy.
4. \`childY = columnY + rootHeight + 28\`.
5. Group child actions with \`groupActionsIntoSiblingRuns\` + \`flowLinks\` from export pack (same as map page \`loadStepFlowLinks\`).
6. For each lane run, place stickies at \`x = phaseX + index * (252 + 28)\`, same \`childY\`; then \`childY += laneHeight + 28\`.
7. **After appendChild into a section**, set \`x/y\` in **section-local** coordinates (\`figma-use-figjam\` positioning rules).

**Mandatory verification:** Attach map **PNG snapshot** from #map-capture. After placing stickies, compare column alignment and lane stacks to the PNG; nudge positions until columns line up.

**Data source (order + lanes):** \`GET /api/journeys/${journeyId}/export/pack\` — use step tree, \`parentStepId\`, \`actionFlowBranchId\`, and flow links. Do not invent lane groupings.`
    : `
## Figma Design mode (\`figma.com/design/\`)

Use \`generate_figma_design\` on **${mapRef}** (dev server running) for pixel reference, plus \`use_figma\` + \`figma-generate-design\` to refine components. Same column/lane spacing as above.`;

  return `Push the **stakeholder journey map** from our User Journey Mapping Tool into Figma. Match the live **Map** layout in code — same columns, lanes, and connector topology — not a generic flowchart.

## Destination Figma file (required)

${destination}

Parse \`fileKey\` and \`node-id\`. ${figjam ? "**This is FigJam** (`/board/`) — stickies + connectors only." : "This is a Design file (`/design/`)."}

## Source journey

- **Title:** ${journeyTitle}
- **Journey ID:** ${journeyId}
- **Map (reference):** ${mapRef}
- **Layout code:** \`JourneyCanvas.tsx\` (\`layoutColumnPositions\`, \`groupActionsIntoSiblingRuns\`), \`actionFlowLayout.ts\`, \`journeyFlowSpacing.ts\`
- **Export:** \`GET /api/journeys/${journeyId}/export/pack\` + **PNG snapshot** on #map-capture (required for FigJam placement)

${figJamBlock}

## Stakeholder map model (must match product)

1. **One column per phase** (left → right). **One root sticky/card** per column.
2. **Friction, opportunity, experience goal** on **root only** — never on nested action stickies.
3. **User actions** under the root in **horizontal lanes** (\`actionFlowBranchId\` / sibling runs). **Continues** edges only inside a lane.
4. **Parallel branches** = extra lane rows under the same phase (+**28px** vertical stack gap).

## Visual copy (roots)

Root sticky text should mirror the app card:
- Phase title line
- Step headline
- \`Goal ·\` + experience goal
- \`Friction ·\` + severity + pain summary
- \`Opportunity\` + opportunity line
Nested stickies: \`User action\` + \`userAction\` text only.

${insightsBlock}

## Layout process (checklist)

1. Load export pack + flow links; build \`childrenByParent\` and lane runs like \`map/page.tsx\`.
2. Compute \`phaseX\` / sticky \`x,y\` with the algorithm above — **do not** guess a single row of stickies or equal-width columns.
3. Create FigJam **section** named **${journeyTitle} · Map**; append all map stickies; resize section to fit content (+32px padding).
4. Wire **connectors** after every sticky has final position.
5. Overlay-compare with PNG; fix any column drift or merged lanes.

## Deliverable

- FigJam section(s): **${journeyTitle} · Map** (+ **Insights** if included)
- Figma URL with \`node-id\` of the map section
- Short checklist: columns vs PNG, lane order vs app, connector count, root-only pain/opportunity

Full app doc: \`journey-app/docs/CURSOR_FIGMA_MAP_EXPORT.md\``;
}

export const FIGMA_DESTINATION_PLACEHOLDER = FIGMA_BOARD_PLACEHOLDER;