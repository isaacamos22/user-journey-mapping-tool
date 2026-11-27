import type { FlowStep } from "@/components/journey/JourneyStepFlow";
import { reorderWithSelection } from "@/lib/journey/reorderWithSelection";

export function sortedChildren(step: FlowStep): FlowStep[] {
  return [...(step.children ?? [])].sort((a, b) => a.order - b.order);
}

export function isRootStepId(roots: FlowStep[], id: string) {
  return roots.some((s) => s.id === id);
}

export function findActionInRoots(
  roots: FlowStep[],
  actionId: string
): { step: FlowStep; parentIndex: number; subIndex: number } | null {
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i]!;
    const children = sortedChildren(root);
    for (let j = 0; j < children.length; j++) {
      if (children[j]!.id === actionId) {
        return { step: children[j]!, parentIndex: i + 1, subIndex: j + 1 };
      }
    }
  }
  return null;
}

export function findChildParentId(roots: FlowStep[], childId: string): string | null {
  for (const root of roots) {
    if ((root.children ?? []).some((c) => c.id === childId)) return root.id;
  }
  return null;
}

export function collectMovingChildIds(
  roots: FlowStep[],
  activeId: string,
  selectedIds: ReadonlySet<string>
): string[] {
  const childIds = new Set<string>();
  const addIfChild = (id: string) => {
    if (findChildParentId(roots, id)) childIds.add(id);
  };
  addIfChild(activeId);
  for (const id of selectedIds) addIfChild(id);
  const ordered: string[] = [];
  for (const root of roots) {
    for (const child of sortedChildren(root)) {
      if (childIds.has(child.id)) ordered.push(child.id);
    }
  }
  return ordered;
}

function isDraggingHit(el: HTMLElement): boolean {
  return Boolean(el.closest('[data-journey-dragging="true"]'));
}

export function resolveDropIdFromPoint(
  clientX: number,
  clientY: number,
  excludeStepId?: string | null
): string | null {
  if (typeof document === "undefined") return null;
  const stack = document.elementsFromPoint(clientX, clientY);

  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (isDraggingHit(el)) continue;

    const actionWrap = el.closest('[data-journey-sortable="action"]');
    if (actionWrap && !actionWrap.hasAttribute("data-journey-dragging")) {
      const stepId = actionWrap
        .querySelector<HTMLElement>("[data-journey-step-id]")
        ?.getAttribute("data-journey-step-id");
      if (stepId && stepId !== excludeStepId) return stepId;
    }
  }

  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (isDraggingHit(el)) continue;

    const onRoot = el.closest("[data-journey-root-drag]");
    if (onRoot) {
      const stepId = onRoot
        .querySelector<HTMLElement>("[data-journey-step-id]")
        ?.getAttribute("data-journey-step-id");
      if (stepId) return `reparent-${stepId}`;
    }
  }

  return null;
}

/** Pick drop target when pointer hits are blocked (e.g. DragOverlay) or ambiguous. */
export function resolveCommittedActionDrop(
  roots: FlowStep[],
  activeId: string,
  overId: string | null,
  pointer: { x: number; y: number }
): string | null {
  const fromParent = findChildParentId(roots, activeId);
  const candidates = new Set<string>();
  if (overId && overId !== activeId) candidates.add(overId);
  const hitOver = resolveDropIdFromPoint(pointer.x, pointer.y, activeId);
  if (hitOver && hitOver !== activeId) candidates.add(hitOver);

  const scored = [...candidates]
    .map((id) => {
      const target = resolveActionDropTarget(roots, id);
      if (!target) return null;
      const isReparent = id.startsWith("reparent-");
      const isAction = Boolean(findChildParentId(roots, id));
      return {
        id,
        crossParent: target.parentId !== fromParent,
        isReparent,
        isAction,
        target,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => {
      if (a.isAction !== b.isAction) return a.isAction ? -1 : 1;
      if (a.crossParent !== b.crossParent) return a.crossParent ? -1 : 1;
      if (a.isReparent !== b.isReparent) return a.isReparent ? -1 : 1;
      return 0;
    });

  return scored[0]?.id ?? null;
}

export function resolveActionDropTarget(
  roots: FlowStep[],
  overId: string
): { parentId: string; beforeChildId: string | null } | null {
  if (overId.startsWith("reparent-")) {
    const parentId = overId.slice("reparent-".length);
    if (!roots.some((s) => s.id === parentId)) return null;
    return { parentId, beforeChildId: null };
  }
  if (overId.startsWith("column-")) {
    const parentId = overId.slice("column-".length);
    if (!roots.some((s) => s.id === parentId)) return null;
    return { parentId, beforeChildId: null };
  }
  if (isRootStepId(roots, overId)) {
    return { parentId: overId, beforeChildId: null };
  }
  const parentId = findChildParentId(roots, overId);
  if (parentId) return { parentId, beforeChildId: overId };
  return null;
}

export function applyChildReparent(
  roots: FlowStep[],
  movingIds: string[],
  targetParentId: string,
  beforeChildId: string | null
): FlowStep[] | null {
  if (movingIds.length === 0) return null;
  if (!roots.some((s) => s.id === targetParentId)) return null;

  const moving = new Set(movingIds);
  const detached: FlowStep[] = [];

  const without = roots.map((root) => {
    const nextChildren = sortedChildren(root).filter((c) => {
      if (moving.has(c.id)) {
        detached.push({ ...c, parentStepId: targetParentId });
        return false;
      }
      return true;
    });
    return { ...root, children: nextChildren };
  });

  if (detached.length === 0) return null;

  return without.map((root) => {
    if (root.id !== targetParentId) return root;
    let children = sortedChildren(root);
    let insertAt = beforeChildId ? children.findIndex((c) => c.id === beforeChildId) : children.length;
    if (insertAt < 0) insertAt = children.length;
    children = [...children.slice(0, insertAt), ...detached, ...children.slice(insertAt)];
    children = children.map((c, i) => ({ ...c, order: i }));
    return { ...root, children };
  });
}

export function applyChildReorderInParent(
  roots: FlowStep[],
  parentId: string,
  activeId: string,
  overId: string,
  selectedIds: ReadonlySet<string>
): FlowStep[] | null {
  let changed = false;
  const out = roots.map((root) => {
    if (root.id !== parentId) return root;
    const children = sortedChildren(root);
    const next = reorderWithSelection(children, activeId, overId, selectedIds);
    if (!next) return root;
    changed = true;
    return {
      ...root,
      children: next.map((c, i) => ({ ...c, order: i })),
    };
  });
  return changed ? out : null;
}