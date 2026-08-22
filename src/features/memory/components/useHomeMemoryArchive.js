import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";

const initialState = Object.freeze({
  status: "loading",
  count: 0,
  latest: null,
});

export function useHomeMemoryArchive() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let active = true;

    getPlatformMemoryRuntime().then(async (runtime) => {
      const archive = (await runtime.listArchive()).filter(Boolean);
      const latestBundle = archive[0] || null;
      const previewDataUrl = latestBundle?.asset?.localRef
        ? await runtime.getPreview(latestBundle.asset.localRef).catch(() => null)
        : null;
      if (!active) return;
      setState({
        status: "ready",
        count: archive.length,
        latest: latestBundle ? { ...latestBundle, previewDataUrl } : null,
      });
    }).catch(() => {
      if (active) setState({ status: "error", count: 0, latest: null });
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
