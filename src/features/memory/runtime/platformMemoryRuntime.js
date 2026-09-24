import { IndexedDbMemoryRepository } from "../adapters/indexeddb/IndexedDbMemoryRepository.js";
import { createPlatformImageIntake } from "../adapters/platform/nativeImageIntake.js";
import { createMemoryRuntime } from "./createMemoryRuntime.js";

let runtimePromise;

const selectImageIntake = () => {
  if (import.meta.env.DEV && globalThis.__MOEMOA_TEST_IMAGE_INTAKE__) {
    return globalThis.__MOEMOA_TEST_IMAGE_INTAKE__;
  }
  return createPlatformImageIntake();
};

const selectTitleResolver = () => {
  if (import.meta.env.DEV && globalThis.__MOEMOA_TEST_TITLE_RESOLVER__) {
    return globalThis.__MOEMOA_TEST_TITLE_RESOLVER__;
  }
  return {
    search: async (query) => {
      const { getPlatformTitleResolver } = await import("./platformTitleResolver.js");
      return getPlatformTitleResolver().search(query);
    },
    resolveCover: async (ref) => {
      const { getPlatformTitleResolver } = await import("./platformTitleResolver.js");
      return getPlatformTitleResolver().resolveCover(ref);
    },
  };
};

export function getPlatformMemoryRuntime() {
  if (!runtimePromise) {
    runtimePromise = IndexedDbMemoryRepository.open().then((repository) => createMemoryRuntime({
      repository,
      imageIntake: selectImageIntake(),
      titleResolver: selectTitleResolver(),
      beforeDelete: async (input) => {
        if (!input.ownerId.startsWith("account:")) return;
        const { retirePublicationBeforeDelete } = await import("../application/retirePublicationBeforeDelete.js");
        const { getPublicationServices } = await import("./platformPublication.js");
        const service = getPublicationServices();
        await retirePublicationBeforeDelete({ ...input, gateway: service.gateway, getSession: service.getSession });
        if ((await repository.getActiveOwner())?.id !== input.ownerId) {
          throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
        }
      },
      uuid: () => globalThis.crypto.randomUUID(),
      clock: { now: () => new Date().toISOString() },
      telemetry: {
        track: () => {
          // First slice intentionally keeps analytics disabled until the payload sink is approved.
        },
      },
    })).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}
