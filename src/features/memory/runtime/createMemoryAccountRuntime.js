import {
  buildGuestPromotionManifest,
  resolvePromotionTitleChoice,
} from "../application/buildGuestPromotionManifest.js";
import { createPromoteGuestMemory } from "../application/promoteGuestMemory.js";
import { createResolveMemoryConflict } from "../application/resolveMemoryConflict.js";
import { createMemoryMetadataSync } from "../application/syncMemoryMetadata.js";

const USER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clone = (value) => value == null ? value : structuredClone(value);
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

const createDisabledRuntime = () => ({
  enabled: false,
  status: "LOCAL_ONLY",
  getState: async () => Object.freeze({ enabled: false, status: "LOCAL_ONLY" }),
  initializeAccountSession: async () => null,
  handleSignedOut: async () => null,
  buildPromotionPreview: async () => null,
  promote: async () => null,
  syncNow: async () => null,
  resolveConflict: async () => null,
  exportConflictBackup: async () => null,
});

const requireDependencies = (input) => {
  const requiredRepository = [
    "ensureInstallationIdentity",
    "getActiveOwner",
    "ensureAccountOwner",
    "activateOwner",
    "rotateGuestOwnerAfterPromotion",
    "countCompleteCards",
    "readOwnerPromotionBundle",
    "resolvePromotionTitleChoice",
    "beginPromotionJournal",
    "markPromotionRemoteCompleted",
    "listRecoverablePromotions",
    "commitPromotionToAccount",
  ];
  if (!input.repository || requiredRepository.some((method) => typeof input.repository[method] !== "function")
    || !input.gateway || typeof input.gateway.ensureUserProfile !== "function"
    || typeof input.gateway.registerDevice !== "function"
    || typeof input.readDeviceSyncState !== "function"
    || typeof input.writeDeviceSyncState !== "function"
    || typeof input.uuid !== "function"
    || typeof input.clock?.now !== "function") {
    fail("ACCOUNT_RUNTIME_INVALID", "Memory account dependencies are incomplete");
  }
};

const profileInput = ({ locale, timeZone }) => ({
  displayName: null,
  locale: String(locale || "en").slice(0, 16) || "en",
  timeZone: String(timeZone || "UTC").slice(0, 64) || "UTC",
});

