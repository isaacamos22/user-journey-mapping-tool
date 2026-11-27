"use client";

import { useEffect } from "react";

export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.classList.add("workspace-scroll-locked");
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      html.classList.remove("workspace-scroll-locked");
    };
  }, [active]);
}