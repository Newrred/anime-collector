export function deriveOnboardingState({ itemCount = 0, logCount = 0, memoryCardCount = 0 } = {}) {
  const items = Math.max(0, Number(itemCount) || 0);
  const logs = Math.max(0, Number(logCount) || 0);
  const memoryCards = Math.max(0, Number(memoryCardCount) || 0);
  if (memoryCards > 0) return { stage: "active", primaryAction: "open-archive" };
  if (items === 0) return { stage: "add-first-title", primaryAction: "add-title" };
  if (logs === 0) return { stage: "write-first-log", primaryAction: "write-log" };
  if (items < 3) return { stage: "add-three-titles", primaryAction: "add-title" };
  return { stage: "active", primaryAction: "open-library" };
}
