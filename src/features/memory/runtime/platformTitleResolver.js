import aliasSeed from "../../../data/aliases.json";
import { searchAnimeByTitle } from "../../../lib/anilist.js";
import { createAniListTitleResolver } from "../adapters/catalog/anilistTitleResolver.js";
import {
  createDevCatalogTitleResolver,
  createFallbackCatalogTitleResolver,
} from "../adapters/catalog/devCatalogTitleResolver.js";
import { createLegacyAliasTitleResolver } from "../adapters/catalog/legacyAliasTitleResolver.js";
import { createCombinedTitleResolver } from "../application/titleResolver.js";

const aniListResolver = createAniListTitleResolver({ searchAnime: searchAnimeByTitle, limit: 8 });
const remoteResolver = import.meta.env.DEV
  ? createFallbackCatalogTitleResolver({
    primary: createDevCatalogTitleResolver(),
    fallback: aniListResolver,
  })
  : aniListResolver;

const platformTitleResolver = createCombinedTitleResolver({
  localResolver: createLegacyAliasTitleResolver({ rows: aliasSeed, limit: 8 }),
  remoteResolver,
  remoteTimeoutMs: 2500,
});

export const getPlatformTitleResolver = () => platformTitleResolver;
