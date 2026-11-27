"use client";

import { Check, Copy, MessageSquare } from "lucide-react";
import { useState } from "react";
import { CURSOR_IMPORT_CHAT_PROMPT } from "@/lib/import/cursorImportPrompt";

const STEPS = [
  "Attach workshop file, image, PDF, or zip in Cursor chat.",
  "Paste the prompt below and send.",
  "Open the new journey from Home → Map.",
] as const;

export function CursorImportPanel() {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(CURSOR_IMPORT_CHAT_PROMPT);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      <div className="space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <MessageSquare className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Import</h1>
        <p className="text-sm text-muted max-w-md mx-auto">
          No upload here — attach FigJam link, PDF, or screenshots in{" "}
          <span className="text-foreground font-medium">Cursor chat</span>. The agent should parse grid structure
          (columns, connectors, deduped stickies) and you will see an <strong className="text-foreground font-medium">Import clean</strong> or{" "}
          <strong className="text-foreground font-medium">FigJam cleanup</strong> badge after apply.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface/90 shadow-sm backdrop-blur-sm p-6 sm:p-8 text-left space-y-6">
        <ol className="space-y-3">
          {STEPS.map((line, i) => (
            <li key={line} className="flex gap-3 text-sm text-muted">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-snug">{line}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Prompt for Cursor</p>
          <pre className="max-h-40 overflow-y-auto rounded-lg border border-border bg-canvas/80 p-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-mono">
            {CURSOR_IMPORT_CHAT_PROMPT}
          </pre>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied to clipboard" : "Copy prompt"}
          </button>
        </div>
      </section>
    </div>
  );
}