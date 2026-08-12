import { MemoryDomainError } from "./memoryDomain.js";

const TEMPLATE_IDS = new Set(["memory-gradient", "memory-type"]);
const LAYOUTS = new Set(["BOTTOM_LEFT", "CENTER", "TOP_LEFT"]);

const hashToken = (value) => {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const invalid = (message) => {
  throw new MemoryDomainError("INVALID_SYSTEM_DESIGN", message);
};

export function normalizeSystemDesignSpec(spec) {
  if (!spec || spec.version !== 1) invalid("Unsupported system design version");
  if (!TEMPLATE_IDS.has(spec.templateId)) invalid("Unknown system design template");
  if (!LAYOUTS.has(spec.titleLayout)) invalid("Unknown title layout");

  const paletteId = String(spec.paletteId || "").trim();
  const patternSeed = String(spec.patternSeed || "").trim();
  if (!paletteId || !patternSeed) invalid("Palette and pattern seed are required");

  const genreTokens = (spec.genreTokens || []).flatMap((token) => {
    const normalizedToken = String(token).trim();
    return normalizedToken ? [normalizedToken] : [];
  });
  return Object.freeze({
    version: 1,
    templateId: spec.templateId,
    paletteId,
    patternSeed,
    titleLayout: spec.titleLayout,
    genreTokens: Object.freeze(genreTokens),
  });
}

export function createSystemDesignViewModel(spec) {
  const normalized = normalizeSystemDesignSpec(spec);
  const canonical = JSON.stringify(normalized);

  return Object.freeze({
    version: 1,
    templateId: normalized.templateId,
    paletteId: normalized.paletteId,
    titleLayout: normalized.titleLayout,
    patternToken: hashToken(canonical),
    genreTokens: normalized.genreTokens,
  });
}
