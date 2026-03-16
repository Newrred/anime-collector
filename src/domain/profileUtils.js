export const PROFILE_HANDLE_MIN = 3;
export const PROFILE_HANDLE_MAX = 24;
export const PROFILE_BIO_MAX = 160;
export const PROFILE_NAME_MAX = 32;

function toAsciiSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimToLength(value, max) {
  return String(value || "").trim().slice(0, max);
}

export function normalizeProfileHandle(value, fallback = "") {
  const raw = toAsciiSlug(value);
  const clamped = raw.slice(0, PROFILE_HANDLE_MAX).replace(/^-+|-+$/g, "");
  if (clamped.length >= PROFILE_HANDLE_MIN) return clamped;
  return trimToLength(fallback, PROFILE_HANDLE_MAX).toLowerCase();
}

export function isValidProfileHandle(value) {
  const handle = String(value || "").trim().toLowerCase();
  return new RegExp(`^[a-z0-9](?:[a-z0-9-]{${PROFILE_HANDLE_MIN - 2},${PROFILE_HANDLE_MAX - 2}}[a-z0-9])$`).test(handle);
}

export function normalizeProfileDisplayName(value, fallback = "") {
  const name = trimToLength(value, PROFILE_NAME_MAX);
  return name || trimToLength(fallback, PROFILE_NAME_MAX) || "Anime Fan";
}

export function normalizeProfileBio(value) {
  return trimToLength(value, PROFILE_BIO_MAX);
}

export function suggestProfileHandle(userLike) {
  const email = String(userLike?.email || "").trim().toLowerCase();
  const emailBase = email.includes("@") ? email.split("@")[0] : email;
  const nameBase =
    String(userLike?.user_metadata?.full_name || userLike?.user_metadata?.name || "").trim();
  const idBase = String(userLike?.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();

  const candidates = [
    nameBase,
    emailBase,
    `${nameBase}-${idBase}`,
    `${emailBase}-${idBase}`,
    `user-${idBase || "anime"}`,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeProfileHandle(candidate);
    if (isValidProfileHandle(normalized)) return normalized;
  }
  return "user-anime";
}

export function buildPublicProfilePath(handle, base = "/") {
  const normalizedBase = String(base || "/").endsWith("/") ? String(base || "/") : `${String(base || "/")}/`;
  const normalizedHandle = normalizeProfileHandle(handle);
  return `${normalizedBase}u/?handle=${encodeURIComponent(normalizedHandle)}`;
}

export function buildDefaultProfileDraft(userLike) {
  const displayName = normalizeProfileDisplayName(
    userLike?.user_metadata?.full_name || userLike?.user_metadata?.name,
    String(userLike?.email || "").split("@")[0]
  );
  return {
    handle: suggestProfileHandle(userLike),
    displayName,
    bio: "",
    profilePublic: false,
    avatarUrl: null,
  };
}
