import { arrayMove } from "@dnd-kit/sortable";

export function reorderWithSelection<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
  selectedIds: ReadonlySet<string>
): T[] | null {
  const oldIndex = items.findIndex((s) => s.id === activeId);
  const newIndex = items.findIndex((s) => s.id === overId);
  if (oldIndex < 0 || newIndex < 0) return null;

  const multi =
    selectedIds.size > 1 && selectedIds.has(activeId) && items.some((s) => selectedIds.has(s.id));
  if (!multi) return arrayMove(items, oldIndex, newIndex);

  const moving = items.filter((s) => selectedIds.has(s.id));
  const stationary = items.filter((s) => !selectedIds.has(s.id));

  let insertAt = stationary.findIndex((s) => s.id === overId);
  if (insertAt === -1) {
    insertAt = stationary.length;
  } else if (oldIndex > newIndex) {
    insertAt = stationary.findIndex((s) => s.id === overId);
  } else {
    insertAt = stationary.findIndex((s) => s.id === overId) + 1;
  }

  return [...stationary.slice(0, insertAt), ...moving, ...stationary.slice(insertAt)];
}