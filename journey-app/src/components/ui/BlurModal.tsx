"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ExpandOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type BlurModalSize = "md" | "lg" | "xl" | "2xl";

type BlurModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: BlurModalSize;
  dimBackdrop?: boolean;
  expandFrom?: ExpandOrigin | null;
  /** Re-measure card before close animation (step editor) */
  getExpandOrigin?: () => ExpandOrigin | null;
  /** Fixed viewport-sized shell; body does not scroll (scroll inside children) */
  fixedShell?: boolean;
};

const IOS_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION_MS = 420;
const WIDTH_TRANSITION_MS = 360;

/** Target width cap per size (px); applied as min(96vw, cap) */
const SIZE_WIDTH_CAP_PX: Record<BlurModalSize, number> = {
  md: 512,
  lg: 672,
  xl: 768,
  "2xl": 1088,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function widthCapPx(size: BlurModalSize): number {
  if (typeof window === "undefined") return SIZE_WIDTH_CAP_PX[size];
  return Math.min(window.innerWidth * 0.96, SIZE_WIDTH_CAP_PX[size]);
}

export function BlurModal({
  open,
  onClose,
  title,
  children,
  size = "md",
  dimBackdrop = true,
  expandFrom = null,
  getExpandOrigin,
  fixedShell = false,
}: BlurModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const originRef = useRef(expandFrom);
  const [present, setPresent] = useState(open);
  const [backdropOpacity, setBackdropOpacity] = useState(dimBackdrop ? 1 : 0);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [shellWidthPx, setShellWidthPx] = useState(() => widthCapPx(size));
  const closingRef = useRef(false);
  const flipActiveRef = useRef(false);

  useEffect(() => {
    if (expandFrom) originRef.current = expandFrom;
  }, [expandFrom]);

  useLayoutEffect(() => {
    if (!present || closingRef.current || flipActiveRef.current) return;
    const next = widthCapPx(size);
    setShellWidthPx(next);
  }, [size, present]);

  useEffect(() => {
    const onResize = () => {
      if (closingRef.current || flipActiveRef.current) return;
      setShellWidthPx(widthCapPx(size));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size]);

  const animateClose = useCallback(
    (then?: () => void) => {
      const panel = panelRef.current;
      const origin = originRef.current;
      const reduced = prefersReducedMotion();

      if (!panel || !origin || reduced) {
        setPanelStyle({});
        setPresent(false);
        then?.();
        return;
      }

      flipActiveRef.current = true;
      const end = panel.getBoundingClientRect();
      const dx = origin.left - end.left;
      const dy = origin.top - end.top;
      const sx = origin.width / Math.max(end.width, 1);
      const sy = origin.height / Math.max(end.height, 1);

      setPanelStyle({
        transformOrigin: "top left",
        transform: "translate(0, 0) scale(1, 1)",
        borderRadius: 16,
        transition: "none",
        opacity: 1,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPanelStyle({
            transformOrigin: "top left",
            transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
            borderRadius: 12,
            transition: `transform ${DURATION_MS}ms ${IOS_EASE}, border-radius ${DURATION_MS}ms ${IOS_EASE}, opacity ${DURATION_MS * 0.7}ms ease-out`,
            opacity: 0,
          });
          setBackdropOpacity(0);
        });
      });

      window.setTimeout(() => {
        setPanelStyle({});
        setPresent(false);
        closingRef.current = false;
        flipActiveRef.current = false;
        then?.();
      }, DURATION_MS);
    },
    []
  );

  const beginClose = useCallback(
    (then?: () => void) => {
      const fresh = getExpandOrigin?.();
      if (fresh) originRef.current = fresh;
      animateClose(then);
    },
    [animateClose, getExpandOrigin]
  );

  const requestClose = useCallback(() => {
    if (closingRef.current || !present) return;
    closingRef.current = true;
    beginClose(onClose);
  }, [beginClose, onClose, present]);

  useEffect(() => {
    if (open) {
      setPresent(true);
      closingRef.current = false;
      setShellWidthPx(widthCapPx(size));
      return;
    }
    if (!present || closingRef.current) return;
    closingRef.current = true;
    beginClose();
  }, [open, present, beginClose, size]);

  useLayoutEffect(() => {
    if (!present || !open || closingRef.current) return;

    const panel = panelRef.current;
    const origin = originRef.current;
    const reduced = prefersReducedMotion();

    if (!panel || !origin || reduced) {
      setPanelStyle({});
      setBackdropOpacity(dimBackdrop ? 1 : 0);
      flipActiveRef.current = false;
      return;
    }

    flipActiveRef.current = true;
    const end = panel.getBoundingClientRect();
    const dx = origin.left - end.left;
    const dy = origin.top - end.top;
    const sx = origin.width / Math.max(end.width, 1);
    const sy = origin.height / Math.max(end.height, 1);

    setPanelStyle({
      transformOrigin: "top left",
      transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      borderRadius: 12,
      transition: "none",
      opacity: 1,
    });
    setBackdropOpacity(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPanelStyle({
          transformOrigin: "top left",
          transform: "translate(0, 0) scale(1, 1)",
          borderRadius: 16,
          opacity: 1,
          transition: `transform ${DURATION_MS}ms ${IOS_EASE}, border-radius ${DURATION_MS}ms ${IOS_EASE}, box-shadow ${DURATION_MS}ms ${IOS_EASE}, opacity 0.2s ease-out`,
        });
        if (dimBackdrop) setBackdropOpacity(1);
        window.setTimeout(() => {
          flipActiveRef.current = false;
        }, DURATION_MS);
      });
    });
  }, [present, open, dimBackdrop]);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [present, requestClose]);

  if (!present || typeof document === "undefined") return null;

  const useOrigin = Boolean(originRef.current) && !prefersReducedMotion();
  const shellStyle: CSSProperties = {
    width: shellWidthPx,
    maxWidth: "96vw",
    ...(useOrigin ? panelStyle : {}),
  };
  const widthTransition = !prefersReducedMotion()
    ? `width ${WIDTH_TRANSITION_MS}ms ${IOS_EASE}`
    : "";
  if (widthTransition) {
    shellStyle.transition = shellStyle.transition
      ? `${shellStyle.transition}, ${widthTransition}`
      : widthTransition;
  }

  const closeIfOutside = (target: EventTarget | null) => {
    const panel = panelRef.current;
    if (!panel || !target || !(target instanceof Node)) return;
    if (panel.contains(target)) return;
    requestClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6"
      onPointerDown={(e) => closeIfOutside(e.target)}
    >
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${dimBackdrop ? "bg-black/40 backdrop-blur-sm" : ""}`}
        style={dimBackdrop ? { opacity: backdropOpacity } : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={shellStyle}
        className={`relative z-10 flex shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.2)] will-change-transform ${
          fixedShell ? "h-[min(78vh,680px)]" : "max-h-[min(90vh,820px)]"
        } ${!useOrigin ? "animate-[modal-fade-scale_0.38s_cubic-bezier(0.32,0.72,0,1)_both]" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          data-blur-modal-header
          className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur-sm"
        >
          <h2 id={titleId} className="font-semibold text-foreground">
            {title}
          </h2>
          <button type="button" onClick={requestClose} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-container hover:text-foreground">
            Close
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 p-5 ${fixedShell ? "overflow-hidden" : "overlay-scrollbar overflow-y-auto"}`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}