export type ImportConfidence = "high" | "medium" | "low";

export type ImportDraftPain = {
  description: string;
  severity?: number;
  /** Opportunities row for this phase column (workshop grid). */
  opportunity?: string;
  /** True when pain was inferred, not read from the workshop source. */
  assumed?: boolean;
};

export type ImportDraftFeeling = {
  title?: string;
  confidence?: number;
  frustration?: number;
  delight?: number;
  freeText?: string;
  assumed?: boolean;
};

export type ImportDraftAction = {
  title?: string;
  userAction: string;
  userActionAssumed?: boolean;
  touchpoint?: { module?: string; screen?: string };
  /** Workshop frustrations belong on the phase step — not on nested actions (apply strips these). */
  pain?: ImportDraftPain;
  feelings?: ImportDraftFeeling[];
  /** FigJam connector row / Y-band — same value = one horizontal lane on the map. */
  actionLane?: string | number;
  /** Stable id within the step for continuesAfter references. */
  actionKey?: string;
  /**
   * actionKey(s) of prior stickies that flow into this one (FigJam merge).
   * One key = single predecessor; multiple keys = branch lanes merging into this action.
   */
  continuesAfter?: string | string[];
  /**
   * FigJam connectors that cross phase columns — target action in another root step.
   * Use when a sticky in this column links to the next column (not spatially under that phase).
   */
  continuesTo?: {
    phase: string;
    actionKey: string;
    kind?: "continues" | "alternate";
  }[];
  /** Combined-map stack summary for this lane when multiple parallel `actionLane` runs exist. */
  actionRunBlurb?: string;
};

export type WorkshopColumnCoverage = "full" | "partial" | "sparse";

export type ImportDraftStep = {
  title: string;
  /** `sparse` = workshop column empty / not covered — import must not invent map content. */
  coverage?: WorkshopColumnCoverage;
  /** Goals & experiences row for this workshop column. */
  experienceGoal?: string;
  userAction?: string;
  /** Set when userAction was inferred (still nested under step on apply). */
  userActionAssumed?: boolean;
  /** JSON import: allow server to add placeholder pain only when true. */
  painAssumed?: boolean;
  /** JSON import: allow server to add placeholder feelings only when true. */
  feelingAssumed?: boolean;
  /** JSON import: allow server to infer a single user action when missing. */
  actionAssumed?: boolean;
  /** Additional nested user actions (map shows these under the step). */
  actions?: ImportDraftAction[];
  /**
   * One-sentence narrative for Combined/Overview action stacks on the map.
   * Synthesize from actions + step title — not a list of stickies (optional).
   */
  actionRunBlurb?: string;
  phaseTitle?: string;
  touchpoint?: { module?: string; screen?: string };
  pain?: ImportDraftPain;
  /** Per-phase Opportunities cell (FigJam); also accepted on pain.opportunity. */
  opportunity?: string;
  /** Explicit friction bullets (else split `pain` / `pain.description` on `;`). */
  frictions?: string[];
  /** Explicit opportunity bullets (else split `opportunity` on `;`). */
  opportunities?: string[];
  feelings?: ImportDraftFeeling[];
  confidence: ImportConfidence;
};

/** Agent-reported import fidelity; server recomputes and may tighten scores on apply. */
export type ImportQualityDraftHint = {
  cleanlinessScore?: number;
  needsFigjamCleaning?: boolean;
  sourceKind?: "figjam" | "figjam-pdf" | "pdf" | "cursor-json" | "unknown";
  orderingIssues?: string[];
  recommendations?: string[];
};

import type { JourneyExportPackV1 } from "@/lib/export/journeyPackV1";

export type ImportDraft = {
  title?: string;
  /**
   * Home poster background for this journey only (public path).
   * Generate fresh art on every import — see cursorImportPrompt.ts.
   */
  homeCoverImage?: string;
  personas: {
    name: string;
    role?: string;
    tags?: string;
    goals?: string;
    frustrations?: string;
    confidence: ImportConfidence;
  }[];
  phases: { title: string; confidence: ImportConfidence }[];
  steps: ImportDraftStep[];
  sourceNotes?: string;
  importQuality?: ImportQualityDraftHint;
  /** Full round-trip restore when importing app export pack zips */
  exportPackV1?: JourneyExportPackV1;
};