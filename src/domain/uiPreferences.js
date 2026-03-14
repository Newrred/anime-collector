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
  locale: UI_LOCALE.ko,
};

const THEME_META = {
  [UI_THEME.dark]: { themeColor: "#0b0c10" },
  [UI_THEME.light]: { themeColor: "#f4f1df" },
};

export function normalizeUiTheme(value) {
  return value === UI_THEME.light ? UI_THEME.light : UI_THEME.dark;
}

export function normalizeUiLocale(value) {
  return value === UI_LOCALE.en ? UI_LOCALE.en : UI_LOCALE.ko;
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

  return `
    (() => {
      try {
        const root = document.documentElement;
        const themeRaw = localStorage.getItem(${themeKey});
        const localeRaw = localStorage.getItem(${localeKey});
        const theme = themeRaw === "light" ? "light" : ${defaultTheme};
        const locale = localeRaw === "en" ? "en" : ${defaultLocale};
        root.dataset.theme = theme;
        root.lang = locale;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "light" ? "#f4f1df" : "#0b0c10");
      } catch {}
    })();
  `.trim();
}
