function normalizeUserId(value) {
  const userId = String(value || "").trim();
  return userId || null;
}

export function createSyncOperationCoordinator(initialUserId = null) {
  let currentUserId = normalizeUserId(initialUserId);
  let generation = 0;

  function updateUserId(nextUserId) {
    const normalized = normalizeUserId(nextUserId);
    if (normalized === currentUserId) return generation;
    currentUserId = normalized;
    generation += 1;
    return generation;
  }

  function begin(userId = currentUserId, operation = "sync") {
    return {
      generation,
      userId: normalizeUserId(userId),
      operation: String(operation || "sync"),
    };
  }

  function isCurrent(token) {
    return Boolean(
      token &&
      token.generation === generation &&
      token.userId === currentUserId,
    );
  }

  async function runMutation(token, mutation) {
    if (!isCurrent(token)) {
      return { executed: false, stale: true, value: null };
    }
    const value = await mutation();
    return { executed: true, stale: false, value };
  }

  return {
    updateUserId,
    begin,
    isCurrent,
    runMutation,
  };
}
