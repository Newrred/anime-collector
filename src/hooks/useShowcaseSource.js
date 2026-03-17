import { useEffect, useMemo, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import { readLibraryListPreferred } from "../repositories/libraryRepo";
import { readAllWatchLogsSnapshot } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred } from "../repositories/characterPinRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";
import { pickDisplayTitle } from "../domain/animeTitles";

export function useShowcaseSource(locale = "ko") {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pins, setPins] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      await ensureLegacyStorageMigrated().catch(() => {});

      const list = await readLibraryListPreferred(myListSeed).catch(() => myListSeed);
      const safeList = Array.isArray(list) ? list : [];
      const ids = safeList.map((x) => Number(x?.anilistId)).filter(Number.isFinite);

      if (!alive) return;
      setItems(safeList);
      setLogs(readAllWatchLogsSnapshot());

      const pinRows = await listCharacterPinsPreferred().catch(() => []);
      if (!alive) return;
      setPins(Array.isArray(pinRows) ? pinRows : []);

      setMediaMap(getCachedAnimeMap(ids));

      const fetched = await fetchAnimeByIdsCached(ids, { includeCharacters: false }).catch(() => new Map());
      if (!alive) return;
      setMediaMap(fetched);
      setLoading(false);
    }

    load().catch(() => {
      if (!alive) return;
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const titleById = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const id = Number(item?.anilistId);
      if (!Number.isFinite(id)) continue;
      map.set(id, pickDisplayTitle(item, mediaMap.get(id), locale));
    }
    return map;
  }, [items, mediaMap, locale]);

  return {
    items,
    logs,
    pins,
    mediaMap,
    titleById,
    loading,
  };
}
