import { getMessages } from "../../domain/messages.js";

export const BACKUP_REMIND_DAYS = 7;
export const AFFINITY_OPTIONS = ["최애", "기억남음", "불호지만강렬"];
export const REASON_TAG_OPTIONS = ["성장", "관계성", "대사", "연출", "디자인", "성우", "기타"];
export const SEASON_TERM_OPTIONS = ["Spring", "Summer", "Fall", "Winter"];

export const LIBRARY_STATUS = {
  unclassified: "미분류",
  watching: "보는중",
  hold: "보류",
  completed: "완료",
  dropped: "하차",
};

export const LIBRARY_EVENT = {
  start: "시작",
  complete: "완료",
  rewatch: "재시청",
  drop: "하차",
};

function getLibraryLabels(locale = "ko") {
  return getMessages(locale).libraryLabels || getMessages("ko").libraryLabels;
}

export function formatGenreLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return getLibraryLabels(locale).genre?.[raw] || raw;
}

export function formatAffinityLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  const labels = getLibraryLabels(locale).affinity || {};
  const fallback = getLibraryLabels("ko").affinity || {};
  return labels[raw] || fallback[raw] || raw || "인상 깊었음";
}

export function formatReasonTagLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  const labels = getLibraryLabels(locale).reasonTag || {};
  const fallback = getLibraryLabels("ko").reasonTag || {};
  return labels[raw] || fallback[raw] || raw;
}

export function formatStatusLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  const labels = getLibraryLabels(locale).status || {};
  const fallback = getLibraryLabels("ko").status || {};
  return labels[raw] || fallback[raw] || raw;
}

export function formatEventLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  const labels = getLibraryLabels(locale).event || {};
  const fallback = getLibraryLabels("ko").event || {};
  return labels[raw] || fallback[raw] || raw;
}

export function formatRelationTypeLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  const labels = getLibraryLabels(locale).relation || {};
  const fallback = getLibraryLabels("ko").relation || {};
  if (!raw) return labels.default || fallback.default;
  return labels[raw] || fallback[raw] || raw.replace(/_/g, " ").toLowerCase();
}

export function formatSeasonTermLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  return getLibraryLabels(locale).seasonTerm?.[raw] || raw;
}
