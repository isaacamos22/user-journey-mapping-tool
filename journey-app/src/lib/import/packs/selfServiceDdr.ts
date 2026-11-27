import type { ImportDraft } from "@/lib/import/types";

/**
 * Self-service DDR (Req 2807056) — report template administrator journey.
 * Synthesized from FigJam user-journey work + req-2807056-ddr-ux-flows.canvas.tsx.
 */
export const SELF_SERVICE_DDR_SLUG = "self-service-ddr-req-2807056";

export function selfServiceDdrImportDraft(): ImportDraft {
  return {
    title: "Self-service DDR",
    sourceNotes:
      "Req 2807056 · Per-client rig DDR templates in DrillNet. Primary persona: report template administrator (UX S1–S5). UX S6 (Daily share / scheduler) captured in a downstream phase for reference. Sources: Self-service DDR wireframes, UX flows canvas, ADO 2923445–2924581.",
    personas: [
      {
        name: "Report template administrator",
        goals:
          "Configure rig-specific DDR templates (layout, branding, publish) without a development ticket; keep published templates visible to scheduling and Daily report users.",
        frustrations:
          "Unclear permissions, duplicate template names, live-vs-draft confusion, and fear of publishing the wrong layout to operations.",
        confidence: "high",
      },
    ],
    phases: [
      { title: "Configure template (S1–S3)", confidence: "high" },
      { title: "Brand & preview (S4)", confidence: "high" },
      { title: "Publish lifecycle (S5)", confidence: "high" },
      { title: "Downstream · UX S6 (reference)", confidence: "medium" },
    ],
    steps: [
      {
        phaseTitle: "Configure template (S1–S3)",
        title: "UX S1 — Access DDR template settings",
        userAction: "Open DrillNet Setup › Reporting › DDR templates",
        touchpoint: { module: "DrillNet", screen: "Setup › Reporting › Template list" },
        pain: {
          description: "Without edit role, navigation entry is hidden or unavailable",
          severity: 4,
        },
        confidence: "high",
      },
      {
        phaseTitle: "Configure template (S1–S3)",
        title: "UX S2 — Create or edit rig template",
        userAction: "Create rig template or open existing draft from list",
        touchpoint: { module: "DrillNet", screen: "Rig template list / create" },
        pain: {
          description: "Duplicate template name blocked until renamed",
          severity: 3,
        },
        confidence: "high",
      },
      {
        phaseTitle: "Configure template (S1–S3)",
        title: "UX S2 — Draft from published",
        userAction: "Open live published template as a new draft copy",
        touchpoint: { module: "DrillNet", screen: "Edit metadata" },
        pain: {
          description: "Protected standard template cannot be edited in place",
          severity: 3,
        },
        confidence: "high",
      },
      {
        phaseTitle: "Configure template (S1–S3)",
        title: "UX S3 — Layout, fields, sections",
        userAction: "Show/hide fields, reorder sections, edit labels, add catalog fields",
        touchpoint: { module: "DrillNet", screen: "Template layout editor" },
        pain: {
          description: "Hiding a required QA field triggers confirmation warning",
          severity: 3,
        },
        confidence: "high",
      },
      {
        phaseTitle: "Brand & preview (S4)",
        title: "UX S4 — Branding & full preview",
        userAction: "Upload logo, set branding, run full report preview",
        touchpoint: { module: "DrillNet", screen: "Branding & preview" },
        pain: {
          description: "Invalid logo type or size rejected; preview shows placeholders",
          severity: 3,
        },
        confidence: "high",
      },
      {
        phaseTitle: "Publish lifecycle (S5)",
        title: "UX S5 — Draft, version history, publish",
        userAction: "Save draft, review versions, publish or reset to standard",
        touchpoint: { module: "DrillNet", screen: "Template lifecycle" },
        pain: {
          description: "Unsaved changes when leaving editor without save",
          severity: 4,
        },
        confidence: "high",
      },
      {
        phaseTitle: "Publish lifecycle (S5)",
        title: "UX S5 — Publish outcome",
        userAction: "Confirm publish — template live for scheduler and Daily baseline",
        touchpoint: { module: "DrillNet", screen: "Publish modal" },
        confidence: "high",
      },
      {
        phaseTitle: "Downstream · UX S6 (reference)",
        title: "UX S6B — Report scheduler",
        userAction: "Scheduling admin picks published rig template for report job",
        touchpoint: { module: "DrillNet", screen: "Report scheduler picker" },
        confidence: "medium",
      },
      {
        phaseTitle: "Downstream · UX S6 (reference)",
        title: "UX S6A — Daily share (field engineer)",
        userAction: "Share personal Daily column settings with crew; resolve conflicts",
        touchpoint: { module: "DrillNet", screen: "Daily report · Share settings" },
        pain: {
          description: "Personal settings conflict with published rig template",
          severity: 3,
        },
        confidence: "medium",
      },
    ],
  };
}