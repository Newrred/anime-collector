import { useLayoutEffect, useState } from "react";
import { createSyncOperationCoordinator } from "../services/syncOperationCoordinator.js";

export function useCommittedSyncOperationCoordinator(currentUserId) {
  const [coordinator] = useState(() => createSyncOperationCoordinator(currentUserId));

  useLayoutEffect(() => {
    coordinator.updateUserId(currentUserId);
  }, [coordinator, currentUserId]);

  return coordinator;
}
