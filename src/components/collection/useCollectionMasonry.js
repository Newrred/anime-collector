import { useEffect } from "react";

// DOM order stays unchanged: place the next record in the shortest column.
export function useCollectionMasonry(ref, revision) {
  useEffect(() => {
    const grid = ref.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    let frame = 0, disposed = false;
    const layout = () => {
      if (disposed || !grid.isConnected) return;
      const style = getComputedStyle(grid), columns = Math.max(1, parseInt(style.getPropertyValue("--channel-columns"), 10) || 4);
      const gap = parseFloat(style.getPropertyValue("--channel-gap")) || 18;
      const width = (grid.clientWidth - gap * (columns - 1)) / columns, bottoms = Array(columns).fill(0);
      for (const child of grid.children) {
        child.style.width = `${Math.max(0, width)}px`;
        const column = bottoms.indexOf(Math.min(...bottoms));
        child.style.position = "absolute"; child.style.left = `${column * (width + gap)}px`; child.style.top = `${bottoms[column]}px`;
        bottoms[column] += child.getBoundingClientRect().height + gap;
      }
      grid.style.height = `${Math.max(0, ...bottoms) - (grid.children.length ? gap : 0)}px`;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };
    const observer = new ResizeObserver(schedule); observer.observe(grid);
    for (const child of grid.children) observer.observe(child);
    grid.addEventListener("load", schedule, true); window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule); schedule();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); grid.removeEventListener("load", schedule, true); window.removeEventListener("resize", schedule); };
  }, [ref, revision]);
}
