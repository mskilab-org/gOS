import { useEffect } from "react";

// Report data and lazy panels arrive after navigation. Keep the requested panel
// in view while layout settles, relinquishing control as soon as the user scrolls.
export default function VisualElementNavigation({ caseId, tab }) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id.startsWith("visual-")) return;
    let frame;
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target =
          document.getElementById(id) ||
          (id.startsWith("visual-metadata-")
            ? document.getElementById("visual-metadata")
            : null);
        if (target?.getClientRects().length)
          target.scrollIntoView({ block: "start" });
      });
    };
    const changes = new MutationObserver(scroll);
    changes.observe(document.body, { childList: true, subtree: true });
    const sizes =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scroll);
    sizes?.observe(document.body);
    const stop = () => {
      changes.disconnect();
      sizes?.disconnect();
      cancelAnimationFrame(frame);
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown"];
    events.forEach((event) =>
      window.addEventListener(event, stop, { passive: true }),
    );
    const timeout = setTimeout(stop, 15000);
    scroll();
    return () => {
      stop();
      clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, stop));
    };
  }, [caseId, tab]);
  return null;
}
