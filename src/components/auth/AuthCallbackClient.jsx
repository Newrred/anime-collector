import { useEffect, useState } from "react";
import { exchangeCodeForSession, setAuthSession } from "../../repositories/authRepo.js";

function explainAuthError(error, fallbackDescription = "") {
  const raw = String(error?.message || fallbackDescription || error || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("pkce code verifier not found")) {
    return "PKCE verifier is missing. Start login again from the same origin. Do not mix localhost and 127.0.0.1, clear site data for both, then retry.";
  }

  if (lower.includes("bad_code_verifier") || lower.includes("code verifier")) {
    return "The saved PKCE verifier does not match. Start login again from the same origin and retry.";
  }

  return raw || "Failed to complete sign-in.";
}

function resolveSafeNext(rawNext, base = "/") {
  const fallback = new URL(`${base}data/`, window.location.origin);
  const next = String(rawNext || "").trim();
  if (!next) return `${fallback.pathname}${fallback.search}${fallback.hash}`;

  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) {
      return `${fallback.pathname}${fallback.search}${fallback.hash}`;
    }

    const normalizedBase = String(base || "/").endsWith("/") ? String(base || "/") : `${String(base || "/")}/`;
    if (normalizedBase !== "/" && !url.pathname.startsWith(normalizedBase)) {
      return `${fallback.pathname}${fallback.search}${fallback.hash}`;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `${fallback.pathname}${fallback.search}${fallback.hash}`;
  }
}

export default function AuthCallbackClient({ base = "/" }) {
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    let alive = true;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = params.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorDescription =
        params.get("error_description") ||
        hashParams.get("error_description") ||
        "";
      const next = resolveSafeNext(params.get("next"), base);

      try {
        if (errorDescription) throw new Error(errorDescription);

        if (code) {
          await exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await setAuthSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else {
          throw new Error("Missing authorization response");
        }

        window.location.replace(next);
      } catch (error) {
        console.error("auth callback failed", error);
        if (alive) {
          setMessage(explainAuthError(error, errorDescription));
        }
      }
    }

    run().catch((error) => {
      console.error("auth callback failed", error);
      if (alive) {
        setMessage(explainAuthError(error));
      }
    });

    return () => {
      alive = false;
    };
  }, [base]);

  return <p className="pageLead" id="sync-callback-message">{message}</p>;
}
