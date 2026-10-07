const LOCK_NAME = "moemoa:title-state-local-mutation";
let queue = Promise.resolve();

// Serializes local title/log commits with a sync pull in this tab. Web Locks also
// cover other tabs where supported; the queue remains the fallback on older WebViews.
export function withTitleStateMutation(task) {
  const run = () => globalThis.navigator?.locks?.request
    ? globalThis.navigator.locks.request(LOCK_NAME, { mode: "exclusive" }, task)
    : task();
  const result = queue.then(run);
  queue = result.catch(() => {});
  return result;
}