export function createMemoryAccountRuntime(input = {}) {
  if (!input.enabled) return createDisabledRuntime();
  requireDependencies(input);
  const {
    repository,
    gateway,
    readDeviceSyncState,
    writeDeviceSyncState,
    uuid,
    clock,
  } = input;
  const platform = input.platform === "ANDROID" ? "ANDROID" : "WEB";
  const appVersion = String(input.appVersion || "web-v1").trim().slice(0, 100) || "web-v1";
  let state = Object.freeze({ enabled: true, status: "LOCAL_ONLY", guestCardCount: 0, errorCode: null });
  let initialization = null;
  let initializingUserId = null;
  let registeredUserId = null;
  let signedOut = null;
  let promotionOperationId = null;
  let promotionPreview = null;
  let promotionInFlight = null;
  const promotion = createPromoteGuestMemory({ repository, gateway, uuid, clock });
  const metadataSync = createMemoryMetadataSync({ repository, gateway, clock, readDeviceSyncState });
  const resolveMemoryConflict = createResolveMemoryConflict({ repository, gateway, uuid, clock });
  let syncInFlight = null;
  let syncController = null;
  let initializationController = null;
  let sessionGeneration = 0;
  let previewGeneration = 0;
  const assertSession = (generation) => {
    if (generation !== sessionGeneration) fail("SYNC_OWNER_CHANGED", "The account session changed");
  };

  const setState = (next) => {
    state = Object.freeze({ enabled: true, errorCode: null, ...next });
    return clone(state);
  };

  const initialize = async (session) => {
    const userId = String(session?.user?.id || "").toLowerCase();
    if (!USER_UUID.test(userId)) fail("AUTH_SESSION_INVALID", "A valid account session is required");
    if (!initialization && !signedOut && registeredUserId === userId && ["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(state.status)) {
      return clone(state);
    }
    if (initialization && initializingUserId === userId) return initialization;

    initializationController?.abort();
    const controller = new AbortController();
    initializationController = controller;
    const initializationTimer = setTimeout(() => controller.abort(), 20000);
    const previousInitialization = initialization;
    const previousSignOut = signedOut;
    const generation = ++sessionGeneration;
    syncController?.abort();
    registeredUserId = null;
    promotionPreview = null;
    promotionOperationId = null;
    setState({ status: "INITIALIZING", userId, guestCardCount: 0 });
    signedOut = null;
    initializingUserId = userId;
    initialization = (async () => {
      await previousInitialization?.catch(() => null);
      await previousSignOut?.catch(() => null);
      if (promotionInFlight) await promotionInFlight.catch(() => null);
      if (syncInFlight) await syncInFlight.catch(() => null);
      assertSession(generation);
      let guestOwnerId = null;
      let guestCardCount = 0;
      let accountOwnerId = null;
      try {
        const now = String(clock.now());
        const identity = await repository.ensureInstallationIdentity({ uuid: uuid(), now });
        assertSession(generation);
        guestOwnerId = identity.guestOwner.id;
        const activeOwner = await repository.getActiveOwner();
        assertSession(generation);
        if (activeOwner?.kind === "ACCOUNT" && activeOwner.userId !== userId) {
          await repository.activateOwner({ ownerId: guestOwnerId, now });
        }
        guestCardCount = Number(await repository.countCompleteCards(guestOwnerId)) || 0;
        assertSession(generation);
        setState({ status: "INITIALIZING", userId, guestOwnerId, guestCardCount });

        const accountOwner = await repository.ensureAccountOwner({ userId, now });
        accountOwnerId = accountOwner.id;
        let deviceState = await readDeviceSyncState(accountOwner.id);
        assertSession(generation);
        if (!deviceState) {
          deviceState = {
            ownerId: accountOwner.id,
            userId,
            installationId: identity.installationId,
            deviceId: String(uuid()).toLowerCase(),
            lastSyncSeq: 0,
            updatedAt: now,
          };
          await writeDeviceSyncState(deviceState);
        }

        assertSession(generation);
        const profile = await gateway.ensureUserProfile(profileInput(input), { signal: controller.signal });
        assertSession(generation);
        if (profile.userId !== userId) fail("SYNC_OWNER_CHANGED", "Profile belongs to a different session");
        const remoteDevice = await gateway.registerDevice({
          deviceId: deviceState.deviceId,
          installationId: identity.installationId,
          platform,
          appVersion,
        }, { signal: controller.signal });
        assertSession(generation);
        const committedDeviceState = {
          ...deviceState,
          deviceId: remoteDevice.id,
          installationId: remoteDevice.installationId,
          lastSyncSeq: deviceState.lastSyncSeq,
          updatedAt: String(clock.now()),
        };
        await writeDeviceSyncState(committedDeviceState);
        assertSession(generation);
        const recovered = await promotion.recoverPromotion({ accountOwnerId: accountOwner.id, assertCurrent: () => assertSession(generation) });
        assertSession(generation);
        if (recovered.length > 0) {
          const recoveredIdentity = await repository.ensureInstallationIdentity({ uuid: uuid(), now: String(clock.now()) });
          assertSession(generation);
          guestOwnerId = recoveredIdentity.guestOwner.id;
          guestCardCount = Number(await repository.countCompleteCards(guestOwnerId)) || 0;
        }
        assertSession(generation);
        await repository.activateOwner({ ownerId: accountOwner.id, now: String(clock.now()) });
        assertSession(generation);
        registeredUserId = userId;
        return setState({
          status: guestCardCount > 0 ? "PROMOTION_AVAILABLE" : "ACCOUNT_READY",
          userId,
          accountOwnerId: accountOwner.id,
          guestOwnerId,
          guestCardCount,
          installationId: identity.installationId,
          deviceId: committedDeviceState.deviceId,
          lastSyncSeq: committedDeviceState.lastSyncSeq,
        });
      } catch {
        assertSession(generation);
        setState({
          status: "INITIALIZATION_FAILED",
          userId,
          accountOwnerId,
          guestOwnerId,
          guestCardCount,
          errorCode: "ACCOUNT_INITIALIZATION_FAILED",
        });
        fail("ACCOUNT_INITIALIZATION_FAILED", "Memory account initialization failed");
      }
    })().finally(() => {
      clearTimeout(initializationTimer);
      if (generation === sessionGeneration) { initialization = null; initializingUserId = null; }
    });
    return initialization;
  };

  const handleSignedOut = async () => {
    initializationController?.abort();
    syncController?.abort();
    if (signedOut) return signedOut;
    const previousInitialization = initialization;
    const generation = ++sessionGeneration;
    initialization = null;
    initializingUserId = null;
    registeredUserId = null;
    promotionPreview = null;
    promotionOperationId = null;
    setState({ status: "INITIALIZING", guestCardCount: 0 });
    signedOut = (async () => {
      await previousInitialization?.catch(() => null);
      if (promotionInFlight) await promotionInFlight.catch(() => null);
      if (syncInFlight) await syncInFlight.catch(() => null);
      assertSession(generation);
      registeredUserId = null;
      const now = String(clock.now());
      const identity = await repository.ensureInstallationIdentity({ uuid: uuid(), now });
      const activeOwner = await repository.getActiveOwner();
      assertSession(generation);
      let guestOwner = identity.guestOwner;
      if (activeOwner?.kind === "ACCOUNT") {
        guestOwner = await repository.activateOwner({ ownerId: identity.guestOwner.id, now });
      }
      assertSession(generation);
      return setState({
        status: "LOCAL_ONLY",
        guestOwnerId: guestOwner?.kind === "GUEST" ? guestOwner.id : null,
        guestCardCount: 0,
      });
    })();
    return signedOut;
  };

  const buildPreview = async () => {
    if (!state.userId || !state.accountOwnerId || !state.guestOwnerId || state.guestCardCount < 1) return null;
    const generation = sessionGeneration;
    const previewToken = ++previewGeneration;
    const manifest = await buildGuestPromotionManifest({ repository, guestOwnerId: state.guestOwnerId });
    assertSession(generation);
    const unresolvedAnimeRefs = await Promise.all(manifest.unresolvedAnimeRefs.map(async (animeRef) => {
      if (typeof input.resolveCatalogBinding !== "function") return { ...animeRef, catalogCandidate: null };
      try {
        const candidate = await input.resolveCatalogBinding(animeRef);
        const exactSource = candidate?.sourceBinding?.provider === animeRef.sourceBinding?.provider
          && String(candidate?.sourceBinding?.externalId || "") === String(animeRef.sourceBinding?.externalId || "");
        return { ...animeRef, catalogCandidate: exactSource && candidate?.animeId ? structuredClone(candidate) : null };
      } catch {
        return { ...animeRef, catalogCandidate: null };
      }
    }));
    assertSession(generation);
    if (previewToken !== previewGeneration) fail("PROMOTION_PREVIEW_CANCELLED", "Promotion preview was cancelled");
    promotionPreview = Object.freeze({ ...manifest, unresolvedAnimeRefs: Object.freeze(unresolvedAnimeRefs) });
    return clone(promotionPreview);
  };

  const promote = async ({ titleChoices = [] } = {}) => {
    if (promotionInFlight) return promotionInFlight;
    const generation = sessionGeneration;
    promotionInFlight = (async () => {
      const preview = promotionPreview;
      assertSession(generation);
      if (!preview) return null;
      const context = {
        userId: state.userId,
        guestOwnerId: state.guestOwnerId,
        accountOwnerId: state.accountOwnerId,
        deviceId: state.deviceId,
      };
      const currentManifest = await buildGuestPromotionManifest({ repository, guestOwnerId: context.guestOwnerId });
      assertSession(generation);
      if (currentManifest.sourceHash !== preview.sourceHash) fail("PROMOTION_SOURCE_HASH_MISMATCH", "Review changed Guest records before promotion");
      const choicesByAnimeRef = new Map(titleChoices.map((row) => [row.animeRefId, row.choice]));
      await Promise.all(preview.unresolvedAnimeRefs.map((animeRef) => {
        const choice = choicesByAnimeRef.get(animeRef.id);
        if (!choice) fail("PROMOTION_TITLE_CHOICE_REQUIRED", "Every unresolved title needs a choice");
        return resolvePromotionTitleChoice({
          repository,
          guestOwnerId: context.guestOwnerId,
          animeRefId: animeRef.id,
          choice,
          now: String(clock.now()),
        });
      }));
      assertSession(generation);
      const selectedManifest = await buildGuestPromotionManifest({ repository, guestOwnerId: context.guestOwnerId });
      assertSession(generation);
      promotionOperationId ||= String(uuid()).toLowerCase();
      const result = await promotion.execute({
        userId: context.userId,
        guestOwnerId: context.guestOwnerId,
        accountOwnerId: context.accountOwnerId,
        deviceId: context.deviceId,
        operationId: promotionOperationId,
        expectedSourceHash: selectedManifest.sourceHash,
        assertCurrent: () => assertSession(generation),
      });
      assertSession(generation);
      const identity = await repository.ensureInstallationIdentity({ uuid: uuid(), now: String(clock.now()) });
      assertSession(generation);
      promotionPreview = null;
      promotionOperationId = null;
      return setState({
        ...state,
        status: "ACCOUNT_READY",
        guestOwnerId: identity.guestOwner.id,
        guestCardCount: 0,
        lastSyncSeq: state.lastSyncSeq,
      });
    })().finally(() => { promotionInFlight = null; });
    return promotionInFlight;
  };

  const syncNow = async () => {
    if (syncInFlight) return syncInFlight;
    if (!state.userId || !state.accountOwnerId || !state.deviceId) {
      fail("ACCOUNT_SYNC_UNAVAILABLE", "A ready Memory account is required");
    }
    const generation = sessionGeneration;
    syncController = new AbortController();
    const context = { userId: state.userId, ownerId: state.accountOwnerId, deviceId: state.deviceId, signal: syncController.signal };
    const timer = setTimeout(() => syncController?.abort(), 20000);
    syncInFlight = (async () => {
      setState({ ...state, syncBusy: true, syncResultCode: null, syncErrorCode: null });
      const result = await metadataSync.syncNow(context);
      assertSession(generation);
      const conflicts = typeof repository.listOpenSyncConflicts === "function"
        ? await repository.listOpenSyncConflicts(context.ownerId)
        : [];
      const deviceState = await readDeviceSyncState(context.ownerId);
      assertSession(generation);
      return setState({
        ...state,
        syncBusy: false,
        syncResultCode: conflicts.length ? "CONFLICT" : result.status,
        syncErrorCode: result.errorCode || result.push?.lastErrorCode || null,
        conflicts,
        lastSyncSeq: Number(deviceState?.lastSyncSeq ?? state.lastSyncSeq ?? 0),
      });
    })().catch((error) => {
      assertSession(generation);
      setState({ ...state, syncBusy: false, syncResultCode: "ERROR", syncErrorCode: error?.code || "MEMORY_GATEWAY_FAILED" });
      throw error;
    }).finally(() => { clearTimeout(timer); syncInFlight = null; syncController = null; });
    return syncInFlight;
  };

  const resolveConflict = async ({ conflictId, selection }) => {
    const generation = sessionGeneration;
    const ownerId = state.accountOwnerId;
    if (!state.userId || !state.accountOwnerId || !state.deviceId) fail("ACCOUNT_SYNC_UNAVAILABLE", "A ready Memory account is required");
    await resolveMemoryConflict({
      ownerId: state.accountOwnerId,
      userId: state.userId,
      deviceId: state.deviceId,
      conflictId,
      selection,
    });
    assertSession(generation);
    const conflicts = await repository.listOpenSyncConflicts(ownerId);
    assertSession(generation);
    return setState({ ...state, conflicts, syncResultCode: conflicts.length ? "CONFLICT" : "PARTIAL", syncErrorCode: null });
  };

  const exportConflictBackup = async (conflictId) => {
    const generation = sessionGeneration;
    if (!state.accountOwnerId) return null;
    const conflict = await repository.getSyncConflict(state.accountOwnerId, conflictId);
    assertSession(generation);
    return conflict ? clone({
      schemaVersion: 1,
      exportedAt: String(clock.now()),
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      local: conflict.localEntity,
      cloud: conflict.remoteEntity,
    }) : null;
  };

  return Object.freeze({
    enabled: true,
    get status() { return state.status; },
    getState: async () => clone(state),
    initializeAccountSession: initialize,
    handleSignedOut,
    buildPromotionPreview: buildPreview,
    cancelPromotionPreview: () => { previewGeneration++; promotionPreview = null; },
    promote,
    syncNow,
    pauseSync: () => syncController?.abort(),
    resolveConflict,
    exportConflictBackup,
  });
}
