import { useEffect, useState } from "react";
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

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") return;
    try {
      await window.__promptPwaInstall();
    } catch {}
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
          <div className="help-center__tips">
            {copy.tips.map((tip) => (
              <div key={tip} className="small help-center__tip">
                {tip}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
