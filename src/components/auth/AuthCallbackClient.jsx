import { useEffect, useState } from "react";
import {
  consumePendingAuthNext,
  exchangeCodeForSession,
} from "../../repositories/authRepo.js";
import { parseWebOAuthCallback } from "../../features/auth/webOAuth.js";

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

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const callback = parseWebOAuthCallback({
          search: window.location.search,
          hash: window.location.hash,
          origin: window.location.origin,
          base,
          pendingNext: consumePendingAuthNext(),
        });
        await exchangeCodeForSession(callback.code);
        window.location.replace(callback.next);
      } catch (error) {
        const code = errorCode(error);
        console.error("auth callback failed", { code });
        if (alive) {
          setMessage(CALLBACK_MESSAGES[code]);
        }
      }
    }

    run().catch((error) => {
      const code = errorCode(error);
      console.error("auth callback failed", { code });
      if (alive) {
        setMessage(CALLBACK_MESSAGES[code]);
      }
    });

    return () => {
      alive = false;
    };
  }, [base]);

  return <p className="pageLead" id="sync-callback-message">{message}</p>;
}
