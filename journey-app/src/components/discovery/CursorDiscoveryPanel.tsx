"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import type { CanvasStep } from "@/components/journey/JourneyCanvas";
import { buildCursorDiscoveryPrompt } from "@/lib/discovery/cursorDiscoveryPrompt";
import type { DiscoveryScopeTarget } from "@/lib/discovery/discoveryScope";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";

export function CursorDiscoveryPanel({
  journeyId,
  journeyTitle,
  scope,
  mapEngagement,
  stepOptions,
  canvasSteps,
  compact = false,
  onStartFromMap,
  mapReady = false,
  minimal = false,
}: {
  journeyId: string;
  journeyTitle: string;
  scope?: DiscoveryScopeTarget[];
  mapEngagement?: MapEngagement;
  stepOptions?: DiscoveryStepOption[];
  canvasSteps?: CanvasStep[];
  compact?: boolean;
  onStartFromMap?: () => void;
  mapReady?: boolean;
  /** Hides duplicate steps while the map picker is open in the main panel. */
  minimal?: boolean;
}) {
  const prompt = useMemo(
    () =>
      buildCursorDiscoveryPrompt(
        { id: journeyId, title: journeyTitle },
        scope,
        mapEngagement && stepOptions && canvasSteps
          ? { mapEngagement, stepOptions, canvasSteps }
          : undefined
      ),
    [journeyId, journeyTitle, scope, mapEngagement, stepOptions, canvasSteps]
  );
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {minimal ? (
          scope?.length ? (
            <p className="text-[11px] text-muted">{scope.length} item(s) in scope</p>
          ) : null
        ) : (
          <p className="text-[11px] leading-snug text-muted">
            Map → copy prompt → Cursor → refresh.
          </p>
        )}
        {mapReady && onStartFromMap && !minimal ? (
          <button
            type="button"
            onClick={onStartFromMap}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/35 bg-brand/5 px-2.5 py-2 text-xs font-medium text-brand hover:bg-brand/10"
          >
            New set from map
          </button>
        ) : null}
        {scope?.length ? (
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-2.5 py-2 text-xs font-medium text-white hover:bg-brand-hover"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? "Copied" : `Copy prompt (${scope.length} in scope)`}
          </button>
        ) : minimal ? null : (
          <p className="text-[11px] text-muted">Pick scope on the map first.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <DiscoveryPromptBlock
        prompt={prompt}
        onCopy={copyPrompt}
        copied={copied}
        previewClassName="max-h-[min(52vh,28rem)]"
      />
    </div>
  );
}

export function DiscoveryPromptBlock({
  prompt,
  onCopy,
  copied,
  previewClassName = "max-h-36",
}: {
  prompt: string;
  onCopy: () => void;
  copied: boolean;
  previewClassName?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Prompt for Cursor</p>
      <pre
        className={`overflow-y-auto rounded-lg border border-border bg-canvas/80 p-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-mono overlay-scrollbar ${previewClassName}`}
      >
        {prompt}
      </pre>
      <button
        type="button"
        disabled={!prompt.trim()}
        onClick={() => void onCopy()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied to clipboard" : "Copy prompt"}
      </button>
    </div>
  );
}