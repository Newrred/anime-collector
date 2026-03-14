import { useEffect } from "react";

import { useStoredState } from "./useStoredState";
import {
  applyUiPreferencesToDocument,
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCE_KEYS,
  normalizeUiLocale,
  normalizeUiTheme,
} from "../domain/uiPreferences";

function resolveNextValue(nextValue, currentValue, normalize) {
  if (typeof nextValue === "function") {
    return normalize(nextValue(currentValue));
  }
  return normalize(nextValue);
}

export function useUiPreferences() {
  const [themeState, setThemeState] = useStoredState(
    UI_PREFERENCE_KEYS.theme,
    DEFAULT_UI_PREFERENCES.theme
  );
  const [localeState, setLocaleState] = useStoredState(
    UI_PREFERENCE_KEYS.locale,
    DEFAULT_UI_PREFERENCES.locale
  );

  const theme = normalizeUiTheme(themeState);
  const locale = normalizeUiLocale(localeState);

  useEffect(() => {
    applyUiPreferencesToDocument({ theme, locale });
  }, [theme, locale]);

  return {
    theme,
    locale,
    setTheme(nextValue) {
      setThemeState((currentValue) =>
        resolveNextValue(nextValue, normalizeUiTheme(currentValue), normalizeUiTheme)
      );
    },
    setLocale(nextValue) {
      setLocaleState((currentValue) =>
        resolveNextValue(nextValue, normalizeUiLocale(currentValue), normalizeUiLocale)
      );
    },
  };
}
