import { useEffect, useMemo, useState } from "react";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist.js";
import { readTitleLibrary } from "../repositories/titleLibraryRepo.js";
import { listRecentWatchLogs } from "../repositories/watchLogRepo.js";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration.js";

function uniqueIds(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .flatMap((value) => {
          const id = Number(value);
          return Number.isSafeInteger(id) && id > 0 ? [id] : [];
        })
    )
  );
}

export function useGlobalQuickActionSource() {
  const [items, setItems] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());

  useEffect(() => {
    let alive = true;

    async function loadSnapshot() {
      await ensureLegacyStorageMigrated().catch(() => {});
      const [preferred, logs] = await Promise.all([
        readTitleLibrary([]).catch(() => []),
        listRecentWatchLogs(20).catch(() => []),
      ]);
      if (!alive) return;
      setItems(Array.isArray(preferred) ? preferred : []);
      setRecentLogs(Array.isArray(logs) ? logs : []);
    }

    loadSnapshot().catch(() => {});

    function refresh() {
      loadSnapshot().catch(() => {});
    }

    window.addEventListener("storage", refresh);
    window.addEventListener("moemoa:library-updated", refresh);
    window.addEventListener("moemoa:watch-log-updated", refresh);

    return () => {
      alive = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("moemoa:library-updated", refresh);
      window.removeEventListener("moemoa:watch-log-updated", refresh);
    };
  }, []);

  const ids = useMemo(
    () =>
      uniqueIds([
        ...items.map((item) => item?.anilistId),
        ...recentLogs.map((log) => log?.anilistId),
      ]),
    [items, recentLogs]
  );

  useEffect(() => {
    if (!ids.length) {
      setMediaMap(new Map());
      return;
    }

    setMediaMap(getCachedAnimeMap(ids));

    let alive = true;
    (async () => {
      const fetched = await fetchAnimeByIdsCached(ids, { includeCharacters: false });
      if (alive && fetched instanceof Map) setMediaMap(fetched);
    })().catch(() => {});

    return () => {
      alive = false;
    };
  }, [ids.join(",")]);

  return { items, recentLogs, mediaMap };
}
