import { isPublicationId, publicationSnapshot } from "../domain/publicationView.js";
import { minihomeReview, minihomeStatus } from "../domain/minihomeView.js";
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
export function createMinihomeController({ userId, gateway, getSession, uuid = () => crypto.randomUUID() }) {
  let state = { busy: false, error: null, review: null, home: null, boards: [], next: null, phase: "loading" };
  let generation = 0, request = null, operation = null, disposed = false;
  const listeners = new Set();
  const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
  const run = async (phase, action) => {
    if (state.busy || disposed) return;
    const turn = ++generation, controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    const check = async () => {
      if ((await getSession())?.user?.id !== userId) fail("AUTH_REQUIRED");
      if (disposed || generation !== turn || controller.signal.aborted) fail("REQUEST_ABORTED");
    };
    emit({ busy: true, error: null, phase });
    try { await check(); await action({ signal: controller.signal, check }); }
    catch (error) {
      if (!disposed && turn === generation) {
        const invalid = ["AUTH_REQUIRED", "PUBLICATION_RESTRICTED", "PUBLICATION_CONFLICT", "PREVIEW_CHANGED", "CONSENT_MISMATCH"].includes(error.code);
        if (invalid) operation = null;
        emit({ error: error.code || "PUBLICATION_REQUEST_FAILED", phase: "error", ...(invalid ? { review: null } : {}) });
      }
    } finally { clearTimeout(timeout); if (!disposed && turn === generation) { request = null; emit({ busy: false }); } }
  };
  const page = (value) => {
    if (!Array.isArray(value?.boards) || value.boards.length > 20 || (value.next !== null && !isPublicationId(value.next))) fail("PUBLICATION_RESPONSE_INVALID");
    return { boards: value.boards.map((b) => { if (!isPublicationId(b.id)) fail("PUBLICATION_RESPONSE_INVALID"); return { id: b.id, ...publicationSnapshot(b) }; }), next: value.next };
  };
  return {
    getSnapshot: () => state, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    load: () => run("loading", async ({ signal, check }) => {
      const [home, choices] = await Promise.all([gateway.getHome({ signal }), gateway.listHomeBoards(null, { signal })]);
      await check(); emit({ home: minihomeStatus(home), ...page(choices), review: null, phase: "selecting" });
    }),
    more: () => run("loading", async ({ signal, check }) => {
      if (!state.next) return;
      const result = page(await gateway.listHomeBoards(state.next, { signal }));
      await check(); emit({ boards: [...new Map([...state.boards, ...result.boards].map((b) => [b.id, b])).values()], next: result.next, phase: "selecting" });
    }),
    prepare: (selection) => run("preparing", async ({ signal, check }) => {
      operation = null; emit({ review: null });
      const current = minihomeStatus(await gateway.getHome({ signal })); await check();
      if (current?.hidden) fail("PUBLICATION_RESTRICTED");
      const review = minihomeReview(await gateway.prepareHome(current?.revision || 0, selection, { signal }));
      await check(); operation = uuid(); emit({ home: current, review, phase: "reviewing" });
    }),
    publish: ({ consented, visualsReady }) => run("publishing", async ({ signal, check }) => {
      if (!state.review || !operation || !consented || !visualsReady) fail("REVIEW_REQUIRED");
      const result = minihomeStatus(await gateway.publishHome({ ...state.review, operationId: operation }, { signal }));
      await check(); if (!result?.published || result.id !== state.review.id) fail("PUBLICATION_CONFLICT");
      emit({ home: result, review: null, phase: "published" });
    }),
    revoke: () => run("revoking", async ({ signal, check }) => {
      const home = minihomeStatus(await gateway.getHome({ signal })); await check();
      if (!home) fail("NOT_FOUND");
      const result = minihomeStatus(await gateway.revokeHome(home.revision, { signal })); await check();
      if (!result || result.id !== home.id || result.published) fail("PUBLICATION_RESPONSE_INVALID");
      operation = null; emit({ home: result, review: null, phase: "revoked" });
    }),
    cancel() {
      if (state.busy && ["publishing", "revoking"].includes(state.phase)) return;
      generation++; request?.abort(); operation = null; emit({ busy: false, review: null, error: null, phase: "selecting" });
    },
    dispose() { disposed = true; generation++; request?.abort(); listeners.clear(); },
  };
}
