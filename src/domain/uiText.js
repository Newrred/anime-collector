import { getMessages } from "./messages.js";

export function pickByLocale(locale, copy) {
  if (copy && typeof copy === "object" && locale in copy) return copy[locale];
  return copy?.ko;
}

export function formatRelativeAgo(ms, locale, fallback = null) {
  const copy = getMessages(locale).uiText.relativeAgo;
  if (!Number.isFinite(ms)) {
    if (fallback && typeof fallback === "object") {
      return pickByLocale(locale, fallback) || "";
    }
    return copy.noRecord;
  }

  const diff = Date.now() - ms;
  if (diff < 60 * 60 * 1000) return copy.withinHour;

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return copy.hoursAgo(hours);

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return copy.daysAgo(days);
}

export function formatBackupAgo(ms, locale) {
  const copy = getMessages(locale).uiText.backupAgo;
  if (!Number.isFinite(ms)) return copy.noBackupYet;

  const diff = Date.now() - ms;
  if (diff < 60 * 60 * 1000) return copy.withinHour;
  if (diff < 24 * 60 * 60 * 1000) return copy.hoursAgo(Math.floor(diff / (60 * 60 * 1000)));

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return copy.daysAgo(days);
}

export function formatStatusToggleLabel(persisted, locale) {
  const copy = getMessages(locale).uiText.statusToggle;
  if (persisted == null) return copy.checking;
  return persisted ? copy.on : copy.off;
}
