# User-action flow graph (tree view)

## Today

- **Steps** are root cards in a horizontal phase (column width grows when an action row is wider).
- **User actions** nest under a step (`parentStepId`) in **lanes**: each horizontal run is a sibling chain (`groupActionsIntoSiblingRuns`); solo bullets get their own row.
- **Import** splits workshop `→` / `->` chains into multiple child steps plus `StepFlowLink` (`continues`) and persists `actionFlowBranchId` via `backfillActionLanesForParents`. JSON: `continuesAfter` (same phase, merge lanes), `continuesTo` (cross-phase connectors + optional `kind: "alternate"`).
- **Map** (`JourneyCanvas`) loads flow links, lays out runs left-to-right, nests only the **head** of each run from the parent, and draws horizontal **flow-out → flow-in** edges within a run.

## Goal

- User actions (and eventually steps) can **link to each other** as siblings — branches, alternates, continues.
- **Tree / graph view** with **curved connectors** that route around cards (no overlapping strokes).
- **Auto-arrange** cards from link topology (layered layout).

## Data model

`StepFlowLink` (journey-scoped):

| Field | Purpose |
|-------|---------|
| `fromStepId` / `toStepId` | Directed edge between steps (typically user actions) |
| `kind` | `continues` (default) or `alternate` (future styling) |

Unique on `(fromStepId, toStepId)`.

## Layout

1. **Phase columns** — root steps stack vertically; column width follows the widest action subgraph in that phase.
2. **Under each step** — [**Dagre**](https://github.com/dagrejs/dagre) (`rankdir: LR`, layered / Sugiyama) positions actions from `StepFlowLink` edges; orphans (e.g. discard) stack below. Trunk chains and merge feeders share one free graph instead of fixed row slots.
3. **Edges** — handle sides follow relative card placement (top/bottom/left/right); strokes use React Flow **smooth-step** paths with light bundling for parallel links.
4. **Future** — optional full-graph ELK for global crossing reduction across phases.

## UI roadmap

| Phase | Deliverable |
|-------|-------------|
| 1 ✅ | Schema + migration + overlay + auto-order under parent |
| 2 | “Link action” affordance (pick target, create `StepFlowLink`) |
| 3 | Optional **tree mode** toggle: ELK layout replacing columns |
| 4 | Import/export links in journey pack JSON |

## Creating links (interim)

Until the UI ships, insert rows via Prisma/SQL or a small script:

```ts
await prisma.stepFlowLink.create({
  data: { journeyId, fromStepId, toStepId, kind: "continues" },
});
```

Refresh Map to see curved links and re-ordered actions under the parent step.