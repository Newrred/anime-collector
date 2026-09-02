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
});

const requireDependencies = (input) => {
  const requiredRepository = [
    "ensureInstallationIdentity",
    "getActiveOwner",
    "ensureAccountOwner",
    "activateOwner",
    "rotateGuestOwnerAfterPromotion",
    "countCompleteCards",
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

  const setState = (next) => {
    state = Object.freeze({ enabled: true, errorCode: null, ...next });
    return clone(state);
  };

  const initialize = async (session) => {
    const userId = String(session?.user?.id || "").toLowerCase();
    if (!USER_UUID.test(userId)) fail("AUTH_SESSION_INVALID", "A valid account session is required");
    if (registeredUserId === userId && ["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(state.status)) {
      return clone(state);
    }
    if (initialization && initializingUserId === userId) return initialization;

    signedOut = null;
    initializingUserId = userId;
    initialization = (async () => {
      let guestOwnerId = null;
      let guestCardCount = 0;
      let accountOwnerId = null;
      try {
        const now = String(clock.now());
        const identity = await repository.ensureInstallationIdentity({ uuid: uuid(), now });
        guestOwnerId = identity.guestOwner.id;
        const activeOwner = await repository.getActiveOwner();
        if (activeOwner?.kind === "ACCOUNT" && activeOwner.userId !== userId) {
          await repository.activateOwner({ ownerId: guestOwnerId, now });
        }
        guestCardCount = Number(await repository.countCompleteCards(guestOwnerId)) || 0;
        setState({ status: "INITIALIZING", userId, guestOwnerId, guestCardCount });

        const accountOwner = await repository.ensureAccountOwner({ userId, now });
        accountOwnerId = accountOwner.id;
        let deviceState = await readDeviceSyncState(accountOwner.id);
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

        await gateway.ensureUserProfile(profileInput(input));
        const remoteDevice = await gateway.registerDevice({
          deviceId: deviceState.deviceId,
          installationId: identity.installationId,
          platform,
          appVersion,
        });
        const committedDeviceState = {
          ...deviceState,
          deviceId: remoteDevice.id,
          installationId: remoteDevice.installationId,
          lastSyncSeq: remoteDevice.lastSyncSeq,
          updatedAt: String(clock.now()),
        };
        await writeDeviceSyncState(committedDeviceState);
        await repository.activateOwner({ ownerId: accountOwner.id, now: String(clock.now()) });
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
      initialization = null;
      initializingUserId = null;
    });
    return initialization;
  };

  const handleSignedOut = async () => {
    if (signedOut) return signedOut;
    signedOut = (async () => {
      registeredUserId = null;
      const now = String(clock.now());
      await repository.ensureInstallationIdentity({ uuid: uuid(), now });
      const activeOwner = await repository.getActiveOwner();
      let guestOwner = activeOwner;
      if (activeOwner?.kind === "ACCOUNT") {
        guestOwner = await repository.rotateGuestOwnerAfterPromotion({ uuid: uuid(), now });
      }
      return setState({
        status: "LOCAL_ONLY",
        guestOwnerId: guestOwner?.kind === "GUEST" ? guestOwner.id : null,
        guestCardCount: 0,
      });
    })();
    return signedOut;
  };

  return Object.freeze({
    enabled: true,
    get status() { return state.status; },
    getState: async () => clone(state),
    initializeAccountSession: initialize,
    handleSignedOut,
    buildPromotionPreview: async () => null,
    promote: async () => null,
    syncNow: async () => null,
  });
}
