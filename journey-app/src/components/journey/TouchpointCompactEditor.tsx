"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTouchpoint } from "@/lib/actions/journey";

const FIELD_KEYS = ["module", "screen", "panel", "dialog"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const DEFAULT_LABELS: Record<FieldKey, string> = {
  module: "Module",
  screen: "Screen",
  panel: "Panel",
  dialog: "Dialog",
};

type TouchpointCompactEditorProps = {
  stepId: string;
  journeyId: string;
  touchpoint?: {
    module?: string | null;
    screen?: string | null;
    panel?: string | null;
    dialog?: string | null;
  };
};

function activeFromTouchpoint(fields: Record<FieldKey, string>): FieldKey {
  const hit = FIELD_KEYS.find((k) => fields[k]?.trim());
  return hit ?? "module";
}

export function TouchpointCompactEditor({ stepId, journeyId, touchpoint }: TouchpointCompactEditorProps) {
  const router = useRouter();
  const [, start] = useTransition();
  const initialFields = useMemo(
    () => ({
      module: touchpoint?.module ?? "",
      screen: touchpoint?.screen ?? "",
      panel: touchpoint?.panel ?? "",
      dialog: touchpoint?.dialog ?? "",
    }),
    [touchpoint]
  );
  const [fields, setFields] = useState(initialFields);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [active, setActive] = useState<FieldKey>(() => activeFromTouchpoint(initialFields));
  const [editingLabel, setEditingLabel] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const skipNextSave = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const loadedStepId = useRef(stepId);

  useEffect(() => {
    if (loadedStepId.current !== stepId) {
      loadedStepId.current = stepId;
      setFields(initialFields);
      setActive(activeFromTouchpoint(initialFields));
      skipNextSave.current = true;
      return;
    }
    setFields((prev) => {
      const a = activeRef.current;
      return {
        ...initialFields,
        [a]: prev[a],
      };
    });
    skipNextSave.current = true;
  }, [stepId, initialFields]);

  const persist = () => {
    const fd = new FormData();
    for (const key of FIELD_KEYS) {
      fd.set(key, active === key ? fields[active] : "");
    }
    start(async () => {
      await saveTouchpoint(stepId, journeyId, fd);
      setStatus("saved");
      router.refresh();
      window.setTimeout(() => setStatus("idle"), 1200);
    });
  };

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setStatus("saving");
    const t = window.setTimeout(persist, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced snapshot of fields/active
  }, [fields, active]);

  const selectTag = (key: FieldKey) => {
    setEditingLabel(false);
    setActive(key);
    activeRef.current = key;
    setFields({
      module: "",
      screen: "",
      panel: "",
      dialog: "",
      [key]: fields[key] || initialFields[key],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Touchpoint category">
        {FIELD_KEYS.map((key) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectTag(key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-dashed border-border text-muted hover:border-brand/40"
              }`}
            >
              {labels[key]}
            </button>
          );
        })}
      </div>
      {editingLabel ? (
        <input
          value={labels[active]}
          onChange={(e) => setLabels((prev) => ({ ...prev, [active]: e.target.value }))}
          onBlur={() => setEditingLabel(false)}
          className="m3-field text-sm max-w-[10rem]"
          aria-label="Category label"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingLabel(true)}
          className="text-xs text-muted hover:text-brand text-left"
        >
          Category: <span className="font-medium text-foreground">{labels[active]}</span> (click to rename)
        </button>
      )}
      <input
        value={fields[active]}
        onChange={(e) => setFields((prev) => ({ ...prev, [active]: e.target.value }))}
        placeholder={`Where / what (${labels[active].toLowerCase()})…`}
        className="m3-field w-full"
        data-journey-coach-field="touchpoint"
      />
      <p className="text-xs text-muted min-h-[1.25rem]" aria-live="polite">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "One category · saves automatically"}
      </p>
    </div>
  );
}