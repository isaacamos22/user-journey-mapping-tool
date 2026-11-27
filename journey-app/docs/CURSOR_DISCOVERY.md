# Discovery via Cursor chat

The **Discovery** tab does not generate in the browser. Use **Cursor chat** to analyze the map and apply JSON — same pattern as [CURSOR_IMPORT.md](./CURSOR_IMPORT.md).

## Steps

1. Finish the **Map** (personas, pains, touchpoints) for the journey.
2. Open **Discovery**. The main panel shows an **interactive map** — click phase cards, user actions, or friction/opportunity bullets and add them to **Discovery scope** (nothing is auto-picked).
3. Click **Copy prompt for Cursor** (scope is embedded in the prompt).
4. Paste the prompt in Cursor chat. The agent reads the journey map, writes JSON under `journey-app/.cursor-discovery/`, and runs:

```bash
npm run discovery:apply -- <journeyId> <file.json>
```

By default, one apply creates **one discovery set** (all requirements in a single batch). Re-running apply within a few minutes replaces that set (same Cursor pass). For a **later** Cursor chat, add `--append` to keep the previous set and add another:

```bash
npm run discovery:apply -- <journeyId> <file.json> --append
```

5. Refresh **Discovery** to see the new set; edit requirements and user stories in the app.

For another batch later, use **New set from map** in the left rail and repeat (use `discovery:apply --append` in Cursor).

## Prompt

The in-app prompt (`src/lib/discovery/cursorDiscoveryPrompt.ts`) includes this journey’s **id**, **title**, and the **user-selected scope** (step/pain/opportunity ids). It asks the agent to:

- Read the **stakeholder map**: phase columns, friction/opportunity on **root steps only**, nested actions as lanes/flows
- Ground `references` with root **`stepId`**, **`painId`**, **`personaId`**
- Output 3–10 UX requirements (priority from phase pain severity) with one user story each

## JSON

See [examples/cursor-discovery-example.json](./examples/cursor-discovery-example.json).

`npm run discovery:apply` creates one batch (`synthesisBatchId`) so the tree shows a single new **Discovery set**.

## Tips

- Re-run apply for a new batch; delete old sets in the tree if needed.
- Azure OpenAI in `.env` is optional — analysis happens in Cursor, not via **Generate from map** (removed).