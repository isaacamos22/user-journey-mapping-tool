"use client";

import { useState } from "react";
import { flashDiscoverySection } from "@/lib/discovery/discoverySectionNavFlash";
import { resolveDiscoveryScrollOffset } from "@/lib/discovery/discoveryScrollOffset";
import { waitScrollSettled } from "@/lib/discovery/waitScrollSettled";
import { cn } from "@/lib/utils";

export type DiscoveryTocItem = { id: string; label: string };

export function DiscoverySectionToc({
  items,
  className,
}: {
  items: DiscoveryTocItem[];
  className?: string;
}) {
  const [flashId, setFlashId] = useState<string | null>(null);

  const pulseToc = (id: string) => {
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 1200);
  };

  const jump = (id: string) => {
    pulseToc(id);

    const el = document.getElementById(`discovery-section-${id}`);
    if (!el) return;

    const afterScroll = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => flashDiscoverySection(id));
      });
    };

    const scrollRoot = el.closest(".discovery-workbench__viewer");
    if (scrollRoot instanceof HTMLElement) {
      const sheet = el.closest(".discovery-sheet");
      const header = scrollRoot.querySelector(".discovery-sheet-header");
      const scrollPad = resolveDiscoveryScrollOffset(sheet, header);
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      const targetTop = scrollRoot.scrollTop + (elTop - rootTop) - scrollPad;
      waitScrollSettled(scrollRoot, afterScroll);
      scrollRoot.scrollTo({
        top: targetTop,
        behavior: "smooth",
      });
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const fallbackRoot = el.closest(".discovery-workbench__viewer");
    if (fallbackRoot instanceof HTMLElement) {
      waitScrollSettled(fallbackRoot, afterScroll);
    } else {
      window.setTimeout(afterScroll, 650);
    }
  };

  return (
    <nav
      className={cn(
        "discovery-section-toc-panel m3-panel m3-panel-tonal flex flex-col gap-2 p-3 text-sm",
        className
      )}
      aria-label="On this page"
    >
      <h3 className="m3-eyebrow text-brand">On this page</h3>
      <ul className="discovery-section-toc__list space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={cn(
                "discovery-toc-item w-full rounded-md px-2 py-1.5 text-left text-xs leading-snug text-foreground hover:bg-brand/8 hover:text-brand",
                flashId === item.id && "discovery-toc-item--flash"
              )}
              onClick={() => jump(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}