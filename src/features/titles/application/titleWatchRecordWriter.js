import { titleWatchIdentity, validateTitleWatchRecord } from "../domain/titleWatchRecord.js";

// Persistence is injected so retry and partial-write boundaries can be exercised.
export function createTitleWatchRecordWriter({ readLibrary, writeLibrary, readWatchLogs, appendLog, createLog, dispatchLibraryUpdated }) {
  let queue = Promise.resolve();
  const operations = new Map();
  const save = async (album, input) => {
    const draft = validateTitleWatchRecord(input);
    const identity = titleWatchIdentity(album);
    const signature = JSON.stringify({ identity, draft });
    const identityKey = JSON.stringify(identity);
    const previous = operations.get(draft.operationId);
    if (previous && previous.identityKey !== identityKey) throw new Error("RECORD_RETRY_CHANGED");
    const matches = (item) => (identity.catalogAnimeId && item.catalogAnimeId === identity.catalogAnimeId)
      || (identity.anilistId && Number(item.anilistId) === identity.anilistId);
    if (!(await readLibrary([])).some(matches)) throw new Error("TITLE_NOT_SAVEABLE");
    const logs = await readWatchLogs(identity.anilistId, { catalogAnimeId: identity.catalogAnimeId });
    const existing = logs.find((row) => row.id === draft.operationId);
    if (existing && previous && previous.signature !== signature) throw new Error("RECORD_RETRY_CHANGED");
    // Editing after a confirmed failed append is safe. A stored entry remains immutable on retry.
    operations.set(draft.operationId, { identityKey, signature });
    const logInput = { ...identity, eventType: draft.eventType, watchedAtPrecision: draft.watchedAtPrecision,
      watchedAtValue: draft.watchedAtValue, note: draft.note, scoreAtThatTime: draft.rating };
    if (existing && Object.keys(logInput).some((key) => (existing[key] ?? null) !== (logInput[key] ?? null))) {
      throw new Error("RECORD_RETRY_CHANGED");
    }
    const log = existing || await appendLog({ ...createLog(logInput), id: draft.operationId }, { skipSyncMark: !identity.anilistId });
    if (!log) throw new Error("RECORD_NOT_SAVED");
    try {
      const current = await readLibrary([]);
      let found = false;
      const next = current.map((item) => {
        if (!matches(item)) return item;
        found = true;
        return { ...item, status: draft.watchStatus, score: draft.rating, rewatchCount: draft.rewatchCount,
          lastRewatchAt: draft.eventType === "재시청"
            ? (draft.watchedAtPrecision === "day" ? draft.watchedAtValue : null) : item.lastRewatchAt ?? null };
      });
      if (!found) throw new Error("TITLE_NOT_SAVEABLE");
      await writeLibrary(next);
      dispatchLibraryUpdated();
      return { log, tracking: { ...album.tracking, isSaved: true, watchStatus: draft.watchStatus,
        rating: draft.rating, rewatchCount: draft.rewatchCount,
        lastRewatchAt: next.find(matches).lastRewatchAt } };
    } catch (cause) {
      const error = new Error("TITLE_TRACKING_PENDING", { cause });
      error.log = log;
      throw error;
    }
  };
  return (album, input) => {
    const result = queue.then(() => save(album, input));
    queue = result.catch(() => {});
    return result;
  };
}
