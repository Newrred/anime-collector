import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../features/memory/runtime/platformMemoryRuntime.js";
import { buildMemorySearchRows } from "../features/titles/application/titleSearchProjection.js";

export function useSearchMemories(open, accountScope) {
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    setSnapshot(null);
    if (!open) return undefined;
    async function refresh() {
      const request = ++revision;
      setSnapshot(null);
      try {
        const runtime = await getPlatformMemoryRuntime();
        const owner = await runtime.initialize();
        const archive = await runtime.listArchive();
        const current = await runtime.initialize();
        if (active && request === revision && owner.id === current.id) {
          setSnapshot({ scope: accountScope, rows: buildMemorySearchRows(archive) });
        }
      } catch {
        // Search remains available while the private archive is unavailable.
      }
    }
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [open, accountScope]);
  return open && snapshot?.scope === accountScope ? snapshot.rows : null;
}
