import { useAuthSession } from "./useAuthSession.js";
import { useMemoryAccountSync } from "./useMemoryAccountSync.js";

export function useMemoryOwnerBoundary() {
  const auth = useAuthSession();
  const account = useMemoryAccountSync({ session: auth.session, authLoading: auth.loading });
  return {
    ready: !auth.loading && !account.loading && ["LOCAL_ONLY", "ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(account.status),
    failed: account.status === "INITIALIZATION_FAILED",
    ownerKey: account.accountOwnerId || account.guestOwnerId || "local",
  };
}
