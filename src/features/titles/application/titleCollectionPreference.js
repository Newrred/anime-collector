import { readString, writeString } from "../../../storage/localJsonStore.js";
import { STORAGE_KEYS } from "../../../storage/keys.js";

const MODES = new Set(["POSTER", "MEMORY"]);

export function readTitleCollectionViewPreference() {
  const value = readString(STORAGE_KEYS.titleCollectionView, "");
  return MODES.has(value) ? value : null;
}

export function writeTitleCollectionViewPreference(mode) {
  if (!MODES.has(mode)) return false;
  writeString(STORAGE_KEYS.titleCollectionView, mode);
  return true;
}
