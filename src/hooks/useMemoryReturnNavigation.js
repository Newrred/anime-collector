import { useEffect } from "react";
import { addMemoryReturn } from "../domain/search/memoryReturnNavigation.js";

export function useMemoryReturnNavigation(base) {
  useEffect(() => {
    const remember = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      link.href = addMemoryReturn(link.href, location.href, window.scrollY, base);
    };
    // Runs before the native document navigation adapter; dirty checks can cancel first.
    window.addEventListener("click", remember, true);
    const url = new URL(location.href);
    const rawY = url.searchParams.get("restoreY");
    const y = Number(rawY);
    let stopRestore = () => {};
    if (rawY !== null) {
      url.searchParams.delete("restoreY");
      history.replaceState(history.state, "", url);
      if (Number.isFinite(y) && y >= 0 && y <= 200000) {
        let stopped = false;
        let frame;
        const end = performance.now() + 3000;
        const restore = () => {
          if (stopped) return;
          window.scrollTo(0, y);
          if (Math.abs(window.scrollY - y) < 2 || performance.now() >= end) return;
          frame = requestAnimationFrame(restore);
        };
        stopRestore = () => { stopped = true; cancelAnimationFrame(frame); };
        frame = requestAnimationFrame(restore);
        window.addEventListener("wheel", stopRestore, { once: true });
        window.addEventListener("pointerdown", stopRestore, { once: true });
      }
    }
    return () => {
      window.removeEventListener("click", remember, true);
      window.removeEventListener("wheel", stopRestore);
      window.removeEventListener("pointerdown", stopRestore);
      stopRestore();
    };
  }, [base]);
}
