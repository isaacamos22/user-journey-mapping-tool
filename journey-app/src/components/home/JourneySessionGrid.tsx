"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Search, Trash2 } from "lucide-react";
import { BlurModal } from "@/components/ui/BlurModal";
import { JourneyCardArt } from "@/components/home/JourneyCardArt";
import { deleteJourney, reorderHomeJourneys, updateJourneyMeta } from "@/lib/actions/journey";
import {
  HOME_JOURNEY_CARD_GLOW,
  type HomeJourneyCardTheme,
} from "@/lib/home/homeJourneyCardSummary";
import { HOME_JOURNEY_CUSTOM_COVER_GLOW } from "@/lib/home/homeCoverImage";

export type JourneyCardData = {
  id: string;
  title: string;
  cardTheme: HomeJourneyCardTheme;
  homeCoverImage?: string | null;
};

/** Netflix-style poster tiles — fixed column width, 2:3 portrait. */
const HOME_JOURNEY_CARD_GRID =
  "grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(10.25rem,12.5rem))] justify-start";

function matchQuery(j: JourneyCardData, q: string): boolean {
  if (!q) return true;
  return j.title.toLowerCase().includes(q);
}

function JourneyCardBody({ journey }: { journey: JourneyCardData }) {
  return (
    <div className="relative z-[1] mt-auto flex w-full min-w-0 shrink-0 flex-col pb-0.5">
      <h2 className="home-journey-card-text text-[0.8rem] font-semibold leading-tight text-foreground line-clamp-3 sm:text-sm">
        {journey.title}
      </h2>
    </div>
  );
}

