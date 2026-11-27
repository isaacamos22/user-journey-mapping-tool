"use client";

import { Check, Copy, LayoutTemplate } from "lucide-react";
import { useMemo, useState } from "react";
import { BlurModal } from "@/components/ui/BlurModal";
import {
  buildCursorFigmaMapExportPrompt,
  FIGMA_DESTINATION_PLACEHOLDER,
} from "@/lib/export/cursorFigmaMapExportPrompt";

export function ExportToFigmaButton({
  journeyId,
  journeyTitle,
  variant = "button",
  onMenuAction,
}: {
  journeyId: string;
  journeyTitle: string;
  variant?: "button" | "menu";
  onMenuAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [includeInsightsRail, setIncludeInsightsRail] = useState(true);
  const [copied, setCopied] = useState(false);

  const mapPageUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/journeys/${journeyId}/map`;
  }, [journeyId]);

  const prompt = useMemo(
    () =>
      buildCursorFigmaMapExportPrompt({
        journeyId,
        journeyTitle,
        figmaDestinationUrl: figmaUrl.trim() || FIGMA_DESTINATION_PLACEHOLDER,
        mapPageUrl,
        includeInsightsRail,
      }),
    [journeyId, journeyTitle, figmaUrl, mapPageUrl, includeInsightsRail]
  );

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openModal = () => {
    onMenuAction?.();
    setOpen(true);
  };

  return (
    <>
      {variant === "menu" ? (
        <button
          type="button"
          role="menuitem"
          onClick={openModal}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-surface-container-high"
        >
          <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
          Export to Figma
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-container-high transition-colors"
        >
          <LayoutTemplate className="h-4 w-4" aria-hidden />
          Export to Figma
        </button>
      )}

      <BlurModal open={open} onClose={() => setOpen(false)} title="Export map to Figma (via Cursor)" size="xl">
        <div className="space-y-5 text-sm">
          <p className="text-muted leading-relaxed">
            Paste your FigJam or Design link, then copy the Cursor prompt. For <strong className="text-foreground font-medium">FigJam</strong> boards,
            the prompt requires <strong className="text-foreground font-medium">stickies + connectors</strong> positioned with the same
            column/lane math as the app (252px steps, 28px gaps). Attach the map{" "}
            <strong className="text-foreground font-medium">PNG snapshot</strong> so placement matches the live map.
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Destination Figma link</span>
            <input
              type="url"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder={FIGMA_DESTINATION_PLACEHOLDER}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={includeInsightsRail}
              onChange={(e) => setIncludeInsightsRail(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
            />
            Include Journey insights rail in the prompt
          </label>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Prompt for Cursor</p>
            <pre className="max-h-52 overflow-y-auto rounded-lg border border-border bg-canvas/80 p-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-mono">
              {prompt}
            </pre>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copied to clipboard" : "Copy Cursor prompt"}
            </button>
          </div>

          <ol className="list-decimal list-inside space-y-1 text-xs text-muted">
            <li>PNG snapshot from this page (optional but helps pixel match)</li>
            <li>Paste prompt in Cursor + attach PNG / export pack</li>
            <li>Agent builds frames in your Figma file</li>
          </ol>
        </div>
      </BlurModal>
    </>
  );
}