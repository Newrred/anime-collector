export function installNavigationLifecycle(documentRef = document) {
  let stopWaiting = () => {};
  const prepare = event => {
    stopWaiting();
    const content = documentRef.querySelector("[data-app-content]");
    const link = event.sourceElement?.closest?.("a[href]");
    if (!content) return;
    const restore = () => {
      content.inert = false; content.removeAttribute("aria-busy");
      link?.removeAttribute("data-navigation-pending");
      event.signal.removeEventListener("abort", restore);
    };
    content.inert = true; content.setAttribute("aria-busy", "true");
    link?.setAttribute("data-navigation-pending", "");
    event.signal.addEventListener("abort", restore, { once: true });
    stopWaiting = restore;
  };
  const done = () => { stopWaiting(); stopWaiting = () => {}; };
  documentRef.addEventListener("astro:before-preparation", prepare);
  documentRef.addEventListener("astro:page-load", done);
  return () => { done(); documentRef.removeEventListener("astro:before-preparation", prepare); documentRef.removeEventListener("astro:page-load", done); };
}
