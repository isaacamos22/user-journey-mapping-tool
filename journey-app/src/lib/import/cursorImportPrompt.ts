import {
  HOME_COVER_IMAGE_ASPECT,
  HOME_COVER_IMAGE_STYLE,
  HOME_COVER_IMAGE_PUBLIC_DIR,
} from "@/lib/home/homeCoverImage";

/** Paste into Cursor chat after attaching workshop file, image, PDF, zip, or FigJam link. */
export const CURSOR_IMPORT_CHAT_PROMPT = `Read the attached workshop material (FigJam journey table, PDF export, screenshots, sticky notes, or Figma/FigJam MCP link). Import it into our User Journey Mapping Tool.

## One link or file, **multiple journeys**

The user’s link or attachment may contain **more than one** user journey — not a single grid.

**Discover first (before JSON):**
- **FigJam / Figma board** — Use MCP (\`get_metadata\`, \`get_figjam\`) to list **sections**, top-level **frames**, or separate **journey tables**. Each distinct journey usually has its own title row (e.g. “User Journey Mapping — Req …”), its own phase columns, and often its own persona rail.
- **PDF / zip / pack** — Multiple journey chapters, tabs, or files; one grid per product flow or req.
- **Do not** merge unrelated grids into one import JSON. **Do not** import only the frame the URL \`node-id\` points to if the board clearly contains additional complete journeys elsewhere — parse **all** journeys the user would expect from that file unless they scoped one journey in chat.

**Apply one journey at a time:**
1. Write **one draft JSON per journey** → \`journey-app/.cursor-import/<slug>.json\` (unique slug per journey).
2. Generate a **unique** Home cover PNG per journey under \`public/home/covers/\`.
3. From \`journey-app\`, run \`import:apply\` **once per file**:
   \`npm run import:apply -- .cursor-import/<slug>.json\`
4. Re-import one journey: \`npx tsx scripts/reimport-by-title.ts "<Title substring>" .cursor-import/<slug>.json\`

After all applies: report **every** journey \`title\`, \`/journeys/<id>/map\`, and remind user to hard-refresh **Home** (multiple new posters).

## How the stakeholder **Map** renders (match import to this)

- **One column per phase** (left → right). Each column has **one phase card** (root step): user-step headline, **goals**, touchpoint hints, **friction bullets**, **opportunity bullets** — on this card only, never on nested user-action cards.
- **User actions** sit **under** the phase card in **horizontal lanes** (\`actionLane\`). Follow **connector arrows end-to-end** for order and **continues** links — one linked chain = **one lane** (\`actionLane\`), even when the board wraps vertically (e.g. campaign → down → sort/filter → select well). **Do not** split into parallel lanes just because stickies sit on two Y rows; use parallel \`actionLane\` values only when connectors show **genuine branches** (two+ rows with no shared sequential chain).
- **Merging flows** (two+ connectors into one sticky): put each branch entry in its own \`actionLane\` with a single action; put the **shared** sticky and everything after it in a **trunk** lane; on the merge target set \`continuesAfter\`: \`["branchAKey","branchBKey"]\` (do **not** duplicate the merge sticky on every lane). Apply writes \`StepFlowLink\` edges so the map draws cross-lane arrows into the merge card.
- **Cross-phase connectors** (lines that jump to the **next column**): keep actions under their **spatial** phase, and on the **source** action set \`continuesTo\`: \`[{ "phase": "Next phase title", "actionKey": "targetKey" }]\`. Use \`kind: "alternate"\` for dashed FigJam alternatives (e.g. skip ahead). Targets with a cross-phase incoming link are **not** hung from the phase card—only the curved cross-column arrow.
- Split inline \`→\` / \`->\` in copy into separate \`actions[]\` entries when not already separate stickies.
- Parallel FigJam rows = multiple \`actionLane\` values under the **same** root step (not extra top-level steps).
- The map shows **every** friction and opportunity bullet imported for that column (lists on the phase card). User-action text is **as-is** from the workshop (no paraphrase).
- **Every user-action card** shows **where** it happens: set \`module\` + \`screen\` (or \`panel\` / \`dialog\` in \`touchpoint\`) on **each** \`actions[]\` item from the board touchpoint row, screen sticky, or inventory (e.g. \`.html\` ids in zip \`screens.csv\`). Phase card may have a summary touchpoint; nested actions still need their own place.
- **Combined view** — **View → Combined** shows **one stack card per parallel \`actionLane\` run** (connector sibling chain), not one card per phase. Each stack body is a **distinct** summary sentence. **Do not** reuse one phase-wide blurb on every stack.

Apply writes \`StepFlowLink\` + action lanes so the map matches the grid.

## How **Home** renders the journey (match \`title\` + cover to this)

After import, the journey appears on **Home** as a **portrait poster tile** (2:3, Netflix-style row). The tile shows:

- **Unique generated cover art** (full-bleed background) — **required on every import**, including re-import (generate **new** art; do not reuse stock \`/home/journey-card-*.png\` assets).
- **Journey title** — the **only** text on the card (besides edit/delete).

### Home cover image (**required before \`import:apply\`**)

1. **Generate** a new PNG for this journey only (Cursor image generation, Figma MCP \`generate_image\`, etc.).
2. **Style (strict):** ${HOME_COVER_IMAGE_STYLE}. **Aspect:** ${HOME_COVER_IMAGE_ASPECT}.
3. **Subject:** subtle abstract metaphor for the product/journey in \`title\` (e.g. dashboard tiles, well schematic, workflow nodes) — still **no text, no logos**.
4. **Save** to \`journey-app/public${HOME_COVER_IMAGE_PUBLIC_DIR}/<slug-from-title>.png\` (overwrite on re-import with fresh art).
5. Set JSON **\`homeCoverImage\`**: \`"${HOME_COVER_IMAGE_PUBLIC_DIR}/<same-filename>.png"\` (public URL path, not a filesystem path).

Set import JSON \`title\` so it works as that poster label:

- **Pattern:** \`{Product or program} · {Journey name}\` (middle dot), e.g. \`DrillNet · User Journey Mapping\`, \`Lighthouse · Passdown LAR\`.
- **Length:** aim **≤ ~60 characters** (fits 2–3 lines on the tile); avoid workshop filenames, dates, or \`sourceNotes\` in \`title\`.
- **Fallback** — If \`homeCoverImage\` is missing, Home falls back to legacy keyword art; treat that as **incomplete import**.
- **Not shown on Home:** persona copy, \`goal\`, \`sourceNotes\`, phase names, completeness — those belong on **Map** / **Summary** / persona rail. Still fill \`personas[]\` for the map left panel.

## Parse structure first (before writing JSON)

1. **Grid anchor** — Column headers = \`phases[]\`. Row types = user steps, **user actions (as-is)**, goals, feelings, frustrations, opportunities.
2. **Spatial grouping** — Stickies in a column belong to that phase. Persona rail / profile = \`personas[]\`. Examples, regression IDs, cover pages → \`sourceNotes\` only.
3. **Row semantics (strict)** — Never put frustration, opportunity, or goal copy in \`actions[]\`. That array is **only what users do today** (recorded behavior). Frustrations → \`frictions[]\` or \`pain\`. Opportunities → \`opportunities[]\` or \`opportunity\`. Goals → \`experienceGoal\` on the root step. **Stack summary** → \`actionRunBlurb\` on the same root step (synthesized from \`actions[]\`, for **Combined** map view only).
4. **Empty columns** — If a phase was **not worked** in the workshop (no stickies), still include the phase in \`phases[]\` and one step with \`"coverage": "sparse"\`, \`confidence": "low"\`, title = phase name. **No** invented actions, pain, opportunities, or goals. List sparse columns in \`sourceNotes\` (e.g. "Troubleshooting and Passdown columns not covered in workshop").
5. **Unfilled facilitator rows** — A column may have **user step + user actions** while **goals, feelings, frustrations, or suggestions** are still blank (common mid-workshop). Import the behavior you see; **omit** empty rows from JSON. Set \`"coverage": "partial"\` and \`confidence": "medium"\` when any of those rows are missing but actions exist. **Do not** fabricate \`experienceGoal\`, \`feeling\`, \`frictions[]\`, or \`opportunities[]\` to “complete” the grid. Only add placeholder pain/feelings when the board or you explicitly mark \`painAssumed\` / \`feelingAssumed\` / \`feeling.assumed\` (server will not auto-fill gaps).
6. **Dedupe** — Repeated stickies across rows: keep once; note in \`sourceNotes\`.
7. **Order** — Preserve column order and connector chains; never alphabetize.

## Workshop shape → JSON

| Board row | JSON (root step per column) |
|-----------|-----------------------------|
| Phase headers | \`phases[]\` left-to-right |
| User steps | One \`steps[]\` item per column: \`title\`, \`phase\` / \`phaseTitle\` |
| **User actions** | \`actions[]\`: \`action\` or \`userAction\` **verbatim**; \`actionKey\`, \`actionLane\`; **required** \`module\` + \`screen\` (place in the product) per sticky — or split \`→\` chains into one action per screen with matching ids; do not rewrite into marketing copy |
| Goals & experiences | \`experienceGoal\` |
| **Combined stack summary** | \`actionRunBlurb\` — **one sentence per parallel lane run** (~≤128 chars). With **one** lane under a phase, set \`actionRunBlurb\` on the **root step**. With **2+ \`actionLane\` values**, omit root \`actionRunBlurb\` (or use only for notes) and set \`actionRunBlurb\` on the **first action** in **each** lane — each must describe **only** that lane’s stickies, not the whole column. Not a list; not \`experienceGoal\` copy |
| Feelings | \`feeling\` { frustration, confidence, delight, freeText }; \`assumed: true\` only if workshop says assumed |
| **Frustrations** | **Prefer \`frictions[]\`** — one string per sticky, exact wording. Else \`pain\` with \`;\` or newlines between bullets (all bullets, no summarizing) |
| **Opportunities** | **Prefer \`opportunities[]\`** — one string per sticky, exact wording. Else \`opportunity\` with \`;\` between bullets. Do not merge ideas into one sentence |
| Not covered | \`coverage": "sparse"\` step (title only) |

**Hard rule:** \`phases.length\` === count of root \`steps[]\` (one per column). Extra bullets live in \`actions[]\` under that step, not as new columns.

## Discovery depends on import fidelity (no silent loss)

Discovery and Cursor synthesis treat the **map as evidence**. If import drops or paraphrases FigJam stickies, later requirements **hallucinate** gaps you never had on the board.

- **Lossless sticky capture** — Every sticky in every worked row becomes JSON: one string per bullet in \`frictions[]\` / \`opportunities[]\`, one \`actions[]\` entry per behavior sticky. **Do not merge** two stickies into one sentence. **Do not summarize** long stickies.
- **Smallest details matter** — Keep parenthetical clarifications, screen paths (\`.html\`, menu ids), product names, acronyms (WWO, PDO, LAR), ticket references, em-dashes, and informal workshop spelling. Only fix obvious OCR/glyph errors when the source is unreadable; note fixes in \`sourceNotes\`.
- **Persona rail** — Copy goals/frustrations/tags verbatim; do not rewrite into generic UX language.
- **Goals & feelings** — \`experienceGoal\` and \`feeling.freeText\` use workshop wording, not polished PRD prose.
- **actionRunBlurb** — Author **one sentence per Combined stack** (per \`actionLane\` run). Single-lane phase → root step \`actionRunBlurb\`. Multi-lane phase → \`actionRunBlurb\` on the **first action** in each lane (e.g. admin list path vs empty list vs access denied must be **three different** blurbs). Good lane blurb: *"Admins open DDR templates and browse standard and custom lists."* Bad: one column blurb pasted on every lane. Bad: sticky list. Bad: repeating \`experienceGoal\`.
- **Set** \`importQuality.sourceKind\` to \`"figjam"\` or \`"cursor-json"\` so apply keeps copy verbatim (server will not AI-rewrite or invent opportunities).

## Rules

- **Sourced text** — Copy workshop wording; no \`assumed\` flags on text read from the board.
- **No padding** — Do not fill sparse columns from other phases, persona text, or guesses. Server leaves sparse phases empty on the map.
- **No row mixing** — Do not paste opportunity ideas ("Auto-translate…", "Eliminate manual…") into user actions. Do not paste frustrations into \`actions[]\`.
- **Inference** — Only when a **worked** column has an empty cell **and** you intend a placeholder: \`actionAssumed\`, \`painAssumed\`, \`feelingAssumed\`, or \`feeling.assumed\`. Otherwise leave the field out. Do not invent content for \`sparse\` or \`partial\` columns.
- **Completeness (when filled)** — Every frustration and opportunity sticky that **exists on the board** should appear in \`frictions[]\` / \`opportunities[]\` (or full \`pain\` / \`opportunity\` strings). Empty facilitator rows are not completeness failures.

## JSON shape (minimal)

{
  "title": "Product · Journey name",
  "homeCoverImage": "${HOME_COVER_IMAGE_PUBLIC_DIR}/product-journey-name.png",
  "sourceNotes": "File + sparse columns + assumptions",
  "importQuality": {
    "cleanlinessScore": 0,
    "needsFigjamCleaning": false,
    "sourceKind": "figjam",
    "orderingIssues": [],
    "recommendations": []
  },
  "personas": [{ "name", "role", "tags", "goals", "frustrations" }],
  "phases": [{ "title": "Column header" }],
  "steps": [
    {
      "phase": "Column header",
      "title": "User step headline",
      "experienceGoal": "Goals cell",
      "actionRunBlurb": "One sentence synthesizing all actions below for Combined map view (≤128 chars).",
      "actions": [
        {
          "actionKey": "a1",
          "actionLane": 1,
          "title": "Optional short label",
          "action": "Well → Wellbore → Operation → reporting day",
          "module": "Product",
          "screen": "screen id from board"
        }
      ],
      "frictions": [
        "First frustration sticky verbatim",
        "Second frustration sticky verbatim"
      ],
      "opportunities": [
        "First opportunity sticky verbatim",
        "Second opportunity sticky verbatim"
      ],
      "pain": "Optional combined cell if you did not use frictions[]",
      "opportunity": "Optional combined cell if you did not use opportunities[]",
      "severity": 4,
      "feeling": { "frustration": 4, "confidence": 4, "delight": 4, "freeText": "…" }
    },
    {
      "phase": "Phase C",
      "title": "User step headline — actions done, goals/pain not yet",
      "coverage": "partial",
      "confidence": "medium",
      "actions": [
        {
          "actionKey": "p3a",
          "actionLane": 1,
          "action": "Recorded behavior only",
          "module": "Product",
          "screen": "screen.html"
        }
      ]
    },
    {
      "phase": "Passdown",
      "title": "Passdown",
      "coverage": "sparse",
      "confidence": "low"
    }
  ]
}

## importQuality (agent self-check)

Grid fidelity vs the workshop file (not journey completeness). Set \`needsFigjamCleaning\` when lanes/branches are ambiguous, phases misaligned, or duplicate stickies flood rows. Note sparse columns in \`orderingIssues\` if helpful.

After apply: report title, importQuality summary, and \`/journeys/<id>/map\`. User should hard-refresh Home if they re-imported (IDs change). **Multiple journeys:** list all titles and map URLs in one summary.

## PDF / FigJam MCP

- **FigJam MCP** — Prefer table + connectors for \`actionLane\` and order. **Scan the whole file** for multiple journey sections; import each as its own JSON + apply. A deep-linked \`node-id\` is a starting point, not proof of a single journey. PDF alone → lower \`cleanlinessScore\`; say so in \`sourceNotes\`.
- **PDF** — Reconstruct columns; persona from side panel; skip examples/cover; split multi-journey PDFs into separate draft files.`;