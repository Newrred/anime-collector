import { useEffect, useLayoutEffect, useRef } from "react";

export function useUnsavedNavigation(dirty, locale = "ko", { busy = false } = {}) {
  const state = useRef({ dirty, locale, busy });
  useLayoutEffect(() => { state.current = { dirty, locale, busy }; }, [dirty, locale, busy]);
  const leaving = useRef(false);
  const accepted = useRef(null), restoring = useRef(false);
  useLayoutEffect(() => { accepted.current = { href: location.href, index: history.state?.index }; });
  useEffect(() => {
    if (!dirty && !busy) return undefined;
    const beforeUnload = (event) => {
      if ((!state.current.dirty && !state.current.busy) || leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event) => {
      if ((!state.current.dirty && !state.current.busy) || leaving.current || event.defaultPrevented
        || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
      if (state.current.busy) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (confirm(state.current.locale === 'ko'
        ? '저장하지 않은 내용이 있어요. 저장하지 않고 이동할까요?'
        : 'You have unsaved changes. Leave without saving?')) leaving.current = true;
      else { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const onPageShow = () => { leaving.current = false; };
    const onIntent = event => {
      if ((!state.current.dirty && !state.current.busy) || leaving.current || event.defaultPrevented) return;
      if (state.current.busy || !confirm(state.current.locale === 'ko'
        ? '저장하지 않은 내용이 있어요. 저장하지 않고 이동할까요?'
        : 'You have unsaved changes. Leave without saving?')) event.preventDefault();
      else leaving.current = true;
    };
    const onPop = event => {
      if (restoring.current) { restoring.current = false; event.stopImmediatePropagation(); return; }
      if ((!state.current.dirty && !state.current.busy) || leaving.current) return;
      const previous = accepted.current, nextIndex = event.state?.index;
      if (!previous || !Number.isFinite(previous.index) || !Number.isFinite(nextIndex) || previous.index === nextIndex) return;
      const from = new URL(previous.href), to = new URL(location.href);
      if (from.pathname === to.pathname && from.search === to.search) { accepted.current = { href: to.href, index: nextIndex }; return; }
      if (state.current.busy || !confirm(state.current.locale === 'ko'
        ? '저장하지 않은 내용이 있어요. 저장하지 않고 이동할까요?'
        : 'You have unsaved changes. Leave without saving?')) {
        event.stopImmediatePropagation(); restoring.current = true;
        history.go(previous.index - nextIndex);
      } else leaving.current = true;
    };
    window.addEventListener('beforeunload', beforeUnload);
    // Run before the document-level native navigation adapter.
    window.addEventListener('click', onClick, true);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('moemoa:before-navigate', onIntent);
    // Cancel traversal before Astro handles it, then restore the same history entry.
    window.addEventListener('popstate', onPop, true);
    document.addEventListener('astro:page-load', onPageShow);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('moemoa:before-navigate', onIntent);
      window.removeEventListener('popstate', onPop, true);
      document.removeEventListener('astro:page-load', onPageShow);
    };
  }, [dirty, busy]);
  return () => { leaving.current = true; };
}
