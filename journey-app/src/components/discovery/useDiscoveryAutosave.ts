"use client";

import { useEffect, useRef } from "react";

export function useDiscoveryAutosave(
  save: () => void | Promise<void>,
  deps: unknown[],
  ms = 600,
  enabled = true
) {
  const saveRef = useRef(save);
  const readyRef = useRef(false);

  saveRef.current = save;

  useEffect(() => {
    if (!enabled) return;
    if (!readyRef.current) {
      readyRef.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      void saveRef.current();
    }, ms);
    return () => window.clearTimeout(t);
  }, deps);
}