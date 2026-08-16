import { createHttpClient } from '../lib/http.mjs';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const PARSER_VERSION = 'anilist-test-v1';
const CHARACTER_PAGE_SIZE = 25;

const CATALOG_MEDIA_QUERY = `
query CatalogMedia($id: Int!, $page: Int!) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native } synonyms
    format status startDate { year month day } endDate { year month day }
    season seasonYear episodes source genres
    coverImage { extraLarge large medium }
    studios(isMain: true) { nodes { id name isAnimationStudio } }
    relations { edges { relationType node { id type title { romaji english native } format } } }
    externalLinks { id site url type }
    characters(page: $page, perPage: 25, sort: [ROLE, RELEVANCE, ID]) {
      pageInfo { currentPage hasNextPage }
      edges { role node { id name { full native alternative } }
        voiceActors(language: JAPANESE) { id name { full native alternative } language } }
    }
  }
}`;

function sourceSchemaDrift() {
  const error = new Error('AniList response does not match the requested target schema');
  error.code = 'SOURCE_SCHEMA_DRIFT';
  return error;
}

function targetAniListId(target) {
  const value = target?.seedExternalIds?.find((id) => id?.sourceId === 'anilist')?.value;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw sourceSchemaDrift();
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw sourceSchemaDrift();
  return { id, value };
}

function projectName(name) {
  if (!name || typeof name !== 'object') throw sourceSchemaDrift();
  return { full: name.full, native: name.native, alternative: name.alternative };
}

function projectCharacters(edges) {
  if (!Array.isArray(edges)) throw sourceSchemaDrift();
  return edges
    .filter((edge) => edge && (edge.role === 'MAIN' || edge.role === 'SUPPORTING'))
    .map((edge) => ({
      role: edge.role,
      node: { id: edge.node?.id, name: projectName(edge.node?.name) },
      voiceActors: Array.isArray(edge.voiceActors)
        ? edge.voiceActors
          .filter((actor) => actor?.language === 'JAPANESE')
          .map((actor) => ({ id: actor.id, name: projectName(actor.name), language: actor.language }))
        : [],
    }));
}

function projectMedia(media, characters) {
  return {
    id: media.id,
    idMal: media.idMal,
    title: { romaji: media.title?.romaji, english: media.title?.english, native: media.title?.native },
    synonyms: media.synonyms,
    format: media.format,
    status: media.status,
    startDate: { year: media.startDate?.year, month: media.startDate?.month, day: media.startDate?.day },
    endDate: { year: media.endDate?.year, month: media.endDate?.month, day: media.endDate?.day },
    season: media.season,
    seasonYear: media.seasonYear,
    episodes: media.episodes,
    source: media.source,
    genres: media.genres,
    coverImage: {
      extraLarge: media.coverImage?.extraLarge,
      large: media.coverImage?.large,
      medium: media.coverImage?.medium,
    },
    studios: {
      nodes: Array.isArray(media.studios?.nodes)
        ? media.studios.nodes.map((studio) => ({
          id: studio.id, name: studio.name, isAnimationStudio: studio.isAnimationStudio,
        }))
        : [],
    },
    relations: {
      edges: Array.isArray(media.relations?.edges)
        ? media.relations.edges.map((edge) => ({
          relationType: edge.relationType,
          node: {
            id: edge.node?.id,
            type: edge.node?.type,
            title: {
              romaji: edge.node?.title?.romaji,
              english: edge.node?.title?.english,
              native: edge.node?.title?.native,
            },
            format: edge.node?.format,
          },
        }))
        : [],
    },
    externalLinks: Array.isArray(media.externalLinks)
      ? media.externalLinks.map((link) => ({ id: link.id, site: link.site, url: link.url, type: link.type }))
      : [],
    characters,
  };
}

async function fetchMediaPage({ http, id, page }) {
  const response = await http.request({
    url: ANILIST_GRAPHQL_URL,
    kind: 'DATA',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: CATALOG_MEDIA_QUERY, variables: { id, page } }),
    },
  });
  let responseBody;
  try {
    responseBody = await response.json();
  } catch {
    throw sourceSchemaDrift();
  }
  const media = responseBody?.data?.Media;
  if (!media || typeof media !== 'object' || media.id !== id || !media.characters?.pageInfo) {
    throw sourceSchemaDrift();
  }
  if (media.characters.pageInfo.currentPage !== page
    || typeof media.characters.pageInfo.hasNextPage !== 'boolean') {
    throw sourceSchemaDrift();
  }
  return media;
}

/**
 * Creates the local-test AniList adapter. Requests are deferred until collect() and use an
 * injected Task 2 HTTP client when supplied by the caller.
 */
export function createAniListTestAdapter({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const defaultHttp = createHttpClient({ fetchImpl });

  return Object.freeze({
    async *collect({ targets, http = defaultHttp, clock }) {
      if (!Array.isArray(targets) || !http || typeof http.request !== 'function' || !clock
        || typeof clock.now !== 'function') throw sourceSchemaDrift();
      for (const target of targets) {
        const { id, value } = targetAniListId(target);
        let page = 1;
        let firstMedia;
        const characters = [];
        while (true) {
          const media = await fetchMediaPage({ http, id, page });
          if (!firstMedia) firstMedia = media;
          characters.push(...projectCharacters(media.characters.edges));
          if (!media.characters.pageInfo.hasNextPage) break;
          page += 1;
        }
        yield Object.freeze({
          sourceId: 'anilist',
          targetKey: target.targetKey,
          sourceEntityId: value,
          responseStatus: 200,
          fetchedAt: clock.now(),
          requestFingerprint: `graphql:media:${value}`,
          parserVersion: PARSER_VERSION,
          payload: projectMedia(firstMedia, characters),
        });
      }
    },
  });
}

export { CATALOG_MEDIA_QUERY, CHARACTER_PAGE_SIZE };
