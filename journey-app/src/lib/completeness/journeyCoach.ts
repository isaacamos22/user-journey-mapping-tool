export type JourneyCoachTab = "details" | "pains" | "feelings";

export type JourneyCoachField = "title" | "userAction" | "touchpoint" | "pain";

export type JourneyCoachFocus = {
  stepId?: string;
  tab?: JourneyCoachTab;
  field?: JourneyCoachField;
  personas?: boolean;
};

export const JOURNEY_COACH_EVENT = "journey:coach-focus";

export type JourneyCoachDetail = JourneyCoachFocus & { openEditor?: boolean };

export function dispatchJourneyCoach(detail: JourneyCoachDetail) {
  window.dispatchEvent(new CustomEvent(JOURNEY_COACH_EVENT, { detail }));
}

function coachEditorRoot(stepId: string): ParentNode {
  return (
    document.querySelector(`[data-journey-coach-modal="${CSS.escape(stepId)}"]`) ??
    document.querySelector(`[data-journey-step-id="${CSS.escape(stepId)}"]`) ??
    document
  );
}

export const JOURNEY_COACH_PAN_EVENT = "journey:coach-pan-to-step";

export function panCoachStepIntoView(stepId: string) {
  window.dispatchEvent(new CustomEvent(JOURNEY_COACH_PAN_EVENT, { detail: { stepId } }));
}

const COACH_HIGHLIGHT_CLASS = [
  "ring-2",
  "ring-brand",
  "shadow-[0_0_0_3px_rgba(0,20,220,0.25)]",
] as const;

export function highlightCoachStep(stepId: string, ms = 4000) {
  const el = document.querySelector(`[data-journey-step-id="${CSS.escape(stepId)}"]`);
  if (!el) return;
  el.classList.add(...COACH_HIGHLIGHT_CLASS);
  window.setTimeout(() => el.classList.remove(...COACH_HIGHLIGHT_CLASS), ms);
}

export function applyJourneyCoachFocus(detail: JourneyCoachDetail) {
  if (detail.personas) {
    document.getElementById("journey-personas")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.dispatchEvent(new CustomEvent("journey:coach-personas"));
    return;
  }

  if (!detail.stepId) return;

  panCoachStepIntoView(detail.stepId);
  window.setTimeout(() => {
    highlightCoachStep(detail.stepId!);
    if (detail.openEditor !== false) {
      dispatchJourneyCoach(detail);
    }
  }, 120);
}

export function focusCoachField(stepId: string, field: JourneyCoachField, isAction: boolean) {
  const tryFocus = () => {
    const root = coachEditorRoot(stepId);
    if (field === "title" || field === "userAction") {
      const actionEl = document.getElementById(`action-title-${stepId}`);
      const stepEl = document.getElementById(`step-title-${stepId}`);
      const el =
        field === "userAction" && (isAction || actionEl)
          ? actionEl ?? stepEl
          : isAction
            ? actionEl ?? stepEl
            : stepEl ?? actionEl;
      el?.focus();
      return Boolean(el);
    }
    if (field === "touchpoint") {
      const el = root.querySelector<HTMLElement>('[data-journey-coach-field="touchpoint"]');
      el?.focus();
      return Boolean(el);
    }
    if (field === "pain") {
      const el = root.querySelector<HTMLElement>('[data-journey-coach-field="pain"]');
      el?.focus();
      return Boolean(el);
    }
    return false;
  };
  let attempts = 0;
  const tick = () => {
    if (tryFocus() || attempts > 12) return;
    attempts += 1;
    window.setTimeout(tick, 120);
  };
  tick();
}