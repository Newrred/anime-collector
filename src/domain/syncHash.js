function stableSerialize(value) {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
  return `{${pairs.join(",")}}`;
}

function toHashableSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return snapshot;
  const { exportedAt, ...rest } = snapshot;
  return rest;
}

function fallbackHash(text) {
  let hash = 2166136261;
  for (let idx = 0; idx < text.length; idx += 1) {
    hash ^= text.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function stableStringify(value) {
  return stableSerialize(value);
}

export async function hashSnapshot(snapshot) {
  const serialized = stableSerialize(toHashableSnapshot(snapshot));

  if (typeof crypto !== "undefined" && crypto?.subtle?.digest) {
    const buffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serialized)
    );
    const bytes = Array.from(new Uint8Array(buffer));
    return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return fallbackHash(serialized);
}
