import { THEME_META_COLORS } from "./colorSystem.js";

export const UI_THEME = {
  dark: "dark",
  light: "light",
};

export const UI_LOCALE = {
  ko: "ko",
  en: "en",
};

export const UI_PREFERENCE_KEYS = {
  theme: "ui:theme:v1",
  locale: "ui:locale:v1",
};

export const DEFAULT_UI_PREFERENCES = {
  theme: UI_THEME.dark,
  locale: UI_LOCALE.en,
};

const THEME_META = {
  [UI_THEME.dark]: { themeColor: THEME_META_COLORS.dark },
  [UI_THEME.light]: { themeColor: THEME_META_COLORS.light },
};

export function normalizeUiTheme(value) {
  return value === UI_THEME.light ? UI_THEME.light : UI_THEME.dark;
}

export function normalizeUiLocale(value) {
  return value === UI_LOCALE.ko ? UI_LOCALE.ko : DEFAULT_UI_PREFERENCES.locale;
}

export function applyUiPreferencesToDocument({ theme, locale }) {
  if (typeof document === "undefined") return;

  const safeTheme = normalizeUiTheme(theme);
  const safeLocale = normalizeUiLocale(locale);
  const root = document.documentElement;

  root.dataset.theme = safeTheme;
  root.lang = safeLocale;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", THEME_META[safeTheme].themeColor);
  }
}

export function buildUiPreferenceBootScript() {
  const themeKey = JSON.stringify(UI_PREFERENCE_KEYS.theme);
  const localeKey = JSON.stringify(UI_PREFERENCE_KEYS.locale);
  const defaultTheme = JSON.stringify(DEFAULT_UI_PREFERENCES.theme);
  const defaultLocale = JSON.stringify(DEFAULT_UI_PREFERENCES.locale);
  const darkThemeColor = JSON.stringify(THEME_META_COLORS.dark);
  const lightThemeColor = JSON.stringify(THEME_META_COLORS.light);

  return `
    (() => {
      try {
        const root = document.documentElement;
        const themeRaw = localStorage.getItem(${themeKey});
        const localeRaw = localStorage.getItem(${localeKey});
        const parsePreference = (raw) => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        };
        const themeValue = parsePreference(themeRaw);
        const localeValue = parsePreference(localeRaw);
        const theme = themeValue === "light" || themeValue === "dark" ? themeValue : ${defaultTheme};
        const locale = localeValue === "en" || localeValue === "ko" ? localeValue : ${defaultLocale};
        root.dataset.theme = theme;
        root.lang = locale;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "light" ? ${lightThemeColor} : ${darkThemeColor});
      } catch {}
    })();
  `.trim();
}
