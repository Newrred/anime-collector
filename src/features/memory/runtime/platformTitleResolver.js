import aliasSeed from "../../../data/aliases.json";
import { searchAnimeByTitle } from "../../../lib/anilist.js";
import { createAniListTitleResolver } from "../adapters/catalog/anilistTitleResolver.js";
import { createLegacyAliasTitleResolver } from "../adapters/catalog/legacyAliasTitleResolver.js";
import { createCombinedTitleResolver } from "../application/titleResolver.js";

const platformTitleResolver = createCombinedTitleResolver({
  localResolver: createLegacyAliasTitleResolver({ rows: aliasSeed, limit: 8 }),
  remoteResolver: createAniListTitleResolver({ searchAnime: searchAnimeByTitle, limit: 8 }),
  remoteTimeoutMs: 2500,
});

export const getPlatformTitleResolver = () => platformTitleResolver;
