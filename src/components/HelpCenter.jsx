import { useEffect, useState, useRef } from "react";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { getMessageGroup } from "../domain/messages.js";
import { minihomeUiEnabled } from '../features/memory/runtime/platformPublication.js';

function noticeToneClass(kind) {
  if (kind === "important") return "is-important";
  if (kind === "update") return "is-update";
  return "is-notice";
}

export default function HelpCenter() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = getMessageGroup(locale, "helpCenter");
  const sharingHelp = minihomeUiEnabled()
    ? (locale === 'ko' ? '가입 확인을 마친 계정에서 공개 보드를 골라 미니홈에 전시할 수 있습니다. 게시 미리보기와 공개 정책을 확인한 뒤 직접 게시합니다. 비공개 기록은 자동 공개하지 않습니다.' : 'Accounts that complete signup verification can display selected public Boards in a Minihome. Review the preview and sharing policy before publishing. Private records stay private until you explicitly share them.')
    : (locale === 'ko' ? '현재 공개 미니홈 게시를 사용할 수 없습니다. 비공개 기록과 보드는 계속 이용할 수 있습니다.' : 'Publishing a public Minihome is currently unavailable. Private memories and Boards remain available.');
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

      <div className="help-center page-shell page-shell--narrow">
        <section className="surface-card status-panel">
          <div className="pageHeader">
            <h1 className="pageTitle">{copy.title}</h1>
            {copy.lead ? <p className="pageLead">{copy.lead}</p> : null}
          </div>
        </section>

        <details className="surface-card help-center__section"><summary>{copy.noticesTitle}</summary>
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
                <p className="small help-center__notice-body">{notice.id === 'minihome' ? sharingHelp : notice.body}</p>
              </article>
            ))}
          </div>
        </details>

        <section className="surface-card help-center__section">
          <h2 className="sectionTitle">{locale === 'ko' ? '무엇을 하고 싶으세요?' : 'What would you like to do?'}</h2>
          <div className="help-center__questions">
            {copy.cards.map((card) => (
              <details key={card.title} className="help-center__card">
                <summary>{card.title}</summary>
                <p className="small help-center__card-body">{card.id === 'minihome' ? sharingHelp : card.body}</p>
                <a href={`${base}${card.href}`}>{locale === 'ko' ? '열기 →' : 'Open →'}</a>
              </details>
            ))}
          </div>
        </section>

        <details className="surface-card help-center__section"><summary>{copy.tipsTitle}</summary>
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
                <p className="small help-center__about-text"><a href={`mailto:${copy.aboutVisionText}`}>{copy.aboutVisionText}</a></p>
                <p className="small help-center__about-text">{copy.supportScope}</p>
              </article>
            </div>
            <div className="help-center__about-actions">
              <button type="button" className="btn btn--subtle" onClick={onCopyFeedbackMessage}>
                <span className="btn__label">{copy.aboutCopyButton}</span>
              </button>
            </div>
            {copyMessage ? <p className="small help-center__about-copy-message">{copyMessage}</p> : null}
          </div>
        </details>
      </div>
    </div>
  );
}
