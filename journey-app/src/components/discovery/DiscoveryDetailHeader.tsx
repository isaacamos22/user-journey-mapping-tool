"use client";

import { useRef } from "react";
import { CopyTextButton } from "@/components/discovery/CopyTextButton";
import { useDiscoverySheetStickyOffsets } from "@/components/discovery/useDiscoverySheetStickyOffsets";
import { DiscoveryMapReferenceControl } from "@/components/discovery/DiscoveryMapReferenceControl";
import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";
import type { DiscoveryMapPreview } from "@/components/discovery/DiscoveryMapReferenceModal";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DiscoverySaveState = "idle" | "saving" | "saved" | "error";

export function DiscoveryDetailHeader({
  eyebrow,
  title,
  copyText,
  saveState,
  sheet = false,
  parentRequirement,
  onCloseViewer,
  mapReference,
}: {
  eyebrow: string;
  title: string;
  copyText: string;
  saveState: DiscoverySaveState;
  /** Sheet editors show title in the body; hide duplicate headline. */
  sheet?: boolean;
  parentRequirement?: { tag: string; title: string; onOpen: () => void };
  /** Closes the detail sheet; clears tree selection and returns to the map when available. */
  onCloseViewer?: () => void;
  mapReference?: {
    references?: DiscoveryReference;
    steps: DiscoveryStepOption[];
    mapPreview?: DiscoveryMapPreview | null;
  };
}) {
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Could not save"
          : "Auto-save on";

  const headerRef = useRef<HTMLElement>(null);
  useDiscoverySheetStickyOffsets(headerRef);

  return (
    <header
      ref={headerRef}
      className={cn(
        "discovery-sheet-header px-6",
        sheet ? "py-2.5" : "py-4 backdrop-blur-sm"
      )}
    >
      {parentRequirement ? (
        <p className="mb-1 text-xs text-muted">
          Under{" "}
          <button
            type="button"
            onClick={parentRequirement.onOpen}
            className="font-semibold text-brand hover:underline"
          >
            [{parentRequirement.tag}] {parentRequirement.title}
          </button>
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m3-eyebrow text-muted">{eyebrow}</p>
          {sheet ? null : (
            <p className="text-base font-semibold leading-snug text-foreground line-clamp-2">{title}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn("text-xs", saveState === "error" ? "text-red-700" : "text-muted")}
            aria-live="polite"
          >
            {saveLabel}
          </span>
          {mapReference ? (
            <DiscoveryMapReferenceControl
              references={mapReference.references}
              steps={mapReference.steps}
              mapPreview={mapReference.mapPreview}
            />
          ) : null}
          <CopyTextButton text={copyText} label="Copy all" />
          {onCloseViewer ? (
            <button
              type="button"
              className="m3-btn-icon h-8 w-8 shrink-0 text-muted hover:text-foreground"
              aria-label="Close"
              title="Close and return to map"
              onClick={onCloseViewer}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}