const FADE_IN_MS = 260;
const HOLD_MS = 180;
const FADE_OUT_MS = 580;

/** Soft full-section highlight on in-page jump (TOC). */
export function flashDiscoverySection(id: string) {
  const section = document.getElementById(`discovery-section-${id}`);
  if (!section) return;

  section.querySelectorAll(".discovery-section-flash-overlay").forEach((n) => n.remove());

  const overlay = document.createElement("div");
  overlay.className = "discovery-section-flash-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.opacity = "0";
  section.insertBefore(overlay, section.firstChild);

  const clear = () => {
    overlay.remove();
  };

  const fadeIn = `opacity ${FADE_IN_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
  const fadeOut = `opacity ${FADE_OUT_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = fadeIn;
      overlay.style.opacity = "1";
    });
  });

  window.setTimeout(() => {
    overlay.style.transition = fadeOut;
    overlay.style.opacity = "0";
    overlay.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName === "opacity") clear();
      },
      { once: true }
    );
  }, FADE_IN_MS + HOLD_MS);

  window.setTimeout(clear, FADE_IN_MS + HOLD_MS + FADE_OUT_MS + 120);
}