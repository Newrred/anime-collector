import { useEffect } from "react";

import { useStoredState } from "./useStoredState";
import { writeJson } from "../storage/localJsonStore";
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
    const update = event => {
      if (event.detail?.theme !== undefined) setThemeState(normalizeUiTheme(event.detail.theme));
      if (event.detail?.locale !== undefined) setLocaleState(normalizeUiLocale(event.detail.locale));
    };
    window.addEventListener("moemoa:ui-preferences-changed", update);
    return () => window.removeEventListener("moemoa:ui-preferences-changed", update);
  }, [setThemeState, setLocaleState]);

  useEffect(() => {
    applyUiPreferencesToDocument({ theme, locale });
  }, [theme, locale]);

  return {
    theme,
    locale,
    setTheme(nextValue) {
      const next = resolveNextValue(nextValue, theme, normalizeUiTheme);
      writeJson(UI_PREFERENCE_KEYS.theme, next);
      setThemeState(next);
      window.dispatchEvent(new CustomEvent("moemoa:ui-preferences-changed", { detail: { theme: next } }));
    },
    setLocale(nextValue) {
      const next = resolveNextValue(nextValue, locale, normalizeUiLocale);
      writeJson(UI_PREFERENCE_KEYS.locale, next);
      setLocaleState(next);
      window.dispatchEvent(new CustomEvent("moemoa:ui-preferences-changed", { detail: { locale: next } }));
    },
  };
}
