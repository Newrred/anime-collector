import { createClient } from "@supabase/supabase-js";
import { SupabasePublicationGateway } from "../adapters/supabase/SupabasePublicationGateway.js";
import { CATALOG_COVER_COLUMNS, toCatalogCoverDisplay } from "../../catalog/catalogCoverReference.js";

const env = import.meta.env || {};
const testAdapters = () => import.meta.env.DEV ? globalThis.__MOEMOA_TEST_PUBLICATION_ADAPTERS__ : null;
export const publicationUiEnabled = () => env.PUBLIC_MEMORY_PUBLICATION_V1 === "1" || Boolean(testAdapters());
export const minihomeUiEnabled = () => publicationUiEnabled() && (env.PUBLIC_MEMORY_MINIHOME_V1 === "1" || Boolean(testAdapters()));
export const followsUiEnabled = () => minihomeUiEnabled() && (env.PUBLIC_MEMORY_FOLLOWS_V1 === "1" || Boolean(testAdapters()));
export const safetyUiEnabled = () => publicationUiEnabled() && (env.PUBLIC_MEMORY_MODERATION_V1 === "1" || Boolean(testAdapters()));
let services;
export function getPublicationServices() {
  if (services) return services;
  const test = testAdapters();
  const client = test?.client || (publicationUiEnabled() && env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY
    ? createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "moemoa-public-reader" },
      global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
    }) : null);
  let writerPromise;
  const getWriter = () => writerPromise ||= (async () => {
    const { supabase } = await import("../../../lib/supabaseClient.js");
    return new SupabasePublicationGateway(test?.client || supabase);
  })();
  services = {
    enabled: publicationUiEnabled() && Boolean(client),
    policyRevision: test?.policyRevision || env.PUBLIC_MEMORY_PUBLICATION_POLICY_REVISION || "",
    reader: client ? new SupabasePublicationGateway(client) : null,
    gateway: Object.fromEntries(["get", "prepare", "publish", "revoke", "revokeCard", "retireCard", "getHome", "listHomeBoards", "prepareHome", "publishHome", "revokeHome", "relationship", "setRelationship", "relationships", "report", "safety", "appeal"].map((method) => [method,
      async (...args) => (await getWriter())[method](...args)])),
    async getSession() {
      const { getAuthSession } = await import("../../../repositories/authRepo.js");
      return getAuthSession();
    },
    async resolveCover(card, signal) {
      if (test?.resolveCover) return test.resolveCover(card, signal);
      const { data, error } = await client.from("catalog_cover_revisions").select(CATALOG_COVER_COLUMNS)
        .eq("catalog_cover_revision_id", card.visual.revisionId).abortSignal(signal).maybeSingle();
      if (error) throw new Error("PUBLIC_VISUAL_NOT_READY");
      const cover = toCatalogCoverDisplay(data, client, { animeId: card.animeId, revisionId: card.visual.revisionId });
      if (!cover) throw new Error("PUBLIC_VISUAL_NOT_READY");
      return cover.publicUrl;
    },
    async previewImage(assetId, signal) {
      const session = await services.getSession();
      if (!session?.access_token) throw new Error("AUTH_REQUIRED");
      const response = await fetch(`/api/public-image?preview=1&asset=${encodeURIComponent(assetId)}&variant=full`, {
        signal, cache: "no-store", headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/webp") throw new Error("PUBLIC_VISUAL_NOT_READY");
      const blob = await response.blob();
      if (!blob.size || blob.size > 2 * 1024 * 1024) throw new Error("PUBLIC_VISUAL_NOT_READY");
      return blob;
    },
  };
  return services;
}
