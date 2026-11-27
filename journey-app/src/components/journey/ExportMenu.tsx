"use client";

import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { Download, MoreVertical } from "lucide-react";
import { ExportToFigmaButton } from "@/components/journey/ExportToFigmaButton";
import { cn } from "@/lib/utils";

function ExportMenuItem({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-surface-container-high",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ExportMenu({
  journeyId,
  journeyTitle = "Journey map",
  captureId,
}: {
  journeyId: string;
  journeyTitle?: string;
  captureId?: string;
}) {
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function downloadPack() {
    setOpen(false);
    const res = await fetch(`/api/journeys/${journeyId}/export/pack`);
    if (!res.ok) return;
    const blob = await res.blob();
    saveAs(blob, "journey-export-pack.zip");
  }

  async function downloadPng() {
    if (!captureId || busy.current) return;
    setOpen(false);
    busy.current = true;
    const el = document.getElementById(captureId);
    if (el) {
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
      saveAs(dataUrl, "journey-summary.png");
    }
    busy.current = false;
  }

  function printPdf() {
    setOpen(false);
    window.print();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="m3-btn-icon h-9 w-9 text-muted hover:bg-surface-container-high hover:text-foreground"
        aria-label="Export options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[13.5rem] rounded-lg border border-border bg-surface p-1 shadow-[var(--elevation-2)]"
        >
          <ExportMenuItem onClick={() => void downloadPack()}>
            <Download className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            Export pack (ZIP)
          </ExportMenuItem>
          {captureId ? (
            <ExportMenuItem onClick={() => void downloadPng()}>PNG snapshot</ExportMenuItem>
          ) : null}
          <ExportMenuItem onClick={printPdf}>PDF (print)</ExportMenuItem>
          <div className="my-1 border-t border-border" />
          <ExportToFigmaButton
            journeyId={journeyId}
            journeyTitle={journeyTitle}
            variant="menu"
            onMenuAction={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}