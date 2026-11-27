# Map → Figma (Cursor + Figma MCP)

**FigJam (`figma.com/board/…`):** Use **stickies + connectors** only (no Design shapes). Copy must follow **`JourneyCanvas` `layoutColumnPositions`** — 252px lane steps, 96px column gutter, 28px stack/gap — and lane grouping from the export pack + flow links. Attach a **map PNG** and align columns to it.

**Design (`figma.com/design/…`):** Optional `generate_figma_design` capture from localhost map + component build.

On **Map**, use **Export to Figma** next to PNG / PDF export.

1. Paste your **destination Figma file** URL (design or board).
2. Copy the **Cursor prompt** (includes journey id, map path, and layout spec from `JourneyCanvas`).
3. In Cursor chat: attach map **PNG snapshot** (optional), paste prompt, send.

The prompt instructs the agent to use **figma-use-figjam** (stickies, connectors, sections) and match:

- Same column/lane **positions** as the app (`layoutColumnPositions`)
- Root stickies carry goal / friction / opportunity; action stickies carry user actions only
- Connectors: continues within lanes; phase roots linked left → right

Prompt builder: `src/lib/export/cursorFigmaMapExportPrompt.ts`