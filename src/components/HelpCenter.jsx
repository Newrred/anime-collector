import { useEffect, useState, useRef } from "react";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getMessageGroup } from "../domain/messages.js";

function noticeToneClass(kind) {
  if (kind === "important") return "is-important";
  if (kind === "update") return "is-update";
  return "is-notice";
}

export default function HelpCenter() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = getMessageGroup(locale, "helpCenter");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const copyMessageTimeoutRef = useRef(null);

  useEffect(() => {
    function syncInstallState() {
      setCanInstallPwa(typeof window !== "undefined" && typeof window.__promptPwaInstall === "function");
    }

    function onInstallReady() {
      setCanInstallPwa(true);
    }

    function onInstalled() {
      setCanInstallPwa(false);
    }

    syncInstallState();
    window.addEventListener("pwa-install-ready", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-ready", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  useEffect(() => () => {
    if (copyMessageTimeoutRef.current) clearTimeout(copyMessageTimeoutRef.current);
  }, []);

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") return;
    try {
      await window.__promptPwaInstall();
    } catch {}
  }

  async function onCopyFeedbackMessage() {
    if (typeof window === "undefined" || typeof copy.feedbackCopyTemplate !== "string") return;
    try {
      await navigator.clipboard.writeText(copy.feedbackCopyTemplate);
      setCopyMessage(copy.feedbackCopyOk || "복사했어요.");
    } catch (err) {
      setCopyMessage(copy.feedbackCopyFail || "복사에 실패했어요.");
    } finally {
      if (copyMessageTimeoutRef.current) clearTimeout(copyMessageTimeoutRef.current);
      copyMessageTimeoutRef.current = setTimeout(() => setCopyMessage(""), 2500);
    }
  }

  return (
    <div className="data-grid help-page">
      <TopNavDataMenu
        base={base}
        panelId="help-data-menu-panel"
        canInstallPwa={canInstallPwa}
        currentRoute="help"
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || (locale === "ko" ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onInstallPwa={onClickInstallPwa}
      />

      <div className="help-center">
        <section className="surface-card status-panel">
          <div className="pageHeader">
            <h1 className="pageTitle">{copy.title}</h1>
            <p className="pageLead">{copy.lead}</p>
          </div>
        </section>

        <section className="surface-card help-center__section">
          <div className="pageHeader">
            <h2 className="sectionTitle">{copy.noticesTitle}</h2>
          </div>
          <div className="help-center__notice-list">
            {copy.notices.map((notice) => (
              <article key={`${notice.kind}-${notice.date}-${notice.title}`} className="help-center__notice">
                <div className="help-center__notice-meta">
                  <span className={`help-center__notice-badge ${noticeToneClass(notice.kind)}`}>
                    {copy.noticeKinds?.[notice.kind] || notice.kind}
                  </span>
                  <span className="small help-center__notice-date">{notice.date}</span>
                </div>
                <h3 className="help-center__notice-title">{notice.title}</h3>
                <p className="small help-center__notice-body">{notice.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-card help-center__section">
          <div className="help-center__grid">
            {copy.cards.map((card) => (
              <article key={card.title} className="help-center__card">
                <h2 className="sectionTitle help-center__card-title">{card.title}</h2>
                <p className="small help-center__card-body">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-card help-center__section">
          <div className="pageHeader">
            <h2 className="sectionTitle">{copy.tipsTitle}</h2>
          </div>
          <div className="help-center__about">
            <p className="small help-center__about-subtitle">{copy.aboutSubtitle}</p>
            <p className="small help-center__about-intro">{copy.aboutIntro}</p>
            <div className="help-center__grid help-center__about-grid">
              <article className="help-center__about-card">
                <h3 className="sectionTitle help-center__about-title">{copy.aboutCreatorTitle}</h3>
                <p className="small help-center__about-text">{copy.aboutCreatorText}</p>
              </article>
              <article className="help-center__about-card">
                <h3 className="sectionTitle help-center__about-title">{copy.aboutVisionTitle}</h3>
                <p className="small help-center__about-text">{copy.aboutVisionText}</p>
              </article>
            </div>
            <div className="help-center__about-actions">
              <button type="button" className="btn btn--subtle" onClick={onCopyFeedbackMessage}>
                <span className="btn__label">{copy.aboutCopyButton}</span>
              </button>
            </div>
            {copyMessage ? <p className="small help-center__about-copy-message">{copyMessage}</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
