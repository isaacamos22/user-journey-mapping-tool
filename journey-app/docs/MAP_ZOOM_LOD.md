# Map zoom and view LOD

React Flow **viewport zoom** (`minZoom` 0.35, `maxZoom` 1.2) only scales/pans the canvas — it does **not** switch card content.

**View LOD** (Detail / Combined / Overview) is chosen with the **View** control on the top-left of the map. Wheel and pinch change zoom % only.

## View tiers

| Tier | Button label | Card content |
|------|----------------|--------------|
| `detail` | Detail | Full facilitator body: goals, touchpoints, expandable friction / opportunity |
| `compact` | Combined | Action stack blurbs per step |
| `overview` | Overview | Minimal step + short stack blurb |

## Implementation notes

- `useMapDetailLevel` holds manual tier state and exposes `setViewLevel`.
- **Visual** and **layout** tier update together on view button click (instant — no fold animation).
- Canvas root: `data-map-detail`, `data-map-detail-layout` on `.journey-canvas`.
- `--map-readability-scale` updates only when the view tier changes (not on viewport zoom). Spacing relayout + one DOM remeasure after paint.

## View control (left)

- **Detail / Combined / Overview** — switches LOD only (viewport zoom unchanged).
- **Zoom %** — live readout of pinch/wheel zoom (React Flow Controls also zoom).

## Facilitator tips

- Choose **Detail** before expanding pain/opportunity panels or reading long goal copy.
- Zoom out for context; switch to **Combined** or **Overview** when you need denser cards, not the other way around.