function JourneyCardShell({
  journey,
  onDelete,
  onEdit,
  deleting,
  drag,
  isOverlay,
  sortableRef,
  onOpen,
  suppressNavigateRef,
}: {
  journey: JourneyCardData;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  deleting?: boolean;
  drag?: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  };
  isOverlay?: boolean;
  sortableRef?: (element: HTMLElement | null) => void;
  onOpen?: () => void;
  suppressNavigateRef?: RefObject<boolean>;
}) {
  const openUnlessDragged = () => {
    if (isOverlay || !onOpen || suppressNavigateRef?.current) return;
    onOpen();
  };

  const sortableProps = (() => {
    if (!drag) return {};
    const { role: _role, tabIndex: _tabIndex, ...attributes } = drag.attributes;
    return { ...attributes, ...drag.listeners };
  })();

  return (
    <div
      ref={sortableRef}
      onKeyDown={(e) => {
        if (!onOpen || isOverlay) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openUnlessDragged();
        }
      }}
      onClick={openUnlessDragged}
      style={
        {
          "--home-card-glow": journey.homeCoverImage
            ? HOME_JOURNEY_CUSTOM_COVER_GLOW
            : HOME_JOURNEY_CARD_GLOW[journey.cardTheme],
        } as CSSProperties
      }
      className={`home-journey-card-shell home-journey-card-shell--${journey.cardTheme} relative flex aspect-[2/3] w-full flex-col justify-end overflow-visible rounded-lg border border-border bg-surface p-3 shadow-sm transition-[box-shadow,border-color,transform] select-none ${
        isOverlay ? "w-[12.5rem] " : ""
      }${
        isOverlay
          ? "cursor-grabbing shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-2 ring-brand/35"
          : drag
            ? "cursor-grab active:cursor-grabbing hover:border-brand"
            : onOpen
              ? "cursor-pointer hover:border-brand"
              : "hover:border-brand"
      }`}
      {...sortableProps}
      role={drag && !isOverlay ? "button" : onOpen && !isOverlay ? "link" : undefined}
      tabIndex={drag && !isOverlay ? 0 : onOpen && !isOverlay ? 0 : undefined}
      aria-label={
        drag && !isOverlay
          ? `${journey.title}, drag to reorder`
          : onOpen && !isOverlay
            ? `Open ${journey.title}`
            : undefined
      }
    >
      {onEdit || onDelete ? (
        <div className="home-journey-card-chrome absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-md p-0.5">
          {onEdit ? (
            <button
              type="button"
              className="rounded-md p-1.5 text-muted hover:bg-surface-container hover:text-brand"
              aria-label={`Edit ${journey.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(journey.id);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              disabled={deleting}
              className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              aria-label={`Delete ${journey.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(journey.id);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <JourneyCardArt theme={journey.cardTheme} coverImage={journey.homeCoverImage} />
      <JourneyCardBody journey={journey} />
    </div>
  );
}

function SortableJourneyCard({
  journey,
  onDelete,
  onEdit,
  deleting,
  onOpen,
  suppressNavigateRef,
}: {
  journey: JourneyCardData;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  deleting: boolean;
  onOpen: () => void;
  suppressNavigateRef: RefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: journey.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li style={style} className={`list-none py-1 ${isDragging ? "opacity-40" : ""}`}>
      <JourneyCardShell
        journey={journey}
        onDelete={onDelete}
        onEdit={onEdit}
        deleting={deleting}
        sortableRef={setNodeRef}
        drag={{ attributes, listeners }}
        onOpen={onOpen}
        suppressNavigateRef={suppressNavigateRef}
      />
    </li>
  );
}

type JourneyHomeSessionsProps = {
  journeys: JourneyCardData[];
  newSessionForm: ReactNode | null;
  emptyStateMessage?: string;
  showImportInEmpty?: boolean;
};

export function JourneyHomeSessions({
  journeys: initial,
  newSessionForm,
  emptyStateMessage,
  showImportInEmpty = true,
}: JourneyHomeSessionsProps) {
  const router = useRouter();
  const [journeys, setJourneys] = useState(initial);
  useEffect(() => {
    setJourneys(initial);
  }, [initial]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmJourney, setDeleteConfirmJourney] = useState<JourneyCardData | null>(null);
  const [editingJourney, setEditingJourney] = useState<JourneyCardData | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [, startTransition] = useTransition();
  const suppressNavigateRef = useRef(false);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleJourneys = useMemo(
    () => journeys.filter((j) => matchQuery(j, normalizedQuery)),
    [journeys, normalizedQuery]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    suppressNavigateRef.current = true;
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    window.setTimeout(() => {
      suppressNavigateRef.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = journeys.findIndex((j) => j.id === active.id);
    const newIndex = journeys.findIndex((j) => j.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(journeys, oldIndex, newIndex);
    setJourneys(next);
    startTransition(() => {
      void reorderHomeJourneys(next.map((j) => j.id));
    });
  };

  const onDragCancel = () => {
    setActiveId(null);
    window.setTimeout(() => {
      suppressNavigateRef.current = false;
    }, 0);
  };

  const openEdit = (id: string) => {
    const journey = journeys.find((j) => j.id === id);
    if (!journey) return;
    suppressNavigateRef.current = true;
    setEditTitle(journey.title);
    setEditingJourney(journey);
    window.setTimeout(() => {
      suppressNavigateRef.current = false;
    }, 0);
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditingJourney(null);
  };

  const saveEdit = () => {
    if (!editingJourney) return;
    const title = editTitle.trim();
    if (!title) return;
    setEditSaving(true);
    const fd = new FormData();
    fd.set("title", title);
    startTransition(async () => {
      try {
        await updateJourneyMeta(editingJourney.id, fd);
        setJourneys((prev) =>
          prev.map((j) => (j.id === editingJourney.id ? { ...j, title } : j))
        );
        setEditingJourney(null);
      } finally {
        setEditSaving(false);
      }
    });
  };

  const openDeleteConfirm = (id: string) => {
    const journey = journeys.find((j) => j.id === id);
    if (!journey) return;
    suppressNavigateRef.current = true;
    setDeleteConfirmJourney(journey);
    window.setTimeout(() => {
      suppressNavigateRef.current = false;
    }, 0);
  };

  const closeDeleteConfirm = () => {
    if (deletingId) return;
    setDeleteConfirmJourney(null);
  };

  const confirmDeleteJourney = () => {
    if (!deleteConfirmJourney) return;
    const id = deleteConfirmJourney.id;
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteJourney(id);
        setJourneys((prev) => prev.filter((j) => j.id !== id));
        setDeleteConfirmJourney(null);
      } finally {
        setDeletingId(null);
      }
    });
  };

  const activeJourney = activeId ? journeys.find((j) => j.id === activeId) : undefined;

  /** @dnd-kit assigns aria-describedby ids that differ between SSR and client — enable only after mount. */
  const [dndMounted, setDndMounted] = useState(false);
  useEffect(() => setDndMounted(true), []);

  const canReorder = dndMounted && !normalizedQuery && journeys.length > 1;

  return (
    <div className="space-y-6">
      <BlurModal
        open={deleteConfirmJourney !== null}
        onClose={closeDeleteConfirm}
        title="Delete user journey?"
        size="md"
        dimBackdrop
      >
        {deleteConfirmJourney ? (
          <div className="space-y-4 p-1">
            <p className="text-sm text-muted">
              Delete <strong className="text-foreground">{deleteConfirmJourney.title}</strong>? This
              removes the user journey and its map data. This cannot be undone.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-container"
                onClick={closeDeleteConfirm}
                disabled={deletingId === deleteConfirmJourney.id}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === deleteConfirmJourney.id}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                onClick={confirmDeleteJourney}
              >
                {deletingId === deleteConfirmJourney.id ? "Deleting…" : "Delete journey"}
              </button>
            </div>
          </div>
        ) : null}
      </BlurModal>
      <BlurModal
        open={editingJourney !== null}
        onClose={closeEdit}
        title="Edit user journey"
      >
        {editingJourney ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
          >
            <div>
              <label htmlFor="journey-title" className="text-sm font-medium text-foreground block mb-1">
                Journey title
              </label>
              <input
                id="journey-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editSaving}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving || !editTitle.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : null}
      </BlurModal>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User journeys</h1>
          <p className="text-sm text-muted mt-1">
            Import FigJam and research, align on the map with your product owner, then turn the map
            into requirements in Discovery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">{newSessionForm}</div>
      </div>

      {journeys.length > 0 ? (
        <div className="space-y-1 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search user journeys by title…"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm"
              aria-label="Search user journeys by title"
            />
          </div>
          {canReorder ? (
            <p className="text-xs text-muted">Drag cards to reorder (search clears reordering).</p>
          ) : null}
        </div>
      ) : null}

      {journeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-muted mb-4">
            {emptyStateMessage ??
              "No user journeys yet. Start by importing workshop artifacts or create an empty journey."}
          </p>
          {showImportInEmpty ? (
            <Link href="/import" className="text-brand font-medium text-sm">
              Go to Import →
            </Link>
          ) : null}
        </div>
      ) : visibleJourneys.length === 0 ? (
        <p className="text-sm text-muted">No user journeys match your search.</p>
      ) : canReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[snapCenterToCursor]}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext items={journeys.map((j) => j.id)} strategy={rectSortingStrategy}>
            <ul className={HOME_JOURNEY_CARD_GRID}>
              {visibleJourneys.map((j) => (
                <SortableJourneyCard
                  key={j.id}
                  journey={j}
                  onDelete={openDeleteConfirm}
                  onEdit={openEdit}
                  deleting={deletingId === j.id}
                  suppressNavigateRef={suppressNavigateRef}
                  onOpen={() => router.push(`/journeys/${j.id}/map`)}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay zIndex={2000}>
            {activeJourney ? <JourneyCardShell journey={activeJourney} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <ul className={HOME_JOURNEY_CARD_GRID}>
          {visibleJourneys.map((j) => (
            <li key={j.id} className="list-none">
              <JourneyCardShell
                journey={j}
                onDelete={openDeleteConfirm}
                onEdit={openEdit}
                deleting={deletingId === j.id}
                onOpen={() => router.push(`/journeys/${j.id}/map`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}