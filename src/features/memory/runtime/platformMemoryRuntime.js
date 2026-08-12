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

export function getPlatformMemoryRuntime() {
  if (!runtimePromise) {
    runtimePromise = IndexedDbMemoryRepository.open().then((repository) => createMemoryRuntime({
      repository,
      imageIntake: selectImageIntake(),
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
