"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { ImportDraft } from "@/lib/import/types";
import { mergeImportDrafts } from "@/lib/import/mergeDrafts";
import { ImportReviewWizard } from "@/components/import/ImportReviewWizard";

const ACCEPT =
  ".csv,.json,.xlsx,.xls,.docx,.pdf,.html,.htm,.md,.markdown,.txt,.zip,application/json,text/csv,text/html,application/zip";

async function parseUploadFile(
  file: File
): Promise<{ draft: ImportDraft; enrichment?: "none" | "heuristic" | "ai" }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/import", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to parse ${file.name}`);
  return {
    draft: data.draft as ImportDraft,
    enrichment: data.enrichment,
  };
}

async function stashMergedDraft(
  draft: ImportDraft
): Promise<{
  jobId: string;
  draft?: ImportDraft;
  enrichment?: "none" | "heuristic" | "ai";
}> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Import failed");
  return {
    jobId: data.jobId as string,
    draft: data.draft as ImportDraft | undefined,
    enrichment: data.enrichment,
  };
}

export function ImportHub() {
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [enrichment, setEnrichment] = useState<"none" | "heuristic" | "ai" | undefined>();
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFilesChosen = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    setSelectedFiles((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (!next.some((f) => f.name === file.name && f.size === file.size)) {
          next.push(file);
        }
      }
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setError(null);
    setDraft(null);
    setJobId(null);
    setEnrichment(undefined);
    try {
      const drafts: ImportDraft[] = [];
      let lastEnrichment: typeof enrichment;
      for (const file of selectedFiles) {
        const parsed = await parseUploadFile(file);
        drafts.push(parsed.draft);
        lastEnrichment = parsed.enrichment ?? lastEnrichment;
      }
      const merged = mergeImportDrafts(drafts);
      const stashed = await stashMergedDraft(merged);
      setDraft(stashed.draft ?? merged);
      setEnrichment(stashed.enrichment ?? lastEnrichment);
      setJobId(stashed.jobId);
      setSelectedFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
        <h2 className="font-semibold">FigJam / Figma (optional)</h2>
        <p className="text-xs text-muted">
          Workshop in Figma, then import here — upload a PDF export below, or paste a FigJam board URL if you use a Figma token.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const res = await fetch("/api/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                figmaUrl: fd.get("url"),
                token: fd.get("token"),
              }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || "Import failed");
            else {
              setDraft(data.draft);
              setJobId(data.jobId);
              setEnrichment(data.enrichment);
            }
          }}
          className="space-y-2"
        >
          <input
            name="url"
            placeholder="https://www.figma.com/board/..."
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            name="token"
            placeholder="Figma PAT (optional if set in Settings)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-brand text-white rounded-lg px-4 py-2 text-sm">
            Parse FigJam
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
        <h2 className="font-semibold">Workshop files</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => onFilesChosen(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand/5 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload file
          </button>
          <button
            type="button"
            disabled={selectedFiles.length === 0 || processing}
            onClick={() => void processFiles()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {processing
              ? "Processing…"
              : selectedFiles.length > 1
                ? `Process ${selectedFiles.length} files`
                : "Process file"}
          </button>
        </div>
        <p className="text-xs text-muted">
          PDF from Figma, plus CSV, Excel, Word, HTML, zip, and more — we infer personas, phases, steps, and actions. Select one or more, then process.
        </p>
        {selectedFiles.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-border bg-surface-container p-2 text-sm">
            {selectedFiles.map((file, i) => (
              <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 px-1">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="m3-btn-icon shrink-0 text-muted hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {draft && jobId && (
        <ImportReviewWizard jobId={jobId} draft={draft} enrichment={enrichment} />
      )}
    </div>
  );
}