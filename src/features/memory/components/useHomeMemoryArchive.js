import { selectHomeRediscovery } from "../application/homeRediscovery.js";
import { loadMemoryVisual } from "../application/loadMemoryVisual.js";
import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";

import { useMemoryOwnerBoundary } from "../../../hooks/useMemoryOwnerBoundary.js";

const initialState = Object.freeze({
  status: "loading",
  count: 0,
  latest: null,
});

export function useHomeMemoryArchive() {
  const owner = useMemoryOwnerBoundary();
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!owner.ready) return;
    let active = true;

    getPlatformMemoryRuntime().then(async (runtime) => {
      const archive = (await runtime.listArchive()).filter(Boolean);
      const selections = selectHomeRediscovery(archive);
      const groups = Object.fromEntries(await Promise.all(Object.entries(selections).map(async ([key, bundles]) =>
        [key, await Promise.all(bundles.map(async (bundle) => ({ ...bundle, visual: await loadMemoryVisual(bundle, runtime) })))])));
      const latestBundle = selections.recent[0] || null;
      if (!active) return;
      setState({
        status: "ready",
        ownerKey: owner.ownerKey,
        count: archive.length,
        groups,
        latest: latestBundle,
      });
    }).catch(() => {
      if (active) setState({ status: "error", ownerKey: owner.ownerKey, count: 0, latest: null });
    });

    return () => {
      active = false;
    };
  }, [owner.ready, owner.ownerKey]);

  return owner.failed ? { ...initialState, status: "error" }
    : owner.ready && state.ownerKey === owner.ownerKey ? state : initialState;
}
