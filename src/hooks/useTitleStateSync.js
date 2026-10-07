import { useCallback, useEffect, useRef, useState } from "react";
import { isTitleStateSyncEnabled } from "../lib/supabaseClient.js";
import { resolveTitleStateConflict, syncTitleState } from "../features/titles/application/titleStateSync.js";

const initial = { busy: false, result: null, error: null };

export function useTitleStateSync({ session, autoSync = false } = {}) {
  const userId = session?.user?.id || null;
  const [state, setState] = useState(initial);
  const activeUser = useRef(userId);
  activeUser.current = userId;

  const runNow = useCallback(async ({ allowPromotion = false } = {}) => {
    if (!isTitleStateSyncEnabled || !userId || navigator.onLine === false) return null;
    setState(current => ({ ...current, busy: true, error: null }));
    try {
      const result = await syncTitleState(userId, { allowPromotion });
      if (activeUser.current === userId) setState({ busy: false, result, error: null });
      return result;
    } catch (error) {
      if (activeUser.current === userId) setState({ busy: false, result: null, error: error?.message || "TITLE_SYNC_FAILED" });
      return null;
    }
  }, [userId]);

  const resolveConflict = useCallback(async (conflict, choice) => {
    if (!userId) return null;
    setState(current => ({ ...current, busy: true, error: null }));
    try {
      await resolveTitleStateConflict(userId, conflict, choice);
      return await runNow();
    } catch (error) {
      if (activeUser.current === userId) setState(current => ({ ...current, busy: false, error: error?.message || "TITLE_SYNC_FAILED" }));
      return null;
    }
  }, [userId, runNow]);

  useEffect(() => { setState(initial); }, [userId]);

  useEffect(() => {
    if (!autoSync || !isTitleStateSyncEnabled || !userId) return undefined;
    let timer = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (document.visibilityState !== "hidden") runNow();
      }, 1200);
    };
    schedule();
    const interval = setInterval(schedule, 45000);
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    window.addEventListener("moemoa:library-updated", schedule);
    window.addEventListener("moemoa:bookshelf-updated", schedule);
    window.addEventListener("ani:sync-meta-change", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
      window.removeEventListener("moemoa:library-updated", schedule);
      window.removeEventListener("moemoa:bookshelf-updated", schedule);
      window.removeEventListener("ani:sync-meta-change", schedule);
    };
  }, [autoSync, userId, runNow]);

  return { enabled: isTitleStateSyncEnabled, ...state, runNow, resolveConflict };
}
