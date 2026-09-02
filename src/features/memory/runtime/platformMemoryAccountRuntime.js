import {
  isMemoryAccountSyncEnabled,
  isSupabaseConfigured,
  supabase,
} from "../../../lib/supabaseClient.js";
import { IndexedDbMemoryRepository } from "../adapters/indexeddb/IndexedDbMemoryRepository.js";
import {
  readDeviceSyncState,
  writeDeviceSyncState,
} from "../adapters/indexeddb/memorySyncStore.js";
import { SupabaseMemoryGateway } from "../adapters/supabase/SupabaseMemoryGateway.js";
import { createMemoryAccountRuntime } from "./createMemoryAccountRuntime.js";

let runtimePromise;

const browserLocale = () => {
  const value = String(document?.documentElement?.lang || navigator?.language || "en").toLowerCase();
  return value.startsWith("ko") ? "ko" : "en";
};

const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const disabledRuntime = () => createMemoryAccountRuntime({ enabled: false });

export function getPlatformMemoryAccountRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const testAdapters = import.meta.env.DEV
      ? globalThis.__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__
      : null;
    if (testAdapters?.enabled) {
      return createMemoryAccountRuntime({
        ...testAdapters,
        enabled: true,
      });
    }
    if (!isMemoryAccountSyncEnabled || !isSupabaseConfigured || !supabase) return disabledRuntime();

    const repository = await IndexedDbMemoryRepository.open();
    return createMemoryAccountRuntime({
      enabled: true,
      repository,
      gateway: new SupabaseMemoryGateway(supabase),
      readDeviceSyncState: (ownerId) => readDeviceSyncState(repository.database, ownerId),
      writeDeviceSyncState: (state) => writeDeviceSyncState(repository.database, state),
      uuid: () => globalThis.crypto.randomUUID(),
      clock: { now: () => new Date().toISOString() },
      platform: "WEB",
      appVersion: String(import.meta.env.PUBLIC_APP_VERSION || "web-v1"),
      locale: browserLocale(),
      timeZone: browserTimeZone(),
      resolveCatalogBinding: async (animeRef) => {
        const { getPlatformTitleResolver } = await import("./platformTitleResolver.js");
        const response = await getPlatformTitleResolver().search(animeRef.displayTitle);
        return (response?.results || []).find((candidate) => (
          candidate?.animeId
          && candidate?.sourceBinding?.provider === animeRef.sourceBinding?.provider
          && String(candidate?.sourceBinding?.externalId || "") === String(animeRef.sourceBinding?.externalId || "")
        )) || null;
      },
    });
  })().catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}
