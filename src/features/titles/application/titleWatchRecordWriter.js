import { normalizeWatchStatus, titleWatchIdentity, validateTitleWatchRecord } from "../domain/titleWatchRecord.js";
import { withTitleStateMutation } from "./titleStateMutationLock.js";

const statusOf = item => normalizeWatchStatus(item?.status);
const scoreOf = item => item?.score == null || item.score === "" ? null : Number(item.score);
const countOf = item => Number(item?.rewatchCount) || 0;
const trackingOf = item => ({ watchStatus: statusOf(item), rating: scoreOf(item), rewatchCount: countOf(item),
  lastRewatchAt: item?.lastRewatchAt ?? null });
const sameTracking = (left, right) => Object.keys(right).every(key => left[key] === right[key]);
const resultFor = (album, log, item) => ({ log, tracking: { ...album.tracking, isSaved: true,
  ...trackingOf(item), lastRewatchAt: item.lastRewatchAt ?? null } });

function conflict(log = null, album = null, item = null) {
  const error = new Error("TITLE_TRACKING_CONFLICT");
  if (log) error.log = log;
  if (album && item) error.tracking = resultFor(album, log, item).tracking;
  return error;
}

// Persistence is injected so retry and partial-write boundaries can be exercised.
export function createTitleWatchRecordWriter({ readLibrary, writeLibrary, readWatchLogs, appendLog, createLog, dispatchLibraryUpdated,
  withMutation = withTitleStateMutation }) {
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
    const currentBefore = (await readLibrary([])).find(matches);
    if (!currentBefore) throw new Error("TITLE_NOT_SAVEABLE");
    const logs = await readWatchLogs(identity.anilistId, { catalogAnimeId: identity.catalogAnimeId });
    const existing = logs.find((row) => row.id === draft.operationId);
    if (previous && previous.signature !== signature) throw new Error("RECORD_RETRY_CHANGED");
    if (previous && !existing) throw new Error("RECORD_RESULT_UNKNOWN");
    if (existing && !previous) throw new Error("RECORD_RESULT_UNKNOWN");
    if (previous?.phase === "completed") return resultFor(album, existing || previous.log, currentBefore);

    const currentTracking = trackingOf(currentBefore);
    const baseline = album.tracking || {};
    const baselineFields = {
      watchStatus: Object.hasOwn(baseline, "watchStatus") ? normalizeWatchStatus(baseline.watchStatus) : undefined,
      rating: Object.hasOwn(baseline, "rating") ? baseline.rating == null || baseline.rating === "" ? null : Number(baseline.rating) : undefined,
      rewatchCount: Object.hasOwn(baseline, "rewatchCount") ? Number(baseline.rewatchCount) || 0 : undefined,
      lastRewatchAt: Object.hasOwn(baseline, "lastRewatchAt") ? baseline.lastRewatchAt ?? null : undefined,
    };
    let target;
    if (previous) {
      if (sameTracking(currentTracking, previous.target)) {
        previous.phase = "completed";
        return resultFor(album, existing || previous.log, currentBefore);
      }
      if (!sameTracking(currentTracking, previous.before)) throw conflict(existing || previous.log, album, currentBefore);
      target = previous.target;
    } else {
      target = { ...currentTracking };
      for (const key of ["watchStatus", "rating", "rewatchCount"]) {
        const edited = baselineFields[key] === undefined || draft[key] !== baselineFields[key];
        if (edited && baselineFields[key] !== undefined && currentTracking[key] !== baselineFields[key]) throw conflict();
        if (edited) target[key] = draft[key];
      }
      if (draft.eventType === "재시청") {
        if (baselineFields.lastRewatchAt !== undefined && currentTracking.lastRewatchAt !== baselineFields.lastRewatchAt) throw conflict();
        target.lastRewatchAt = draft.watchedAtPrecision === "day" ? draft.watchedAtValue : null;
      }
    }
    const logInput = { ...identity, eventType: draft.eventType, watchedAtPrecision: draft.watchedAtPrecision,
      watchedAtValue: draft.watchedAtValue, note: draft.note, scoreAtThatTime: target.rating };
    if (existing && Object.keys(logInput).some((key) => (existing[key] ?? null) !== (logInput[key] ?? null))) {
      throw new Error("RECORD_RETRY_CHANGED");
    }
    const log = existing || await appendLog({ ...createLog(logInput), id: draft.operationId }, { skipSyncMark: !identity.anilistId });
    if (!log) throw new Error("RECORD_NOT_SAVED");
    const operation = previous || { identityKey, signature, before: currentTracking, target, log, phase: "pending" };
    operations.set(draft.operationId, operation);
    try {
      const current = await readLibrary([]);
      let found = false;
      const next = current.map((item) => {
        if (!matches(item)) return item;
        found = true;
        if (!sameTracking(trackingOf(item), operation.before)) throw conflict(log, album, item);
        return { ...item, status: target.watchStatus, score: target.rating, rewatchCount: target.rewatchCount,
          lastRewatchAt: target.lastRewatchAt };
      });
      if (!found) throw new Error("TITLE_NOT_SAVEABLE");
      await writeLibrary(next);
      operation.phase = "completed";
      dispatchLibraryUpdated();
      return resultFor(album, log, next.find(matches));
    } catch (cause) {
      if (cause.message === "TITLE_TRACKING_CONFLICT") throw cause;
      const error = new Error("TITLE_TRACKING_PENDING", { cause });
      error.log = log;
      throw error;
    }
  };
  return (album, input) => {
    const result = queue.then(() => withMutation(() => save(album, input)));
    queue = result.catch(() => {});
    return result;
  };
}
