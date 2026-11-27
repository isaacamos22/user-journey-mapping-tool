"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const BASE_FONT_PX = 16;
const MIN_FONT_PX = 11;

/**
 * Fits single-line (or two-line at minimum size) titles inside the card header without scrolling.
 */
export function MarqueeLine({ text, className }: { text: string; className?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<{ fontSizePx: number; multiline: boolean }>({
    fontSizePx: BASE_FONT_PX,
    multiline: false,
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const run = () => {
      const maxWidth = viewport.clientWidth;
      if (maxWidth < 8) return;

      measure.style.fontSize = `${BASE_FONT_PX}px`;
      measure.style.whiteSpace = "nowrap";

      let fontPx = BASE_FONT_PX;
      while (fontPx > MIN_FONT_PX) {
        measure.style.fontSize = `${fontPx}px`;
        if (measure.offsetWidth <= maxWidth) {
          setFit({ fontSizePx: fontPx, multiline: false });
          return;
        }
        fontPx -= 0.5;
      }

      measure.style.fontSize = `${MIN_FONT_PX}px`;
      if (measure.offsetWidth <= maxWidth) {
        setFit({ fontSizePx: MIN_FONT_PX, multiline: false });
        return;
      }

      setFit({ fontSizePx: MIN_FONT_PX, multiline: true });
    };

    run();
    const ro = new ResizeObserver(run);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [text, className]);

  return (
    <div ref={viewportRef} className="relative min-w-0 w-full overflow-hidden">
      <span
        ref={measureRef}
        className={cn(className, "pointer-events-none invisible absolute left-0 top-0 max-w-none whitespace-nowrap")}
        aria-hidden
      >
        {text}
      </span>
      <p
        className={cn(
          className,
          fit.multiline ? "line-clamp-2 leading-snug break-words" : "truncate whitespace-nowrap"
        )}
        style={{
          fontSize: `${fit.fontSizePx}px`,
          lineHeight: fit.multiline ? 1.25 : undefined,
        }}
        title={text}
      >
        {text}
      </p>
    </div>
  );
}