"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  applyJourneyCoachFocus,
  type JourneyCoachDetail,
  type JourneyCoachField,
  type JourneyCoachTab,
} from "@/lib/completeness/journeyCoach";

export function parseCoachFromUrl(searchParams: URLSearchParams): JourneyCoachDetail | null {
  const open = searchParams.get("coachOpen") === "1";
  if (!open) return null;
  const personas = searchParams.get("coachPersonas") === "1";
  const focus = searchParams.get("focus");
  const tab = searchParams.get("coachTab") as JourneyCoachTab | null;
  const field = searchParams.get("coachField") as JourneyCoachField | null;
  if (personas) return { personas: true, openEditor: true };
  if (!focus && !personas) return null;
  return {
    stepId: focus ?? undefined,
    tab: tab ?? undefined,
    field: field ?? undefined,
    openEditor: true,
  };
}

/** Applies Journey coach deep-links from the URL (scroll, highlight, open editor). */
export function WorkspaceStepFocus() {
  const searchParams = useSearchParams();
  const lastKey = useRef("");

  useEffect(() => {
    const detail = parseCoachFromUrl(searchParams);
    const key = searchParams.toString();
    if (!detail || key === lastKey.current) return;
    lastKey.current = key;

    const run = () => applyJourneyCoachFocus(detail);

    const t = window.setTimeout(run, 350);
    return () => window.clearTimeout(t);
  }, [searchParams]);

  return null;
}