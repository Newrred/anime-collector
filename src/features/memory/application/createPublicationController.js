import { PUBLIC_FIELDS, isPublicationId, publicationReview } from "../domain/publicationView.js";
import { prepareSelectedPublicImage } from "./preparePublicImage.js";

const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const synced = (entity) => entity?.sync?.syncState === "SYNCED" && entity.sync.remoteVersion > 0;
function selectionFor(input) {
  if (!input.title?.trim() || input.title.length > 80 || input.description.length > 500
    || !Array.isArray(input.cards) || !input.cards.length || input.cards.length > 100) fail("INVALID_SELECTION");
  const seen = new Set();
  return { title: input.title.trim(), description: input.description, cards: input.cards.map(({ cardId, fields }) => {
    if (!isPublicationId(cardId) || seen.has(cardId) || !Array.isArray(fields)
      || fields.some((field) => !PUBLIC_FIELDS.includes(field))) fail("INVALID_SELECTION");
    seen.add(cardId);
    return { cardId, fields: [...new Set(fields)] };
  }) };
}

export function createPublicationController({ boardId, ownerId, gateway, getSession, getBoard,
  policyRevision = "", uuid = () => crypto.randomUUID(), prepareImage = prepareSelectedPublicImage }) {
  let state = { busy: false, phase: "loading", error: null, review: null, publication: null };
  const listeners = new Set();
  const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
  let generation = 0, currentRequest = null, disposed = false, operationId = null, reviewedSelection = null, sourceStamp = null;
  const imageOperations = new Map();
  const auth = async () => {
    const session = await getSession();
    if (!session?.user?.id || ownerId !== `account:${session.user.id}`) fail("AUTH_REQUIRED");
    return session;
  };
  const sources = async (selection) => {
    const detail = await getBoard(boardId);
    if (!detail || detail.board.ownerId !== ownerId) fail("AUTH_REQUIRED");
    if (!synced(detail.board)) fail("SYNC_REQUIRED");
    return JSON.stringify([detail.board.sync.remoteVersion, ...selection.cards.map(({ cardId }) => {
      const item = detail.items.find((entry) => entry.bundle.card.id === cardId);
      if (!item || ![item.membership, item.bundle.card, item.bundle.asset].every(synced)) fail("SYNC_REQUIRED");
      return [cardId, item.membership.sync.remoteVersion, item.bundle.card.sync.remoteVersion, item.bundle.asset.id, item.bundle.asset.sync.remoteVersion];
    })]);
  };
  const run = async (phase, task) => {
    if (disposed || state.busy) return;
    const request = new AbortController(), turn = ++generation;
    const timeout = setTimeout(() => request.abort(), 20000);
    currentRequest = request;
    const check = async () => {
      await auth();
      if (disposed || turn !== generation || request.signal.aborted) fail("REQUEST_ABORTED");
    };
    emit({ busy: true, phase, error: null });
    try {
      await check();
      await task({ signal: request.signal, check });
    } catch (error) {
      if (!disposed && turn === generation) {
        const invalidReview = ["PREVIEW_CHANGED", "PUBLICATION_CONFLICT", "CONSENT_MISMATCH", "AUTH_REQUIRED", "SYNC_REQUIRED", "PUBLICATION_RESTRICTED"].includes(error?.code);
        if (invalidReview) { operationId = null; reviewedSelection = null; sourceStamp = null; }
        emit({ error: error?.code || "PUBLICATION_REQUEST_FAILED", phase: "error", ...(invalidReview ? { review: null } : {}) });
      }
    } finally {
      clearTimeout(timeout);
      if (!disposed && turn === generation) { currentRequest = null; emit({ busy: false }); }
    }
  };
  const validatePublication = (value) => {
    if (value && (!isPublicationId(value.id) || !Number.isSafeInteger(value.revision) || value.revision < 0
      || !["PRIVATE", "PREPARING", "PUBLISHED", "REVOKED"].includes(value.state))) fail("PUBLICATION_RESPONSE_INVALID");
    return value ? { id: value.id, revision: value.revision, state: value.state, hidden: Boolean(value.hidden),
      hasPublished: value.hasPublished === true || value.state === "PUBLISHED",
      sourceChanged: value.sourceChanged !== false } : null;
  };
  return {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    load: () => run("loading", async ({ signal, check }) => {
      const result = await gateway.get(boardId, { signal });
      await check();
      const publication = validatePublication(result);
      if (publication?.hasPublished) {
        const detail = await getBoard(boardId);
        if (!detail || !synced(detail.board) || detail.items.some(({ membership, bundle }) =>
          ![membership, bundle.card, bundle.asset].every(synced))) publication.sourceChanged = true;
        await check();
      }
      emit({ publication, review: null, phase: "selecting" });
    }),
    prepare: (input) => run("preparing", async ({ signal, check }) => {
      emit({ review: null });
      operationId = null;
      const selection = selectionFor(input), stamp = await sources(selection);
      await check();
      // A cancelled/ambiguous prepare may have advanced revision. Recover it before each new review.
      const previous = validatePublication(await gateway.get(boardId, { signal }));
      await check();
      if (previous?.hidden) fail("PUBLICATION_RESTRICTED");
      const result = await gateway.prepare({ boardId, expectedRevision: previous?.revision || 0, ...selection }, { signal });
      await check();
      const review = publicationReview(result);
      if (review.snapshot.cards.length !== selection.cards.length) fail("PUBLICATION_RESPONSE_INVALID");
      if (stamp !== await sources(selection)) fail("PREVIEW_CHANGED");
      await check();
      reviewedSelection = selection; sourceStamp = stamp; operationId = uuid();
      emit({ review, publication: { ...previous, id: review.id, revision: review.revision, state: "PREPARING" }, phase: "reviewing" });
    }),
    publish: ({ consented, visualsReady }) => run("publishing", async ({ signal, check }) => {
      if (!state.review || !reviewedSelection || !consented || !visualsReady) fail("REVIEW_REQUIRED");
      if (sourceStamp !== await sources(reviewedSelection)) fail("PREVIEW_CHANGED");
      await check();
      const review = state.review;
      const result = validatePublication(await gateway.publish({ id: review.id, expectedRevision: review.revision,
        reviewHash: review.reviewHash, policyRevision: review.policyRevision, operationId }, { signal }));
      await check();
      if (result?.id !== review.id || result.state !== "PUBLISHED") fail("PUBLICATION_CONFLICT");
      emit({ publication: { ...result, sourceChanged: false }, review: null, phase: "published" });
    }),
    revoke: () => run("revoking", async ({ signal, check }) => {
      const current = validatePublication(await gateway.get(boardId, { signal }));
      await check();
      if (!current) fail("NOT_FOUND");
      const result = validatePublication(await gateway.revoke({ id: current.id, expectedRevision: current.revision }, { signal }));
      await check();
      if (result?.id !== current.id || result.state !== "REVOKED") fail("PUBLICATION_REQUEST_FAILED");
      operationId = null; reviewedSelection = null;
      emit({ publication: result, review: null, phase: "revoked" });
    }),
    revokeCard: (cardId) => run("revoking", async ({ signal, check }) => {
      const detail = await getBoard(boardId);
      if (detail?.board.ownerId !== ownerId || !detail.items.some((item) => item.bundle.card.id === cardId)) fail("NOT_FOUND");
      await check();
      // Invalidate consent before sending: an ambiguous response must never leave a publishable review.
      operationId = null; reviewedSelection = null; sourceStamp = null;
      emit({ review: null });
      await gateway.revokeCard(cardId, { signal });
      await check();
      emit({ phase: "cardRevoked" });
    }),
    upload: ({ cardId, file, consented }) => run("uploading", async ({ signal, check }) => {
      if (!consented || !policyRevision || policyRevision === "UNAPPROVED") fail("IMAGE_CONSENT_REQUIRED");
      const detail = await getBoard(boardId);
      const item = detail?.items.find((entry) => entry.bundle.card.id === cardId);
      if (detail?.board.ownerId !== ownerId || !item || !synced(item.bundle.asset)) fail("SYNC_REQUIRED");
      const asset = item.bundle.asset;
      const session = await auth();
      await check();
      const key = `${asset.id}:${asset.sync.remoteVersion}`;
      if (!imageOperations.has(key)) imageOperations.set(key, uuid());
      await prepareImage({ sourceAssetId: asset.id, sourceVersion: asset.sync.remoteVersion, operationId: imageOperations.get(key),
        accessToken: session.access_token, policyRevision, consented, readOriginal: () => file, signal });
      await check();
      emit({ review: null, phase: "imageReady" });
    }),
    cancel() {
      // Once sent, a publish/revoke cannot be described as cancelled; reload recovers server state.
      if (["publishing", "revoking"].includes(state.phase) && state.busy) return;
      generation++; currentRequest?.abort(); currentRequest = null;
      operationId = null; reviewedSelection = null; sourceStamp = null;
      emit({ busy: false, review: null, error: null, phase: "selecting" });
    },
    dispose() { disposed = true; generation++; currentRequest?.abort(); listeners.clear(); },
  };
}
