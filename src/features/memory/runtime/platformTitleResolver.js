import aliasSeed from "../../../data/aliases.json";
import { searchAnimeByTitle } from "../../../lib/anilist.js";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient.js";
import { createAniListTitleResolver } from "../adapters/catalog/anilistTitleResolver.js";
import {
  createDevCatalogTitleResolver,
  createFallbackCatalogTitleResolver,
} from "../adapters/catalog/devCatalogTitleResolver.js";
import { createLegacyAliasTitleResolver } from "../adapters/catalog/legacyAliasTitleResolver.js";
import { createSupabaseCatalogTitleResolver } from "../adapters/catalog/supabaseCatalogTitleResolver.js";
import { createCombinedTitleResolver } from "../application/titleResolver.js";

const aniListResolver = createAniListTitleResolver({ searchAnime: searchAnimeByTitle, limit: 8 });
const previewCatalogResolver = isSupabaseConfigured
  ? createFallbackCatalogTitleResolver({
    primary: createSupabaseCatalogTitleResolver({ client: supabase, limit: 8 }),
    fallback: aniListResolver,
  })
  : aniListResolver;
const remoteResolver = import.meta.env.DEV
  ? createFallbackCatalogTitleResolver({
    primary: createDevCatalogTitleResolver(),
    fallback: previewCatalogResolver,
  })
  : previewCatalogResolver;

const platformTitleResolver = createCombinedTitleResolver({
  localResolver: createLegacyAliasTitleResolver({ rows: aliasSeed, limit: 8 }),
  remoteResolver,
  remoteTimeoutMs: 2500,
});

export const getPlatformTitleResolver = () => platformTitleResolver;
