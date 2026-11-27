"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STEPS = [
  {
    title: "Welcome",
    body: "Import Figma or workshop packs in Cursor, view the journey map here, then shape requirements and user stories in Discovery.",
  },
  {
    title: "Import",
    body: "Attach your Figma export, PDF, image, or zip in Cursor chat and ask the agent to import. Open the journey from Home → Map.",
  },
  {
    title: "Map",
    body: "Read-only canvas from your import—review steps, actions, and the persona and insights rail before Discovery.",
  },
  {
    title: "Discovery",
    body: "Edit requirements and user stories, run AI assist, and copy or export packs for delivery.",
  },
];

export function GuidedTour({ storageKey = "tour-dismissed" }: { storageKey?: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey) !== "1") setOpen(true);
  }, [storageKey]);

  if (!open) return null;
  const step = STEPS[index]!;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lg">
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-medium text-brand">Step {index + 1} of {STEPS.length}</p>
        <button
          type="button"
          aria-label="Close tour"
          onClick={() => {
            localStorage.setItem(storageKey, "1");
            setOpen(false);
          }}
        >
          <X className="h-4 w-4 text-muted" />
        </button>
      </div>
      <h4 className="font-semibold mb-1">{step.title}</h4>
      <p className="text-sm text-muted mb-4">{step.body}</p>
      <div className="flex gap-2">
        {index > 0 && (
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-lg border border-border"
            onClick={() => setIndex((i) => i - 1)}
          >
            Back
          </button>
        )}
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-lg bg-brand text-white ml-auto"
          onClick={() => {
            if (index < STEPS.length - 1) setIndex((i) => i + 1);
            else {
              localStorage.setItem(storageKey, "1");
              setOpen(false);
            }
          }}
        >
          {index < STEPS.length - 1 ? "Next" : "Done"}
        </button>
      </div>
    </div>
  );
}

export function SectionHelp({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-border bg-canvas/50 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-brand">{title} — tips</summary>
      <div className="mt-2 text-muted">{children}</div>
    </details>
  );
}