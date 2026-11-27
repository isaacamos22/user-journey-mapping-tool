"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import { ScaleSlider } from "@/components/ui/ScaleSlider";
import { deletePainPoint, savePainPoint } from "@/lib/actions/journey";
import { JOURNEY_COACH_EVENT, type JourneyCoachDetail } from "@/lib/completeness/journeyCoach";

type Pain = FlowStep["painPoints"][number];

function severityColor(severity: number): string {
  const t = (severity - 1) / 4;
  const hue = 142 - t * 142;
  return `hsl(${hue} 65% 38%)`;
}

export function StepPainsPanel({
  pains,
  stepId,
  journeyId,
}: {
  pains: Pain[];
  stepId: string;
  journeyId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(pains[0]?.id ?? null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newPainSeverity, setNewPainSeverity] = useState(3);

  useEffect(() => {
    if (selectedId && pains.some((p) => p.id === selectedId)) return;
    setSelectedId(pains[0]?.id ?? null);
  }, [pains, selectedId]);

  useEffect(() => {
    const onCoach = (event: Event) => {
      const detail = (event as CustomEvent<JourneyCoachDetail>).detail;
      if (detail?.stepId !== stepId || detail.field !== "pain") return;
      const harsh = pains.find((p) => p.severity >= 4 && !p.evidence?.trim());
      if (harsh) {
        setSelectedId(harsh.id);
        setShowAddColumn(false);
      }
    };
    window.addEventListener(JOURNEY_COACH_EVENT, onCoach);
    return () => window.removeEventListener(JOURNEY_COACH_EVENT, onCoach);
  }, [pains, stepId]);

  const selected = pains.find((p) => p.id === selectedId) ?? null;

  const gridCols = showAddColumn
    ? "sm:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)]"
    : "sm:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]";

  return (
    <div className={`grid h-full min-h-0 w-full grid-cols-1 gap-4 ${gridCols}`}>
      {/* List */}
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Pains</span>
          <button
            type="button"
            onClick={() => {
              setShowAddColumn(true);
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </button>
        </div>
        <ul className="overlay-scrollbar min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {pains.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted">No pains yet.</li>
          ) : (
            pains.map((pain) => {
              const isSelected = selectedId === pain.id && !showAddColumn;
              return (
                <li key={pain.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(pain.id);
                      setShowAddColumn(false);
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected ? "bg-brand/10" : "hover:bg-surface-container"
                    }`}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: severityColor(pain.severity) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium text-foreground">
                        {pain.description || "Untitled pain"}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: severityColor(pain.severity) }}>
                        {pain.severity}/5
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Add column */}
      {showAddColumn ? (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="m3-eyebrow text-brand">New pain</span>
            <button
              type="button"
              onClick={() => {
                setShowAddColumn(false);
                if (pains[0]) setSelectedId(pains[0].id);
              }}
              className="text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <form
            className="flex min-h-0 flex-1 flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              start(async () => {
                await savePainPoint(stepId, journeyId, fd);
                form.reset();
                setNewPainSeverity(3);
                setShowAddColumn(false);
                router.refresh();
              });
            }}
          >
            <input
              name="description"
              required
              placeholder="Describe the pain"
              className="m3-field w-full bg-surface"
              autoFocus
            />
            <ScaleSlider
              name="severity"
              label="Severity"
              min={1}
              max={5}
              value={newPainSeverity}
              onChange={setNewPainSeverity}
              tone="severity"
              hint="1 = minor · 5 = blocker"
            />
            <input
              name="evidence"
              placeholder="Evidence (optional)"
              className="m3-field w-full bg-surface"
            />
            <div className="space-y-1">
              <span className="m3-eyebrow text-muted">Opportunity</span>
              <textarea
                name="opportunity"
                rows={3}
                placeholder="How to overcome or improve this pain"
                className="m3-field w-full resize-none min-h-[4.5rem] bg-surface"
              />
            </div>
            <div className="mt-auto flex justify-end pt-1">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Save pain
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!showAddColumn ? (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface p-4">
          {selected ? (
            <PainViewer pain={selected} stepId={stepId} journeyId={journeyId} />
          ) : (
            <p className="m-auto text-center text-sm text-muted px-4">
              {pains.length ? "Select a pain to preview" : "Add a pain to begin"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PainViewer({ pain, stepId, journeyId }: { pain: Pain; stepId: string; journeyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [severity, setSeverity] = useState(pain.severity);
  const [description, setDescription] = useState(pain.description);
  const [evidence, setEvidence] = useState(pain.evidence ?? "");
  const [opportunity, setOpportunity] = useState(pain.opportunity ?? "");

  useEffect(() => {
    setSeverity(pain.severity);
    setDescription(pain.description);
    setEvidence(pain.evidence ?? "");
    setOpportunity(pain.opportunity ?? "");
  }, [pain.id, pain.severity, pain.description, pain.evidence, pain.opportunity]);

  const save = (
    patch?: Partial<{ description: string; severity: number; evidence: string; opportunity: string }>
  ) => {
    const fd = new FormData();
    fd.set("id", pain.id);
    fd.set("description", patch?.description ?? description);
    fd.set("severity", String(patch?.severity ?? severity));
    fd.set("evidence", patch?.evidence ?? evidence);
    fd.set("opportunity", patch?.opportunity ?? opportunity);
    start(async () => {
      await savePainPoint(stepId, journeyId, fd);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="m3-eyebrow text-muted">Preview</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this pain point?")) return;
            start(async () => {
              await deletePainPoint(pain.id, journeyId);
              router.refresh();
            });
          }}
          className="m3-btn-icon text-red-600"
          aria-label="Delete pain"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => save()}
        className="m3-field w-full font-medium"
        aria-label="Pain description"
      />
      <ScaleSlider
        name={`severity-${pain.id}`}
        label="Severity"
        min={1}
        max={5}
        value={severity}
        onChange={(v) => {
          setSeverity(v);
          save({ severity: v });
        }}
        tone="severity"
        hint="1 = minor · 5 = blocker"
      />
      <input
        value={evidence}
        onChange={(e) => setEvidence(e.target.value)}
        onBlur={() => save()}
        placeholder="Evidence"
        className="m3-field w-full"
        data-journey-coach-field="pain"
      />
      <div className="space-y-1">
        <span className="m3-eyebrow text-muted">Opportunity</span>
        <textarea
          value={opportunity}
          onChange={(e) => setOpportunity(e.target.value)}
          onBlur={() => save()}
          placeholder="How to overcome or improve this pain"
          rows={3}
          className="m3-field w-full resize-none min-h-[4.5rem]"
        />
      </div>
      <p className="text-xs text-muted mt-auto">Edits save when you leave a field</p>
    </div>
  );
}