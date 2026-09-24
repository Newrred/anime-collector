import { useEffect, useState } from "react";
import {
  consumePendingAuthNext,
  exchangeCodeForSession,
  signInWithGoogle,
} from "../../repositories/authRepo.js";
import { parseWebOAuthCallback, resolveWebOAuthNext } from "../../features/auth/webOAuth.js";

const CALLBACK_MESSAGES = Object.freeze({
  IMPLICIT_TOKEN_REJECTED: "This sign-in response is no longer accepted. Start Google sign-in again.",
  OAUTH_PROVIDER_ERROR: "Google sign-in was cancelled or could not be completed. Please try again.",
  AUTH_CODE_MISSING: "The one-time sign-in code is missing. Start Google sign-in again.",
  AUTH_CODE_INVALID: "The one-time sign-in code is invalid. Start Google sign-in again.",
  PKCE_EXCHANGE_FAILED: "The one-time sign-in code could not be verified. Start again from the same browser.",
});

const errorCode = (error) => CALLBACK_MESSAGES[error?.code] ? error.code : "PKCE_EXCHANGE_FAILED";

export default function AuthCallbackClient({ base = "/" }) {
  const [message, setMessage] = useState("Signing you in...");
  const [failed, setFailed] = useState(false);
  const [returnPath, setReturnPath] = useState(`${base}data/`);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      const search = window.location.search, hash = window.location.hash;
      const pendingNext = consumePendingAuthNext();
      const next = resolveWebOAuthNext({ rawNext: new URLSearchParams(search).get("next"), pendingNext, origin: window.location.origin, base });
      setReturnPath(next);
      // Remove provider codes and errors from history before any network exchange.
      window.history.replaceState(null, "", window.location.pathname);
      try {
        const callback = parseWebOAuthCallback({
          search,
          hash,
          origin: window.location.origin,
          base,
          pendingNext,
        });
        const session = await exchangeCodeForSession(callback.code);
        if (!session?.user?.id) throw new Error("PKCE_EXCHANGE_FAILED");
        if (alive) window.location.replace(callback.next);
      } catch (error) {
        const code = errorCode(error);
        console.error("auth callback failed", { code });
        if (alive) {
          setFailed(true);
          setMessage(CALLBACK_MESSAGES[code]);
        }
      }
    }

    run().catch((error) => {
      const code = errorCode(error);
      console.error("auth callback failed", { code });
      if (alive) {
        setFailed(true);
        setMessage(CALLBACK_MESSAGES[code]);
      }
    });

    return () => {
      alive = false;
    };
  }, [base]);

  return <>
    <p className="pageLead" id="sync-callback-message" role={failed ? "alert" : "status"}>{message}</p>
    {failed && <a className="btn" href={`${base}data/`}>로그인 화면으로 · Back to sign-in</a>}
    {failed && returnPath !== `${base}data/` && <a className="btn btn--subtle" href={returnPath}>원래 페이지로 · Return to page</a>}
    {failed && <button className="btn" disabled={retrying} onClick={async () => {
      setRetrying(true);
      try { await signInWithGoogle(returnPath); }
      catch { setMessage("로그인을 시작하지 못했습니다. 다시 시도해 주세요. · Unable to start sign-in. Please try again."); }
      finally { setRetrying(false); }
    }}>다시 로그인 · Retry sign-in</button>}
  </>;
}
