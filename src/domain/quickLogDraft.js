function baseDraft(log, mode) {
  return {
    mode,
    logId: mode === "edit" ? String(log?.id || "") : null,
    anilistId: Number(log?.anilistId),
    eventType: String(log?.eventType || "시작"),
    watchedAtPrecision: String(log?.watchedAtPrecision || "day"),
    watchedAtValue: String(log?.watchedAtValue || ""),
    cue: String(log?.cue || "").slice(0, 120),
    note: String(log?.note || ""),
  };
}

export const createNewQuickLogDraft = (input) => baseDraft(input, "create");
export const createEditQuickLogDraft = (log) => baseDraft(log, "edit");
export const isNewQuickLogDraft = (draft) => draft?.mode === "create" && !draft?.logId;


export function quickLogFingerprint(draft, ids = [], primary = null, metadata = {}) {
  if (!draft) return "";
  return JSON.stringify({
    fields: [draft.mode, draft.logId, draft.anilistId, draft.eventType, draft.watchedAtPrecision,
      draft.watchedAtValue, draft.cue || "", draft.note || ""],
    primary,
    characters: ids.map((id) => ({ id, affinity: metadata[id]?.affinity || "기억남음",
      tags: [...(metadata[id]?.reasonTags || [])].sort(), note: metadata[id]?.note || "" })),
  });
}
