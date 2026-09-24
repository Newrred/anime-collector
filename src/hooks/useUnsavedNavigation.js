import { useEffect, useLayoutEffect, useRef } from "react";

export function useUnsavedNavigation(dirty, locale = "ko", { busy = false } = {}) {
  const state = useRef({ dirty, locale, busy });
  useLayoutEffect(() => { state.current = { dirty, locale, busy }; }, [dirty, locale, busy]);
  const leaving = useRef(false);
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
    window.addEventListener('beforeunload', beforeUnload);
    // Run before the document-level native navigation adapter.
    window.addEventListener('click', onClick, true);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [dirty, busy]);
  return () => { leaving.current = true; };
}
