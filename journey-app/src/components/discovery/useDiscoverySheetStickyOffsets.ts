"use client";

import { useLayoutEffect, type RefObject } from "react";

function cssLengthPx(el: HTMLElement, varName: string, fallback: number) {
  const raw = getComputedStyle(el).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return fallback;
  if (raw.endsWith("rem")) {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return num * root;
  }
  return num;
}

/** Keeps TOC rail `top` aligned with the measured sticky header (avoids scroll jitter). */
export function useDiscoverySheetStickyOffsets(headerRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const sheet = header.closest(".discovery-sheet");
    if (!(sheet instanceof HTMLElement)) return;

    const apply = () => {
      const h = Math.ceil(header.offsetHeight);
      const gap = cssLengthPx(sheet, "--discovery-toc-sticky-gap", 10.4);
      const sectionPad = cssLengthPx(sheet, "--discovery-section-scroll-pad", 12);
      const scrollOff = h + gap + sectionPad;
      sheet.style.setProperty("--discovery-sheet-header-px", `${h}px`);
      sheet.style.setProperty("--discovery-rail-sticky-top", `${h}px`);
      sheet.style.setProperty("--discovery-scroll-offset-px", `${scrollOff}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    window.addEventListener("resize", apply, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [headerRef]);
}