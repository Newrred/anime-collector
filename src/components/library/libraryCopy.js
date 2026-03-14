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

const STATUS_LABELS = {
  ko: {
    [LIBRARY_STATUS.unclassified]: "미분류",
    [LIBRARY_STATUS.watching]: "보는중",
    [LIBRARY_STATUS.hold]: "보류",
    [LIBRARY_STATUS.completed]: "완료",
    [LIBRARY_STATUS.dropped]: "하차",
    전체: "전체",
  },
  en: {
    [LIBRARY_STATUS.unclassified]: "Unsorted",
    [LIBRARY_STATUS.watching]: "Watching",
    [LIBRARY_STATUS.hold]: "On Hold",
    [LIBRARY_STATUS.completed]: "Completed",
    [LIBRARY_STATUS.dropped]: "Dropped",
    전체: "All",
  },
};

const EVENT_LABELS = {
  ko: {
    [LIBRARY_EVENT.start]: "시작",
    [LIBRARY_EVENT.complete]: "완료",
    [LIBRARY_EVENT.rewatch]: "재시청",
    [LIBRARY_EVENT.drop]: "하차",
  },
  en: {
    [LIBRARY_EVENT.start]: "Started",
    [LIBRARY_EVENT.complete]: "Completed",
    [LIBRARY_EVENT.rewatch]: "Rewatch",
    [LIBRARY_EVENT.drop]: "Dropped",
  },
};

const RELATION_LABELS = {
  ko: {
    ADAPTATION: "원작 연계",
    PREQUEL: "전편",
    SEQUEL: "속편",
    PARENT: "본편",
    SIDE_STORY: "외전",
    CHARACTER: "캐릭터",
    SUMMARY: "총집편",
    ALTERNATIVE: "대체 설정",
    SPIN_OFF: "스핀오프",
    OTHER: "기타",
    SOURCE: "원작",
    COMPILATION: "편집본",
    CONTAINS: "포함",
    default: "연관",
  },
  en: {
    ADAPTATION: "Adaptation",
    PREQUEL: "Prequel",
    SEQUEL: "Sequel",
    PARENT: "Parent",
    SIDE_STORY: "Side Story",
    CHARACTER: "Character",
    SUMMARY: "Summary",
    ALTERNATIVE: "Alternative",
    SPIN_OFF: "Spin-off",
    OTHER: "Other",
    SOURCE: "Source",
    COMPILATION: "Compilation",
    CONTAINS: "Contains",
    default: "Related",
  },
};

const SEASON_TERM_LABELS = {
  ko: {
    Spring: "봄",
    Summer: "여름",
    Fall: "가을",
    Winter: "겨울",
  },
  en: {
    Spring: "Spring",
    Summer: "Summer",
    Fall: "Fall",
    Winter: "Winter",
  },
};

const GENRE_LABELS = {
  ko: {
    Action: "액션",
    Adventure: "어드벤처",
    Comedy: "코미디",
    Drama: "드라마",
    Ecchi: "에치",
    Fantasy: "판타지",
    Horror: "호러",
    "Mahou Shoujo": "마법소녀",
    Mecha: "메카",
    Music: "음악",
    Mystery: "미스터리",
    Psychological: "심리",
    Romance: "로맨스",
    "Sci-Fi": "SF",
    SciFi: "SF",
    "Slice of Life": "일상",
    Sports: "스포츠",
    Supernatural: "초자연",
    Thriller: "스릴러",
    Hentai: "헨타이",
  },
};

const AFFINITY_LABELS = {
  ko: {
    최애: "최애",
    기억남음: "인상 깊었음",
    불호지만강렬: "불호인데 강렬함",
  },
  en: {
    최애: "Favorite",
    기억남음: "Memorable",
    불호지만강렬: "Intense Dislike",
  },
};

const REASON_TAG_LABELS = {
  ko: {
    성장: "서사",
    관계성: "관계성",
    대사: "대사",
    연출: "연출",
    디자인: "비주얼",
    성우: "성우연기",
    기타: "기타",
  },
  en: {
    성장: "Story",
    관계성: "Relationship",
    대사: "Dialogue",
    연출: "Direction",
    디자인: "Visual",
    성우: "Voice Acting",
    기타: "Other",
  },
};

export function formatGenreLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return GENRE_LABELS[locale]?.[raw] || raw;
}

export function formatAffinityLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  return AFFINITY_LABELS[locale]?.[raw] || AFFINITY_LABELS.ko[raw] || raw || "인상 깊었음";
}

export function formatReasonTagLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  return REASON_TAG_LABELS[locale]?.[raw] || REASON_TAG_LABELS.ko[raw] || raw;
}

export function formatStatusLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  return STATUS_LABELS[locale]?.[raw] || STATUS_LABELS.ko[raw] || raw;
}

export function formatEventLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  return EVENT_LABELS[locale]?.[raw] || EVENT_LABELS.ko[raw] || raw;
}

export function formatRelationTypeLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  if (!raw) return RELATION_LABELS[locale]?.default || RELATION_LABELS.ko.default;
  return RELATION_LABELS[locale]?.[raw] || RELATION_LABELS.ko[raw] || raw.replace(/_/g, " ").toLowerCase();
}

export function formatSeasonTermLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  return SEASON_TERM_LABELS[locale]?.[raw] || raw;
}
