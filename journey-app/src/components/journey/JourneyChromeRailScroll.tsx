"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ThumbMetrics = { top: number; height: number; scrollable: boolean };

function measureThumb(el: HTMLDivElement): ThumbMetrics {
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight <= clientHeight + 2) {
    return { top: 0, height: 0, scrollable: false };
  }
  const thumbH = Math.max(28, (clientHeight / scrollHeight) * clientHeight);
  const maxTop = clientHeight - thumbH;
  const top =
    maxTop > 0 ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
  return { top, height: thumbH, scrollable: true };
}

export function JourneyChromeRailScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<ThumbMetrics>({
    top: 0,
    height: 0,
    scrollable: false,
  });
  const [thumbVisible, setThumbVisible] = useState(false);
  const hideTimerRef = useRef(0);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setThumb(measureThumb(el));
  }, []);

  const showThumbBriefly = useCallback(() => {
    setThumbVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setThumbVisible(false), 900);
  }, []);

  useEffect(() => {
    sync();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(hideTimerRef.current);
    };
  }, [sync]);

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-4"
      style={{ "--journey-rail-scrollbar-clip": "1.25rem" } as CSSProperties}
      onMouseEnter={() => thumb.scrollable && setThumbVisible(true)}
      onMouseLeave={() => setThumbVisible(false)}
    >
      <div className="journey-chrome-rail-scroll-clip min-h-0 flex-1">
        <div
          ref={scrollRef}
          className={cn(
            "journey-chrome-rail-scroll",
            "flex h-full max-h-full flex-col gap-3 overflow-x-hidden overflow-y-auto",
            "[scrollbar-width:none]",
            "[-ms-overflow-style:none]",
            "[&::-webkit-scrollbar]:!h-0 [&::-webkit-scrollbar]:!w-0"
          )}
          onScroll={() => {
            sync();
            showThumbBriefly();
          }}
        >
          {children}
        </div>
      </div>
      {thumb.scrollable ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-4 right-3 top-0 w-1 transition-opacity duration-200",
            thumbVisible ? "opacity-100" : "opacity-0"
          )}
          aria-hidden
        >
          <div
            className="w-full rounded-full bg-foreground/25"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
          />
        </div>
      ) : null}
    </div>
  );
}