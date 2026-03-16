import { useEffect, useState } from "react";
import { getAuthSession, onAuthSessionChange, signInWithGoogle, signOutFromCloud } from "../repositories/authRepo.js";
import { isSupabaseConfigured } from "../lib/supabaseClient.js";

export function useAuthSession(nextPath = "/data/") {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return () => {};
    }

    let alive = true;
    getAuthSession()
      .then((currentSession) => {
        if (!alive) return;
        setSession(currentSession || null);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(String(err?.message || err || ""));
        setLoading(false);
      });

    const unsubscribe = onAuthSessionChange((nextSession) => {
      if (!alive) return;
      setSession(nextSession || null);
      setLoading(false);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  async function signIn(path = nextPath) {
    setError("");
    await signInWithGoogle(path);
  }

  async function signOut() {
    setError("");
    await signOutFromCloud();
    setSession(null);
  }

  return {
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user || null,
    error,
    signIn,
    signOut,
  };
}
