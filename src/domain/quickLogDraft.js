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
