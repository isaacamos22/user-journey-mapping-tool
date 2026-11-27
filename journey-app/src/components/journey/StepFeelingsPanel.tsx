"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import { ScaleSlider } from "@/components/ui/ScaleSlider";
import { deleteStepFeeling, saveStepFeeling } from "@/lib/actions/journey";

type Feeling = FlowStep["feelings"][number];

function scoresLabel(f: Feeling): string {
  return `C${f.confidence} · F${f.frustration} · D${f.delight}`;
}

export function StepFeelingsPanel({
  feelings,
  stepId,
  journeyId,
}: {
  feelings: Feeling[];
  stepId: string;
  journeyId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(feelings[0]?.id ?? null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [addConfidence, setAddConfidence] = useState(4);
  const [addFrustration, setAddFrustration] = useState(4);
  const [addDelight, setAddDelight] = useState(4);

  useEffect(() => {
    if (selectedId && feelings.some((f) => f.id === selectedId)) return;
    setSelectedId(feelings[0]?.id ?? null);
  }, [feelings, selectedId]);

  const selected = feelings.find((f) => f.id === selectedId) ?? null;

  const gridCols = showAddColumn
    ? "sm:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)]"
    : "sm:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]";

  return (
    <div className={`grid h-full min-h-0 w-full grid-cols-1 gap-4 ${gridCols}`}>
      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-surface">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Feelings</span>
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
          {feelings.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted">No feelings yet.</li>
          ) : (
            feelings.map((feeling) => {
              const isSelected = selectedId === feeling.id && !showAddColumn;
              return (
                <li key={feeling.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(feeling.id);
                      setShowAddColumn(false);
                    }}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors ${
                      isSelected ? "bg-brand/10" : "hover:bg-surface-container"
                    }`}
                  >
                    <span className="line-clamp-2 font-medium text-foreground">
                      {feeling.title?.trim() || "Untitled feeling"}
                    </span>
                    <span className="text-xs font-medium text-muted">{scoresLabel(feeling)}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {showAddColumn ? (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="m3-eyebrow text-brand">New feeling</span>
            <button
              type="button"
              onClick={() => {
                setShowAddColumn(false);
                if (feelings[0]) setSelectedId(feelings[0].id);
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
                await saveStepFeeling(stepId, journeyId, fd);
                form.reset();
                setAddConfidence(4);
                setAddFrustration(4);
                setAddDelight(4);
                setShowAddColumn(false);
                router.refresh();
              });
            }}
          >
            <input
              name="title"
              required
              placeholder="Label (e.g. After checkout)"
              className="m3-field w-full bg-surface"
              autoFocus
            />
            <ScaleSlider
              name="confidence"
              label="Confidence"
              min={1}
              max={7}
              value={addConfidence}
              onChange={setAddConfidence}
            />
            <ScaleSlider
              name="frustration"
              label="Frustration"
              min={1}
              max={7}
              value={addFrustration}
              onChange={setAddFrustration}
              tone="neutral"
            />
            <ScaleSlider
              name="delight"
              label="Delight"
              min={1}
              max={7}
              value={addDelight}
              onChange={setAddDelight}
            />
            <textarea
              name="freeText"
              placeholder="Comment (optional)"
              rows={3}
              className="m3-field w-full min-h-[4.5rem] resize-y bg-surface"
            />
            <div className="mt-auto flex justify-end pt-1">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Save feeling
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!showAddColumn ? (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface p-4">
          {selected ? (
            <FeelingViewer feeling={selected} stepId={stepId} journeyId={journeyId} />
          ) : (
            <p className="m-auto text-center text-sm text-muted px-4">
              {feelings.length ? "Select a feeling to preview" : "Add a feeling to begin"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FeelingViewer({
  feeling,
  stepId,
  journeyId,
}: {
  feeling: Feeling;
  stepId: string;
  journeyId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(feeling.title);
  const [confidence, setConfidence] = useState(feeling.confidence);
  const [frustration, setFrustration] = useState(feeling.frustration);
  const [delight, setDelight] = useState(feeling.delight);
  const [freeText, setFreeText] = useState(feeling.freeText ?? "");

  useEffect(() => {
    setTitle(feeling.title);
    setConfidence(feeling.confidence);
    setFrustration(feeling.frustration);
    setDelight(feeling.delight);
    setFreeText(feeling.freeText ?? "");
  }, [feeling.id, feeling.title, feeling.confidence, feeling.frustration, feeling.delight, feeling.freeText]);

  const save = (
    patch?: Partial<{
      title: string;
      confidence: number;
      frustration: number;
      delight: number;
      freeText: string;
    }>
  ) => {
    const fd = new FormData();
    fd.set("id", feeling.id);
    fd.set("title", patch?.title ?? title);
    fd.set("confidence", String(patch?.confidence ?? confidence));
    fd.set("frustration", String(patch?.frustration ?? frustration));
    fd.set("delight", String(patch?.delight ?? delight));
    fd.set("freeText", patch?.freeText ?? freeText);
    start(async () => {
      await saveStepFeeling(stepId, journeyId, fd);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
      <div className="flex items-start justify-between gap-2">
        <span className="m3-eyebrow text-muted">Preview</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this feeling?")) return;
            start(async () => {
              await deleteStepFeeling(feeling.id, journeyId);
              router.refresh();
            });
          }}
          className="m3-btn-icon text-red-600"
          aria-label="Delete feeling"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => save()}
        className="m3-field w-full font-medium"
        aria-label="Feeling label"
      />
      <ScaleSlider
        name={`confidence-${feeling.id}`}
        label="Confidence"
        min={1}
        max={7}
        value={confidence}
        onChange={(v) => {
          setConfidence(v);
          save({ confidence: v });
        }}
      />
      <ScaleSlider
        name={`frustration-${feeling.id}`}
        label="Frustration"
        min={1}
        max={7}
        value={frustration}
        onChange={(v) => {
          setFrustration(v);
          save({ frustration: v });
        }}
        tone="neutral"
      />
      <ScaleSlider
        name={`delight-${feeling.id}`}
        label="Delight"
        min={1}
        max={7}
        value={delight}
        onChange={(v) => {
          setDelight(v);
          save({ delight: v });
        }}
      />
      <div className="shrink-0 space-y-1">
        <span className="m3-eyebrow text-muted">Comment</span>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onBlur={() => save()}
          placeholder="Context, quotes, or workshop notes for this feeling"
          rows={4}
          className="m3-field w-full min-h-[4.5rem] max-h-40 resize-y"
        />
      </div>
      <p className="shrink-0 text-xs text-muted pt-0.5">Edits save when you leave a field</p>
    </div>
  );
}