"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, Trash2, User } from "lucide-react";
import { savePersona, deletePersona } from "@/lib/actions/journey";
import { BlurModal, type ExpandOrigin } from "@/components/ui/BlurModal";
import { cn } from "@/lib/utils";

export type JourneyPersona = {
  id: string;
  name: string;
  role: string | null;
  goals: string | null;
  frustrations: string | null;
  tags?: string | null;
};

function personaInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function personaTagList(tags: string | null | undefined): string[] {
  if (!tags?.trim()) return [];
  return tags.split(/[,·|]/).map((t) => t.trim()).filter(Boolean);
}

function splitSentences(text: string): string[] {
  return text
    .split(/[;•]\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function captureExpandOrigin(el: HTMLElement | null): ExpandOrigin | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function PersonaRailPanel({
  journeyId,
  personas,
  readOnly = false,
}: {
  journeyId: string;
  personas: JourneyPersona[];
  readOnly?: boolean;
}) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPersona, setModalPersona] = useState<JourneyPersona | undefined>(undefined);
  const [expandOrigin, setExpandOrigin] = useState<ExpandOrigin | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const originGetterRef = useRef<(() => ExpandOrigin | null) | null>(null);

  const openAddModal = (origin?: ExpandOrigin | null) => {
    setModalPersona(undefined);
    setExpandOrigin(origin ?? captureExpandOrigin(addBtnRef.current));
    originGetterRef.current = () => captureExpandOrigin(addBtnRef.current);
    setModalOpen(true);
  };

  const openEditModal = (persona: JourneyPersona, originEl: HTMLElement) => {
    setModalPersona(persona);
    setExpandOrigin(captureExpandOrigin(originEl));
    originGetterRef.current = () => captureExpandOrigin(originEl);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalPersona(undefined);
  };

  useEffect(() => {
    if (readOnly) return;
    const onPersonas = () => {
      setSectionOpen(true);
      document.getElementById("journey-personas")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      window.setTimeout(() => openAddModal(captureExpandOrigin(addBtnRef.current)), 120);
    };
    window.addEventListener("journey:coach-personas", onPersonas);
    return () => window.removeEventListener("journey:coach-personas", onPersonas);
  }, [readOnly]);

  const modalTitle = modalPersona ? `Edit persona — ${modalPersona.name}` : "Add persona";

  return (
    <section id="journey-personas" className="m3-panel m3-panel-tonal min-w-0 w-full max-w-full scroll-mt-4">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        aria-expanded={sectionOpen}
        className="flex w-full items-center gap-2 px-3 py-3 text-left m3-section-toggle normal-case tracking-normal"
      >
        <User className="h-4 w-4 text-brand shrink-0" aria-hidden />
        <span className="text-sm font-semibold text-foreground flex-1">Personas</span>
        <span className="m3-caption font-semibold tabular-nums">{personas.length}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-on-surface-variant transition-transform", sectionOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {sectionOpen && (
        <div className="space-y-2 border-t border-border px-3 pb-3 pt-3">
          {personas.length === 0 ? (
            <p className="m3-body-muted">
              {readOnly ? "No personas in this import." : "Add who this journey is for."}
            </p>
          ) : (
            <ul className="space-y-2">
              {personas.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "m3-card min-w-0 max-w-full overflow-hidden rounded-xl px-3 py-3",
                    readOnly ? "border-border" : "border-brand/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 gap-2.5">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand"
                        aria-hidden
                      >
                        {personaInitials(p.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">{p.name}</p>
                        {p.role ? (
                          <p className="m3-caption mt-0.5 break-words leading-snug text-foreground/85">{p.role}</p>
                        ) : readOnly ? (
                          <p className="m3-caption mt-0.5 text-muted italic">Role not captured in import</p>
                        ) : null}
                      </div>
                    </div>
                    {!readOnly ? (
                      <span className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          title="Edit"
                          aria-label={`Edit ${p.name}`}
                          onClick={(e) => openEditModal(p, e.currentTarget)}
                          className="m3-btn-icon text-brand hover:bg-surface-container"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label={`Delete ${p.name}`}
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(`Delete persona "${p.name}"?`)) return;
                            start(async () => {
                              await deletePersona(p.id, journeyId);
                              router.refresh();
                            });
                          }}
                          className="m3-btn-icon text-red-700 hover:bg-surface-container"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    ) : null}
                  </div>
                  {readOnly ? (
                    <div className="mt-3 space-y-2.5">
                      {personaTagList(p.tags).length > 0 ? (
                        <ul className="flex flex-wrap gap-1">
                          {personaTagList(p.tags).map((tag) => (
                            <li
                              key={tag}
                              className="max-w-full break-words rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-foreground/90"
                            >
                              {tag}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {p.goals ? (
                        <div className="rounded-lg bg-surface-container px-3 py-2.5">
                          <p className="m3-eyebrow mb-1.5 text-[10px]">Goals</p>
                          <ul className="m3-caption space-y-1 leading-snug text-foreground/90 list-disc pl-4">
                            {splitSentences(p.goals).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {p.frustrations ? (
                        <div className="rounded-lg bg-surface-container px-3 py-2.5">
                          <p className="m3-eyebrow mb-1.5 text-[10px]">Frustrations & pressures</p>
                          <ul className="m3-caption space-y-1 leading-snug text-foreground/90 list-disc pl-4">
                            {splitSentences(p.frustrations).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (p.goals || p.frustrations) ? (
                    <p className="m3-caption mt-1.5 line-clamp-2">
                      {[p.goals, p.frustrations].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {!readOnly ? (
            <button
              ref={addBtnRef}
              type="button"
              onClick={() => openAddModal()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline py-2.5 text-sm font-semibold text-brand hover:bg-surface-container min-h-[2.5rem]"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add persona
            </button>
          ) : null}
        </div>
      )}

      {!readOnly ? (
      <BlurModal
        open={modalOpen}
        onClose={closeModal}
        title={modalTitle}
        size="lg"
        dimBackdrop={false}
        expandFrom={expandOrigin}
        getExpandOrigin={() => originGetterRef.current?.() ?? expandOrigin}
      >
        <PersonaEditorForm
          key={modalPersona?.id ?? "new"}
          journeyId={journeyId}
          persona={modalPersona}
          pending={pending}
          onDone={closeModal}
          onCancel={closeModal}
        />
      </BlurModal>
      ) : null}
    </section>
  );
}

function PersonaEditorForm({
  journeyId,
  persona,
  pending,
  onDone,
  onCancel,
}: {
  journeyId: string;
  persona?: JourneyPersona;
  pending: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <form
      className="m3-body space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (persona) fd.set("id", persona.id);
        start(async () => {
          await savePersona(journeyId, fd);
          form.reset();
          onDone();
          router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <label htmlFor="persona-name" className="m3-eyebrow text-foreground">
          Name
        </label>
        <input
          id="persona-name"
          name="name"
          required
          defaultValue={persona?.name ?? ""}
          placeholder="e.g. Jordan"
          className="m3-field w-full"
          disabled={pending}
          autoFocus
          data-journey-coach-field="persona-name"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="persona-role" className="m3-eyebrow text-foreground">
          Role
        </label>
        <input
          id="persona-role"
          name="role"
          defaultValue={persona?.role ?? ""}
          placeholder="e.g. Operations analyst"
          className="m3-field w-full"
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="persona-goals" className="m3-eyebrow text-foreground">
          Goals
        </label>
        <textarea
          id="persona-goals"
          name="goals"
          defaultValue={persona?.goals ?? ""}
          placeholder="What they want from this journey"
          rows={3}
          className="m3-field w-full resize-none min-h-[5rem]"
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="persona-frustrations" className="m3-eyebrow text-foreground">
          Frustrations
        </label>
        <textarea
          id="persona-frustrations"
          name="frustrations"
          defaultValue={persona?.frustrations ?? ""}
          placeholder="Pain points and blockers"
          rows={3}
          className="m3-field w-full resize-none min-h-[5rem]"
          disabled={pending}
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-1 sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="m3-btn-text px-4 py-2.5 min-h-[2.75rem]"
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="m3-btn-filled px-5 py-2.5 min-h-[2.75rem]">
          {pending ? "Saving…" : persona ? "Save changes" : "Add persona"}
        </button>
      </div>
    </form>
  );
}