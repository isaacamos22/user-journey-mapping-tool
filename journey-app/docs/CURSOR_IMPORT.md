# Import via Cursor chat (primary workflow)

The **Import** screen in the app is instructions only — no file upload and no JSON paste. Do everything in **Cursor chat**.

## Steps

1. Give the agent your workshop source in Cursor chat — **either**:
   - **File:** attach image, PDF, zip, or pack.zip (or `@` mention a path in the repo), **or**
   - **Link:** paste a **Figma / FigJam** URL (`figma.com/board/...`, `figma.com/design/...`, or `figma.com/file/...`) so the agent can read the board when Figma access is set up.
2. Ask the agent to import into the User Journey Mapping Tool — e.g. *“Import this journey”* or *“Follow the journey import rule.”*
3. The agent builds structured JSON and runs `npm run import:apply -- <draft.json>` under `journey-app`. **Multiple journeys in one link/file:** discover every journey on the board or in the pack, write **one** `.cursor-import/<slug>.json` **per journey** (unique `title`, `homeCoverImage`), and run `import:apply` once per file.
4. Open each journey from **Home** → **Map** (read-only) → **Discovery** when ready to edit requirements.

## Prompt (copy into Cursor chat)

The in-app **Copy prompt for Cursor** uses `src/lib/import/cursorImportPrompt.ts`. It matches the **stakeholder Map**: one **phase card** per column (full **friction** + **opportunity** bullet lists on the card), **user actions** in horizontal **lanes** (`actionLane` + continues links).

**Home poster tile:** After apply, each journey on Home is a **2:3 portrait card** with **generated cover art** and **`title` only**. On **every import** (including re-import), the agent must **create a new image**, save it under `journey-app/public/home/covers/<slug>.png`, and set JSON **`homeCoverImage`** to `/home/covers/<slug>.png`. Style: **minimal, 3D, orthographic, blue–white theme**, no text/logos. Craft `title` as `Product · Journey name` (≤ ~60 chars). Without `homeCoverImage`, Home falls back to legacy stock art. Personas stay on the map rail.

Quick reference:

- **5 workshop columns → 5 map steps** (do not explode into 15+ top-level steps unless the source has multiple user-step headlines in one column).
- **Personas** from profile stickies: `name`, `role`, `tags`, `goals`, `frustrations`.
- **User actions** — **as-is** behavior in `actions[]`; **`module` + `screen` on every action** (from touchpoint row / inventory); never copy frustrations or opportunities into actions.
- **Combined stack summary** — **one `actionRunBlurb` per parallel lane stack** (≤ ~128 chars). Single lane → on the root step. Multiple `actionLane` values → on the **first action in each lane** (each blurb covers that run only, not the whole column). Not a sticky list. Apply synthesizes per stack when omitted (multi-lane phases no longer use one phase blurb for every stack).
- **Frustrations / opportunities** — prefer **`frictions[]`** and **`opportunities[]`** (one sticky per string). Root step only; map shows every bullet.
- **Verbatim fidelity** — preserve screen ids, acronyms, ticket refs, and parentheticals; never merge stickies or paraphrase for readability. Discovery uses map text as evidence — dropped detail causes hallucinated requirements later.
- **`importQuality.sourceKind`** — use `"figjam"` or `"cursor-json"` on workshop imports so apply skips AI rewrites and invented opportunities.
- **Sparse columns** — `"coverage": "sparse"` (title only); no invented stickies; note in `sourceNotes`.
- **Partial columns** — actions captured but goals/feelings/pain/suggestions not filled yet → `"coverage": "partial"`; leave those fields out; map shows behavior only until the workshop catches up.
- **PDF / FigJam MCP** — column → phase, connectors → order, parallel rows → `actionLane`; `importQuality` in JSON. Apply: lanes + `StepFlowLink`; header **Import clean** vs **FigJam cleanup**.
- **Re-import:** `npx tsx scripts/reimport-by-title.ts "<title>" .cursor-import/<file>.json` then hard-refresh Home.

Example workshop-shaped JSON: [examples/cursor-import-workshop-grid.json](./examples/cursor-import-workshop-grid.json)

Reference example: [examples/cursor-import-example.json](./examples/cursor-import-example.json)

## Tips

- Broken PDF text? Attach screenshots or describe the board in chat.
- Re-run the import if steps are missing; **Map** is view-only—iterate in Cursor or edit copy in **Discovery**.
- To share a finished journey, use **Export → pack.zip** and ask the agent to import the zip in chat the same way.