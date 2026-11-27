/** Run callback after scroll container stops moving (smooth TOC jumps). */
export function waitScrollSettled(
  root: HTMLElement,
  cb: () => void,
  maxWaitMs = 2800,
  idleMs = 140
) {
  let done = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let sawScroll = false;

  const finish = () => {
    if (done) return;
    done = true;
    root.removeEventListener("scroll", onScroll);
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(noScrollTimer);
    clearTimeout(maxTimer);
    cb();
  };

  const onScroll = () => {
    sawScroll = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(finish, idleMs);
  };

  const maxTimer = window.setTimeout(finish, maxWaitMs);
  const noScrollTimer = window.setTimeout(() => {
    if (!sawScroll) finish();
  }, 220);

  root.addEventListener("scroll", onScroll, { passive: true });
}