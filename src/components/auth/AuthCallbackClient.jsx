import { useEffect, useState } from "react";
import {
  consumePendingAuthNext,
  exchangeCodeForSession,
  startExistingGoogleOAuth,
} from "../../repositories/authRepo.js";
import { parseWebOAuthCallback, resolveWebOAuthNext } from "../../features/auth/webOAuth.js";
import { useUiPreferences } from "../../hooks/useUiPreferences.js";

const CALLBACK_MESSAGES = Object.freeze({
  IMPLICIT_TOKEN_REJECTED: ["로그인을 완료하지 못했습니다. 다시 로그인해 주세요.", "Sign-in could not be completed. Please try again."],
  OAUTH_PROVIDER_ERROR: ["로그인이 취소되었거나 완료되지 않았습니다. 다시 시도해 주세요.", "Sign-in was cancelled or could not be completed. Please try again."],
  AUTH_CODE_MISSING: ["로그인을 다시 시작해 주세요.", "Please start sign-in again."],
  AUTH_CODE_INVALID: ["로그인을 다시 시작해 주세요.", "Please start sign-in again."],
  PKCE_EXCHANGE_FAILED: ["로그인을 확인하지 못했습니다. 같은 브라우저에서 다시 시도해 주세요.", "Your sign-in could not be verified. Try again in this browser."],
  SIGN_IN_START_FAILED: ["로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.", "Unable to start sign-in. Please try again shortly."],
});

const errorCode = (error) => Object.hasOwn(CALLBACK_MESSAGES, error?.code) ? error.code : "PKCE_EXCHANGE_FAILED";

export default function AuthCallbackClient({ base = "/" }) {
  const {locale, setLocale} = useUiPreferences();
  const ko = locale === 'ko', t = (korean, english) => ko ? korean : english;
  const [failure, setFailure] = useState(null);
  const [returnPath, setReturnPath] = useState(`${base}data/`);
  const [retrying, setRetrying] = useState(false);
  const signupEnabled = import.meta.env.PUBLIC_SIMPLE_SIGNUP_V1 === '1';

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
          setFailure(code);
        }
      }
    }

    run().catch((error) => {
      const code = errorCode(error);
      console.error("auth callback failed", { code });
      if (alive) {
        setFailure(code);
      }
    });

    return () => {
      alive = false;
    };
  }, [base]);

  return <section className="signup-panel" lang={locale}>
    <div className="signup-heading"><span>MOEMOA</span><button type="button" disabled={retrying} onClick={() => setLocale(ko ? 'en' : 'ko')}>{ko ? 'English' : '한국어'}</button></div>
    <h1>{t('Google 로그인', 'Google sign-in')}</h1>
    <p id="sync-callback-message" role={failure ? "alert" : "status"}>{failure ? CALLBACK_MESSAGES[failure][ko ? 0 : 1] : t('로그인하고 있습니다…', 'Signing you in…')}</p>
    {failure && <button className="signup-primary" disabled={retrying} onClick={async () => {
      setRetrying(true);
      try { await startExistingGoogleOAuth(returnPath); }
      catch { setFailure('SIGN_IN_START_FAILED'); }
      finally { setRetrying(false); }
    }}>{retrying ? t('Google로 이동 중…', 'Opening Google…') : t('다시 로그인', 'Retry sign-in')}</button>}
    {failure && signupEnabled && <p>{t('처음 이용하시나요? ', 'New to MOEMOA? ')}<a href={`${base}auth/start/?next=${encodeURIComponent(returnPath)}`}>{t('가입하기', 'Create an account')}</a></p>}
    {failure && <p><a className="signup-back" href={`${base}data/`}>{t('로그인 화면으로', 'Back to sign-in')}</a></p>}
    {failure && returnPath !== `${base}data/` && <p><a className="signup-back" href={returnPath}>{t('원래 페이지로', 'Return to page')}</a></p>}
  </section>;
}
