import { hasMockAuthSession } from "../repositories/mockAuthStorage.js";

// Legacy social tables do not match the private account schema. Keep the
// historical UI available only in explicit development fixtures.
export function isLegacySocialAvailable() {
  return Boolean(import.meta.env?.DEV && hasMockAuthSession());
}
