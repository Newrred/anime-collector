export function pickByLocale(locale, copy) {
  if (copy && typeof copy === "object" && locale in copy) return copy[locale];
  return copy?.ko;
}

export function formatRelativeAgo(ms, locale, fallback = null) {
  if (!Number.isFinite(ms)) {
    if (fallback && typeof fallback === "object") {
      return pickByLocale(locale, fallback) || "";
    }
    return locale === "en" ? "No record" : "기록 없음";
  }

  const diff = Date.now() - ms;
  if (diff < 60 * 60 * 1000) {
    return locale === "en" ? "Within 1 hour" : "1시간 이내";
  }

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) {
    return locale === "en" ? `${hours}h ago` : `${hours}시간 전`;
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return locale === "en" ? `${days}d ago` : `${days}일 전`;
}

export function formatBackupAgo(ms, locale) {
  if (!Number.isFinite(ms)) return locale === "en" ? "No backup yet" : "백업 기록 없음";

  const diff = Date.now() - ms;
  if (diff < 60 * 60 * 1000) return locale === "en" ? "Backed up within 1 hour" : "1시간 이내 백업";
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return locale === "en" ? `Backed up ${hours}h ago` : `${hours}시간 전 백업`;
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return locale === "en" ? `Backed up ${days}d ago` : `${days}일 전 백업`;
}

export function formatStatusToggleLabel(persisted, locale) {
  if (persisted == null) return locale === "en" ? "Checking" : "확인 중";
  return persisted ? (locale === "en" ? "On" : "활성") : (locale === "en" ? "Off" : "비활성");
}
