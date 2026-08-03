import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUiPreferenceBootScript,
  normalizeUiLocale,
  UI_PREFERENCE_KEYS,
} from "../../src/domain/uiPreferences.js";

function runBootScript(values = {}) {
  const root = { dataset: {}, lang: "en" };
  const meta = {
    content: "",
    setAttribute(name, value) {
      if (name === "content") this.content = value;
    },
  };
  const document = {
    documentElement: root,
    querySelector(selector) {
      return selector === 'meta[name="theme-color"]' ? meta : null;
    },
  };
  const localStorage = {
    getItem(key) {
      return Object.hasOwn(values, key) ? values[key] : null;
    },
  };

  new Function("document", "localStorage", buildUiPreferenceBootScript())(document, localStorage);
  return { root, meta };
}

test("boot script preserves JSON-encoded Korean and light preferences before hydration", () => {
  const { root, meta } = runBootScript({
    [UI_PREFERENCE_KEYS.locale]: JSON.stringify("ko"),
    [UI_PREFERENCE_KEYS.theme]: JSON.stringify("light"),
  });

  assert.equal(root.lang, "ko");
  assert.equal(root.dataset.theme, "light");
  assert.notEqual(meta.content, "");
});

test("boot script preserves JSON-encoded English and dark preferences before hydration", () => {
  const { root, meta } = runBootScript({
    [UI_PREFERENCE_KEYS.locale]: JSON.stringify("en"),
    [UI_PREFERENCE_KEYS.theme]: JSON.stringify("dark"),
  });

  assert.equal(root.lang, "en");
  assert.equal(root.dataset.theme, "dark");
  assert.notEqual(meta.content, "");
});

test("boot script falls back to fresh English and dark preferences for malformed storage", () => {
  const { root, meta } = runBootScript({
    [UI_PREFERENCE_KEYS.locale]: "not-json",
    [UI_PREFERENCE_KEYS.theme]: JSON.stringify("system"),
  });

  assert.equal(root.lang, "en");
  assert.equal(root.dataset.theme, "dark");
  assert.notEqual(meta.content, "");
});

test("invalid stored locale values normalize to the declared English default", () => {
  assert.equal(normalizeUiLocale(null), "en");
  assert.equal(normalizeUiLocale("fr"), "en");
  assert.equal(normalizeUiLocale("ko"), "ko");
});

test("boot script treats JSON null and unsupported JSON strings as fresh English", () => {
  assert.equal(
    runBootScript({ [UI_PREFERENCE_KEYS.locale]: JSON.stringify(null) }).root.lang,
    "en",
  );
  assert.equal(
    runBootScript({ [UI_PREFERENCE_KEYS.locale]: JSON.stringify("vi") }).root.lang,
    "en",
  );
});
