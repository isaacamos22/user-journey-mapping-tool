"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ImportDraft } from "@/lib/import/types";

export function ImportReviewWizard({
  jobId,
  draft,
  enrichment,
}: {
  jobId: string;
  draft: ImportDraft;
  enrichment?: "none" | "heuristic" | "ai";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <h2 className="font-semibold">Review import</h2>
      <p className="text-sm text-muted">
        {draft.exportPackV1
          ? `App export pack for “${draft.exportPackV1.journey.title}” — full restore including nested actions, pains, requirements, and stories.`
          : `“${draft.title ?? "Imported journey"}” — ${draft.steps.length} steps, ${draft.personas.length} persona(s), ${draft.phases.length} phase(s).`}
      </p>
      {enrichment === "ai" ? (
        <p className="text-xs text-brand bg-brand/5 border border-brand/20 rounded-lg px-3 py-2">
          Structured with Azure OpenAI from your files (personas, phases, actions).
        </p>
      ) : enrichment === "heuristic" ? (
        <p className="text-xs text-muted bg-surface-container border border-border rounded-lg px-3 py-2">
          Validated and lightly normalized with built-in rules. Adjust personas and steps below before applying.
        </p>
      ) : null}
      {draft.sourceNotes?.includes("Legacy export pack") ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {draft.sourceNotes}
        </p>
      ) : null}

      {draft.personas.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Personas</h3>
          <ul className="text-sm space-y-2 border border-border rounded-lg p-3 max-h-36 overflow-auto">
            {draft.personas.map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.name}</span>
                {p.goals ? <p className="text-xs text-muted">Goals: {p.goals}</p> : null}
                {p.frustrations ? (
                  <p className="text-xs text-muted">Frustrations: {p.frustrations}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {draft.phases.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Phases</h3>
          <p className="text-sm text-muted">{draft.phases.map((p) => p.title).join(" → ")}</p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Steps</h3>
        <ul className="max-h-52 overflow-auto text-sm space-y-2 border border-border rounded-lg p-3">
          {draft.steps.map((s, i) => (
            <li key={i}>
              <div className="font-medium">
                {s.phaseTitle ? (
                  <span className="text-xs text-muted uppercase mr-2">{s.phaseTitle}</span>
                ) : null}
                {s.title}{" "}
                <span className="text-xs font-normal text-muted">({s.confidence})</span>
              </div>
              {s.userAction ? (
                <p className="text-xs text-muted mt-0.5">Action: {s.userAction}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/import/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, mode: "create" }),
          });
          const data = await res.json();
          if (data.journeyId) router.push(`/journeys/${data.journeyId}/map?imported=1`);
          setBusy(false);
        }}
        className="rounded-lg bg-brand text-white px-4 py-2 text-sm"
      >
        {draft.exportPackV1 ? "Restore user journey" : "Apply to new user journey"}
      </button>
    </div>
  );
}