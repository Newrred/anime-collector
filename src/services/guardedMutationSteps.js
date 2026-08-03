function isAllowed(canMutate) {
  if (typeof canMutate !== "function") return true;
  try {
    return canMutate() !== false;
  } catch {
    return false;
  }
}

export async function runGuardedMutationSteps({ canMutate, steps = [], onComplete }) {
  for (const step of steps) {
    if (!isAllowed(canMutate)) {
      return { completed: false, stale: true, value: null };
    }
    await step();
  }

  if (!isAllowed(canMutate)) {
    return { completed: false, stale: true, value: null };
  }

  const value = typeof onComplete === "function" ? await onComplete() : null;
  return { completed: true, stale: false, value };
}
