"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveStep } from "@/lib/actions/journey";

type StepActionTitleFieldProps = {
  stepId: string;
  journeyId: string;
  phaseId: string;
  initialTitle: string;
  initialUserAction: string;
  variant: "step" | "action";
  onPersisted?: (patch: { title: string; userAction: string }) => void;
};

function fieldValue(isAction: boolean, title: string, userAction: string) {
  return isAction ? userAction.trim() || title.trim() : title.trim();
}

export function StepActionTitleField({
  stepId,
  journeyId,
  phaseId,
  initialTitle,
  initialUserAction,
  variant,
  onPersisted,
}: StepActionTitleFieldProps) {
  const router = useRouter();
  const isAction = variant === "action";
  const [value, setValue] = useState(() =>
    fieldValue(isAction, initialTitle, initialUserAction)
  );
  const preservedOtherRef = useRef(isAction ? initialTitle : initialUserAction);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirtyRef = useRef(false);
  const valueRef = useRef(value);
  const lastSavedValueRef = useRef(fieldValue(isAction, initialTitle, initialUserAction));
  const debounceRef = useRef<number | null>(null);
  const refreshRef = useRef<number | null>(null);
  const onPersistedRef = useRef(onPersisted);
  const savingChainRef = useRef<Promise<void> | null>(null);
  const pendingAfterFlightRef = useRef<string | null>(null);

  valueRef.current = value;
  onPersistedRef.current = onPersisted;

  const scheduleRefresh = useCallback(() => {
    if (refreshRef.current !== null) window.clearTimeout(refreshRef.current);
    refreshRef.current = window.setTimeout(() => {
      refreshRef.current = null;
      router.refresh();
    }, 1500);
  }, [router]);

  const buildFormData = useCallback(
    (trimmed: string) => {
      const fd = new FormData();
      fd.set("id", stepId);
      fd.set("lightSave", "1");
      let title: string;
      let userAction: string;
      if (isAction) {
        userAction = trimmed;
        title = preservedOtherRef.current.trim() || trimmed || "User action";
      } else {
        title = trimmed || "Step";
        userAction = preservedOtherRef.current.trim();
      }
      fd.set("title", title);
      fd.set("userAction", userAction);
      return { fd, title, userAction };
    },
    [stepId, isAction]
  );

  const performSave = useCallback(
    async (trimmed: string) => {
      const { fd, title, userAction } = buildFormData(trimmed);
      await saveStep(phaseId, journeyId, fd);
      lastSavedValueRef.current = trimmed;
      dirtyRef.current = false;
      preservedOtherRef.current = isAction ? title : userAction;
      onPersistedRef.current?.({ title, userAction });
      scheduleRefresh();
    },
    [buildFormData, journeyId, phaseId, isAction, scheduleRefresh]
  );

  const pumpSaveQueue = useCallback(() => {
    if (savingChainRef.current) return;

    const run = async () => {
      setStatus("saving");
      try {
        for (;;) {
          const next = pendingAfterFlightRef.current ?? valueRef.current.trim();
          pendingAfterFlightRef.current = null;
          if (next === lastSavedValueRef.current && !dirtyRef.current) break;
          await performSave(next);
          const stillDirty = dirtyRef.current && valueRef.current.trim() !== lastSavedValueRef.current;
          if (!pendingAfterFlightRef.current && !stillDirty) break;
        }
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 900);
      } catch {
        setStatus("error");
      } finally {
        savingChainRef.current = null;
        if (pendingAfterFlightRef.current) pumpSaveQueue();
      }
    };

    savingChainRef.current = run();
  }, [performSave]);

  const requestSave = useCallback(() => {
    const trimmed = valueRef.current.trim();
    if (!dirtyRef.current && trimmed === lastSavedValueRef.current) return;

    if (savingChainRef.current) {
      pendingAfterFlightRef.current = trimmed;
      return;
    }
    pumpSaveQueue();
  }, [pumpSaveQueue]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      requestSave();
    }, 400);
  }, [requestSave]);

  useEffect(() => {
    preservedOtherRef.current = isAction ? initialTitle : initialUserAction;
    if (dirtyRef.current) return;
    const next = fieldValue(isAction, initialTitle, initialUserAction);
    setValue(next);
    lastSavedValueRef.current = next;
  }, [stepId, initialTitle, initialUserAction, isAction]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    scheduleSave();
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [value, scheduleSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (refreshRef.current !== null) {
        window.clearTimeout(refreshRef.current);
        refreshRef.current = null;
      }
      const trimmed = valueRef.current.trim();
      if (dirtyRef.current && trimmed !== lastSavedValueRef.current) {
        pendingAfterFlightRef.current = trimmed;
        if (!savingChainRef.current) {
          void performSave(trimmed).catch(() => undefined);
        }
      }
    };
  }, [performSave]);

  const label = isAction ? "Action title" : "Step title";
  const placeholder = isAction ? "Verb-led user action" : "Name this step";
  const inputId = `${isAction ? "action" : "step"}-title-${stepId}`;

  const userActionHint =
    !isAction && (preservedOtherRef.current.trim() || initialUserAction.trim())
      ? preservedOtherRef.current.trim() || initialUserAction.trim()
      : "";

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="m3-eyebrow text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => {
          dirtyRef.current = true;
          setValue(e.target.value);
        }}
        onBlur={() => {
          if (debounceRef.current !== null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
          requestSave();
        }}
        placeholder={placeholder}
        className="m3-field w-full"
        autoFocus
      />
      {userActionHint ? (
        <p className="text-xs text-muted">
          User action on card: <span className="text-foreground">{userActionHint}</span>
        </p>
      ) : null}
      <p className="text-xs text-muted min-h-[1.25rem]" aria-live="polite">
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : status === "error"
              ? "Could not save — try again"
              : "Changes save automatically"}
      </p>
    </div>
  );
}