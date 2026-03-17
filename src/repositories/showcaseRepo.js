import { supabase } from "../lib/supabaseClient.js";
import { readJson, writeJson } from "../storage/localJsonStore.js";

const LOCAL_LAYOUT_KEY = "moemoa.showcase.layout.v1";
const LAYOUT_TABLE = "user_showcase_layouts";
const PUBLIC_TABLE = "user_showcase_public";

export const DEFAULT_SHOWCASE_LAYOUT = {
  version: 1,
  widgets: [
    { id: "tasteFingerprint", enabled: true, size: "half" },
    { id: "thisTimeCapsule", enabled: true, size: "half" },
    { id: "genreWordHeatmap", enabled: true, size: "wide" },
    { id: "resonanceShelf", enabled: true, size: "wide" },
    { id: "posterPalette", enabled: true, size: "half" },
  ],
};

const VALID_WIDGET_IDS = new Set(DEFAULT_SHOWCASE_LAYOUT.widgets.map((row) => row.id));

export function normalizeShowcaseLayout(raw) {
  const widgets = Array.isArray(raw?.widgets) ? raw.widgets : DEFAULT_SHOWCASE_LAYOUT.widgets;
  const normalized = widgets
    .map((row) => ({
      id: String(row?.id || "").trim(),
      enabled: row?.enabled !== false,
      size: row?.size === "wide" ? "wide" : "half",
    }))
    .filter((row) => VALID_WIDGET_IDS.has(row.id));

  const seen = new Set();
  const deduped = normalized.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  for (const base of DEFAULT_SHOWCASE_LAYOUT.widgets) {
    if (!seen.has(base.id)) deduped.push(base);
  }

  return {
    version: 1,
    widgets: deduped,
  };
}

export async function readShowcaseLayout(userId = null) {
  const local = normalizeShowcaseLayout(readJson(LOCAL_LAYOUT_KEY, DEFAULT_SHOWCASE_LAYOUT));
  if (!supabase || !userId) return local;

  const { data, error } = await supabase
    .from(LAYOUT_TABLE)
    .select("layout,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.layout) return local;
  return normalizeShowcaseLayout(data.layout);
}

export async function saveShowcaseLayout(userId = null, layout) {
  const normalized = normalizeShowcaseLayout(layout);
  writeJson(LOCAL_LAYOUT_KEY, normalized);

  if (!supabase || !userId) return normalized;

  const { error } = await supabase.from(LAYOUT_TABLE).upsert(
    {
      user_id: userId,
      layout: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return normalized;
}

export async function readPublicShowcaseSnapshot(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from(PUBLIC_TABLE)
    .select("snapshot,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.snapshot || null;
}

export async function publishShowcaseSnapshot(userId, snapshot) {
  if (!supabase || !userId) {
    throw new Error("Public showcase publish requires a signed-in user and Supabase config.");
  }

  const { error } = await supabase.from(PUBLIC_TABLE).upsert(
    {
      user_id: userId,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return snapshot;
}
