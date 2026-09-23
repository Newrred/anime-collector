import { sha256 } from '../lib/hash.mjs';

export const REVIEWED_PAGE_PARSER = 'anilist-reviewed-public-page-v1';

/** A reviewed DOM observation, never a substitute claim of successful API collection. */
export function createReviewedAniListPageEnvelope(capture) {
  const id = String(capture?.media?.id ?? '');
  const url = new URL(capture.pageUrl);
  if (!/^[1-9]\d*$/.test(id) || url.origin !== 'https://anilist.co'
    || !url.pathname.startsWith(`/anime/${id}/`) || url.search || url.hash || url.username || url.password
    || capture.method !== 'REVIEWED_PUBLIC_RENDERED_PAGE'
    || !capture.reviewedBy || !capture.observedTitle
    || capture.observedTitle !== capture.media.title.romaji
    || new Date(capture.capturedAt).toISOString() !== capture.capturedAt) {
    throw new Error('Reviewed AniList page identity or provenance is invalid');
  }
  return {
    sourceId: 'anilist', targetKey: `ANILIST:${id}`, sourceEntityId: id,
    responseStatus: 200, fetchedAt: capture.capturedAt,
    requestFingerprint: `reviewed-page:${url.href}:${sha256(capture)}`,
    parserVersion: REVIEWED_PAGE_PARSER, payload: structuredClone(capture.media),
  };
}
