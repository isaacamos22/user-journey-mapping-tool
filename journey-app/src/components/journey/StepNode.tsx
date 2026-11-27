"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MapPin, AlertTriangle, Heart, MoreVertical, Trash2, Pencil } from "lucide-react";
import { MarqueeLine } from "@/components/ui/MarqueeLine";
import { BlurModal, type ExpandOrigin } from "@/components/ui/BlurModal";
import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import { deleteStep } from "@/lib/actions/journey";
import { StepPainsPanel } from "@/components/journey/StepPainsPanel";
import { StepFeelingsPanel } from "@/components/journey/StepFeelingsPanel";
import { useJourneyCanvasSelectionOptional } from "@/components/journey/JourneyCanvasSelectionContext";
import { TouchpointCompactEditor } from "@/components/journey/TouchpointCompactEditor";
import { StepActionTitleField } from "@/components/journey/StepActionTitleField";
import {
  focusCoachField,
  JOURNEY_COACH_EVENT,
  type JourneyCoachDetail,
} from "@/lib/completeness/journeyCoach";
import { StepSection } from "@/components/journey/StepSection";

export function StepNode({
  step,
  index,
  subIndex,
  journeyId,
  phaseId,
  variant = "step",
}: {
  step: FlowStep;
  index: number;
  subIndex?: number;
  journeyId: string;
  phaseId: string;
  variant?: "step" | "action";
}) {
  const isAction = variant === "action";
  const tp = step.touchpoints[0];
  const [pending, start] = useTransition();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editingStep, setEditingStep] = useState(false);
  const [editTab, setEditTab] = useState<"details" | "pains" | "feelings">("details");
  const [expandOrigin, setExpandOrigin] = useState<ExpandOrigin | null>(null);
  const [persistedTitles, setPersistedTitles] = useState<{ title: string; userAction: string } | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refresh = () => router.refresh();
  const stepLabel = subIndex ? `${index}.${subIndex}` : String(index);
  const hoverEdit = isAction ? "hover:bg-brand/10" : "hover:bg-white/15";
  useEffect(() => {
    setPersistedTitles(null);
  }, [step.id, step.title, step.userAction]);

  const displayTitle = isAction
    ? persistedTitles?.userAction || step.userAction || persistedTitles?.title || step.title
    : persistedTitles?.title || step.title;
  const canvasSelection = useJourneyCanvasSelectionOptional();
  const isCanvasSelected = canvasSelection?.isSelected(step.id) ?? false;

  const tpParts = touchpointParts(tp);

  useEffect(() => {
    if (!menuOpen) return;
    const closeIfOutside = (target: EventTarget | null) => {
      const el = menuRef.current;
      if (el && target instanceof Node && !el.contains(target)) setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => closeIfOutside(e.target);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleDelete = () => {
    setMenuOpen(false);
    if (!confirm(`Delete step "${step.title}"?`)) return;
    start(async () => {
      await deleteStep(step.id, journeyId, phaseId);
      refresh();
    });
  };

  const closeEditor = () => {
    setExpanded(false);
    setEditingStep(false);
    setEditTab("details");
  };

  const captureOrigin = (): ExpandOrigin | null => {
    const r = articleRef.current?.getBoundingClientRect();
    if (!r) return expandOrigin;
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    };
  };

  const openEditor = (tab: "details" | "pains" | "feelings" = "details") => {
    setMenuOpen(false);
    const origin = captureOrigin();
    if (origin) setExpandOrigin(origin);
    setEditTab(tab);
    setExpanded(true);
  };

  useEffect(() => {
    const onCoach = (event: Event) => {
      const detail = (event as CustomEvent<JourneyCoachDetail>).detail;
      if (!detail?.stepId || detail.stepId !== step.id) return;
      articleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const tab = detail.tab ?? "details";
      openEditor(tab);
      if (detail.field) {
        window.setTimeout(() => focusCoachField(step.id, detail.field!, isAction), 280);
      }
    };
    window.addEventListener(JOURNEY_COACH_EVENT, onCoach);
    return () => window.removeEventListener(JOURNEY_COACH_EVENT, onCoach);
  }, [step.id, isAction]);

  const modalTitle = isAction
    ? `Edit user action ${stepLabel}`
    : `Edit step ${stepLabel}`;

  return (
    <article
      ref={articleRef}
      data-journey-step-id={step.id}
      className={`m3-card w-full flex flex-col overflow-hidden ${
        isAction ? "m3-card-raised border-brand/25" : ""
      } ${
        isCanvasSelected ? "ring-2 ring-brand shadow-[0_0_0_1px_rgba(0,20,220,0.35)]" : ""
      }`}
    >
      <header
        className={`px-4 py-3 flex items-start justify-between gap-2 ${
          isAction
            ? "bg-brand-container text-foreground border-b border-border"
            : "bg-brand text-on-brand"
        }`}
      >
        <button
          type="button"
          data-journey-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => (expanded ? closeEditor() : openEditor("details"))}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          {isAction ? (
            <span className="m3-eyebrow block text-brand">User action</span>
          ) : (
            <span className="m3-eyebrow block text-on-brand/90">Step {stepLabel}</span>
          )}
          {!editingStep ? (
            <MarqueeLine
              text={displayTitle}
              className={isAction ? "m3-title-sm" : "m3-title-sm text-on-brand"}
            />
          ) : null}
          <StepHeaderLocation
            tpParts={tpParts}
            variant={isAction ? "action" : "step"}
          />
        </button>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            data-journey-no-drag
            title="Step menu"
            aria-label="Step menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={`m3-btn-icon ${hoverEdit}`}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] rounded-lg border border-border bg-surface py-1 shadow-lg"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-container"
                onClick={() => {
                  setMenuOpen(false);
                  openEditor("details");
                  setEditingStep(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={pending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                onClick={() => handleDelete()}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div
        className="w-full cursor-grab bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-container active:cursor-grabbing"
        onClick={() => {
          if (!expanded) openEditor("details");
        }}
        onKeyDown={(e) => {
          if (expanded) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openEditor("details");
          }
        }}
        role="group"
        tabIndex={expanded ? -1 : 0}
        aria-label={
          isAction
            ? `User action ${stepLabel}. Drag to reparent or activate to edit.`
            : `Step ${stepLabel} summary. Drag to reorder or activate to expand.`
        }
      >
        <StepCardSummary step={step} />
      </div>

      <BlurModal
        open={expanded}
        onClose={closeEditor}
        title={modalTitle}
        size={editTab === "pains" || editTab === "feelings" ? "2xl" : "xl"}
        dimBackdrop={false}
        expandFrom={expandOrigin}
        getExpandOrigin={captureOrigin}
        fixedShell
      >
        <div
          data-journey-coach-modal={step.id}
          className="m3-body flex h-full min-h-0 flex-col gap-4 sm:flex-row sm:gap-0"
        >
          <nav
            className="flex shrink-0 flex-row gap-1 border-border sm:w-44 sm:flex-col sm:border-r sm:pr-3"
            role="tablist"
            aria-label="Step editor sections"
          >
            {(
              [
                { id: "details" as const, label: "Details" },
                { id: "pains" as const, label: `Pains (${step.painPoints.length})` },
                { id: "feelings" as const, label: `Feelings (${step.feelings.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={editTab === tab.id}
                aria-controls={`step-editor-panel-${tab.id}`}
                id={`step-editor-tab-${tab.id}`}
                onClick={() => setEditTab(tab.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  editTab === tab.id
                    ? "bg-brand/10 text-brand border border-brand/25 sm:border-0 sm:border-l-[3px] sm:border-l-brand sm:rounded-none sm:rounded-r-md"
                    : "text-muted hover:bg-surface-container hover:text-foreground border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div
            className="min-h-0 min-w-0 flex-1 overflow-hidden sm:pl-5"
            role="tabpanel"
            id={`step-editor-panel-${editTab}`}
            aria-labelledby={`step-editor-tab-${editTab}`}
          >
          {editTab === "details" ? (
            <div className="space-y-5">
              <StepActionTitleField
                key={step.id}
                stepId={step.id}
                journeyId={journeyId}
                phaseId={phaseId}
                variant={isAction ? "action" : "step"}
                initialTitle={step.title}
                initialUserAction={step.userAction ?? ""}
                onPersisted={setPersistedTitles}
              />

              <StepSection
                title="Touchpoint"
                icon={<MapPin className="h-4 w-4" aria-hidden />}
                borderClass="border-brand/40"
                titleClass="text-brand"
              >
                <TouchpointCompactEditor
                  key={`${step.id}-${tp?.module ?? ""}-${tp?.screen ?? ""}`}
                  stepId={step.id}
                  journeyId={journeyId}
                  touchpoint={tp}
                />
              </StepSection>
            </div>
          ) : null}

          {editTab === "pains" ? (
            <StepPainsPanel pains={step.painPoints} stepId={step.id} journeyId={journeyId} />
          ) : null}

          {editTab === "feelings" ? (
            <StepFeelingsPanel feelings={step.feelings} stepId={step.id} journeyId={journeyId} />
          ) : null}
          </div>
        </div>
      </BlurModal>
    </article>
  );
}

function painSeverityColor(severity: number): string {
  const t = (severity - 1) / 4;
  const hue = 142 - t * 142;
  return `hsl(${hue} 65% 38%)`;
}

/** M3-style tonal container: green (low) → red (high), light & saturated. */
function painSeveritySurface(avgSeverity: number): string {
  const clamped = Math.max(1, Math.min(5, avgSeverity));
  const t = (clamped - 1) / 4;
  const hue = 142 - t * 142;
  return `hsl(${hue} 55% 93%)`;
}

const TOUCHPOINT_STYLES: Record<
  "module" | "screen" | "panel" | "dialog",
  { backgroundColor: string; color: string }
> = {
  module: { backgroundColor: "#0014dc", color: "#ffffff" },
  screen: { backgroundColor: "#0284c7", color: "#ffffff" },
  panel: { backgroundColor: "#7c3aed", color: "#ffffff" },
  dialog: { backgroundColor: "#d97706", color: "#ffffff" },
};

const SUMMARY_MUTED = "text-[10px] font-medium leading-none text-foreground/45";

const SUMMARY_COL_BOX =
  "flex min-h-[5.25rem] min-w-0 flex-1 basis-0 flex-col items-start justify-start gap-1.5 self-stretch rounded-xl px-2.5 py-2 text-[10px] leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]";

const SUMMARY_ROW =
  "flex w-full min-w-0 flex-row items-stretch gap-2";

const SUMMARY_COL_TITLE = "font-semibold leading-none text-foreground/85";

function feelingScoreColor(score: number): string {
  const t = (Math.min(7, Math.max(1, score)) - 1) / 6;
  const hue = t * 142;
  return `hsl(${hue} 55% 38%)`;
}

/** M3-style tonal container tied to average feeling intensity. */
function feelingScoreSurface(avg: number): string {
  const clamped = Math.max(1, Math.min(7, avg));
  const t = (clamped - 1) / 6;
  const hue = t * 142;
  return `hsl(${hue} 50% 93%)`;
}

function summarizePains(pains: FlowStep["painPoints"]) {
  if (pains.length === 0) return null;
  const count = pains.length;
  const totalSeverity = pains.reduce((sum, p) => sum + p.severity, 0);
  const avgSeverity = totalSeverity / count;
  const peakSeverity = Math.max(...pains.map((p) => p.severity));
  return { count, totalSeverity, avgSeverity, peakSeverity };
}

function summarizeFeelings(feelings: FlowStep["feelings"]) {
  if (feelings.length === 0) return null;
  const count = feelings.length;
  const scores = feelings.flatMap((f) => [f.confidence, f.frustration, f.delight]);
  const total = scores.reduce((sum, n) => sum + n, 0);
  const avg = total / scores.length;
  const peak = Math.max(...scores);
  return { count, avg, peak };
}

function formatAvg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

type TouchpointPart = keyof typeof TOUCHPOINT_STYLES;

function SummaryColumn({
  title,
  count,
  className,
  surfaceStyle,
  children,
}: {
  title: string;
  count: number;
  className?: string;
  surfaceStyle?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={`${SUMMARY_COL_BOX} ${surfaceStyle ? "" : "bg-surface-container-high"} ${className ?? ""}`}
      style={surfaceStyle}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span className={SUMMARY_COL_TITLE}>{title}</span>
        <span
          className="tabular-nums text-[11px] font-bold text-foreground/70"
          aria-label={`${count} ${title.toLowerCase()}${count === 1 ? "" : "s"}`}
        >
          {count}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 text-foreground/60">{children}</div>
    </div>
  );
}

function SummaryAvgPeakLines({
  empty,
  avgValue,
  avgMax,
  avgColor,
  peakValue,
  peakMax,
  peakColor,
}: {
  empty: boolean;
  avgValue: string;
  avgMax: number;
  avgColor: string;
  peakValue: number;
  peakMax: number;
  peakColor: string;
}) {
  if (empty) {
    return <span className={SUMMARY_MUTED}>None</span>;
  }
  return (
    <>
      <div>
        Avg{" "}
        <span className="font-bold tabular-nums" style={{ color: avgColor }}>
          {avgValue}/{avgMax}
        </span>
      </div>
      <div>
        Peak{" "}
        <span className="font-semibold tabular-nums" style={{ color: peakColor }}>
          {peakValue}/{peakMax}
        </span>
      </div>
    </>
  );
}

function formatLocationLabel(tpParts: [TouchpointPart, string][]): string {
  if (tpParts.length === 0) return "";
  return tpParts.map(([, v]) => v).join(" · ");
}

function touchpointParts(
  touchpoint: FlowStep["touchpoints"][0] | undefined
): [TouchpointPart, string][] {
  if (!touchpoint) return [];
  return (
    [
      ["module", touchpoint.module] as const,
      ["screen", touchpoint.screen] as const,
      ["panel", touchpoint.panel] as const,
      ["dialog", touchpoint.dialog] as const,
    ].filter(([, v]) => v?.trim()) as [TouchpointPart, string][]
  );
}

function StepHeaderLocation({
  tpParts,
  variant,
}: {
  tpParts: [TouchpointPart, string][];
  variant: "step" | "action";
}) {
  const locLabel = formatLocationLabel(tpParts);
  const onBrand = variant === "step";
  return (
    <div
      className={`mt-1.5 flex min-w-0 items-center gap-1 text-[10px] leading-snug ${
        onBrand ? "text-on-brand/75" : "text-muted"
      }`}
    >
      <MapPin className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 truncate" title={locLabel || undefined}>
        {tpParts.length === 0 ? "Location not set" : locLabel}
      </span>
    </div>
  );
}

function StepSummaryGrid({
  pains,
  feelings,
}: {
  pains: FlowStep["painPoints"];
  feelings: FlowStep["feelings"];
}) {
  const pain = summarizePains(pains);
  const feel = summarizeFeelings(feelings);

  return (
    <div className="w-full min-w-0" aria-label="Step pains and feelings">
      <div className={SUMMARY_ROW} role="row">
        <SummaryColumn
          title="Pain"
          count={pains.length}
          surfaceStyle={
            pain ? { backgroundColor: painSeveritySurface(pain.avgSeverity) } : undefined
          }
        >
          <SummaryAvgPeakLines
            empty={!pain}
            avgValue={pain ? formatAvg(pain.avgSeverity) : ""}
            avgMax={5}
            avgColor={pain ? painSeverityColor(Math.max(1, Math.round(pain.avgSeverity))) : ""}
            peakValue={pain?.peakSeverity ?? 0}
            peakMax={5}
            peakColor={pain ? painSeverityColor(pain.peakSeverity) : ""}
          />
        </SummaryColumn>
        <SummaryColumn
          title="Feeling"
          count={feelings.length}
          surfaceStyle={feel ? { backgroundColor: feelingScoreSurface(feel.avg) } : undefined}
        >
          <SummaryAvgPeakLines
            empty={!feel}
            avgValue={feel ? formatAvg(feel.avg) : ""}
            avgMax={7}
            avgColor={feel ? feelingScoreColor(feel.avg) : ""}
            peakValue={feel?.peak ?? 0}
            peakMax={7}
            peakColor={feel ? feelingScoreColor(feel.peak) : ""}
          />
        </SummaryColumn>
      </div>
    </div>
  );
}

function StepCardSummary({ step }: { step: FlowStep }) {
  return (
    <div className="w-full min-w-0" aria-label="Step summary">
      <StepSummaryGrid pains={step.painPoints} feelings={step.feelings} />
    </div>
  );
}

