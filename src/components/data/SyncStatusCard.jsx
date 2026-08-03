import { formatRelativeAgo } from "../../domain/uiText";
import { deriveSyncPresentation } from "../../domain/syncPresentation.js";
import { IconCloud, IconDownload, IconRefreshCw, IconUpload } from "../ui/AppIcons.jsx";

function toneClass(tone) {
  return `is-${tone || "idle"}`;
}

export default function SyncStatusCard({
  locale = "ko",
  copy,
  auth,
  sync,
  onSignIn,
  onSignOut,
}) {
  const connected = Boolean(auth?.session?.user);
  const presentation = deriveSyncPresentation({
    configured: sync.configured,
    connected,
    loading: sync.loading,
    remoteChecked: sync.remoteChecked,
    remoteMissing: sync.remoteMissing,
    status: sync.status,
  });
  const statusLabel = copy.statusLabels?.[presentation.tone] || copy.statusLabels.connected;
  const accountLabel = presentation.accountState === "connected"
    ? auth.user?.email || copy.accountStates?.connected || copy.connected
    : copy.accountStates?.[presentation.accountState] || copy.localOnly;
  const remoteLabel = copy.remoteStates?.[presentation.remoteState] || copy.remoteEmpty;

  return (
    <section className="surface-card sync-card">
      <div className="sync-card__header">
        <div className="pageHeader">
          <h2 className="sectionTitle">{copy.title}</h2>
          <p className="pageLead">{copy.lead}</p>
        </div>
        <div className={`sync-card__status ${toneClass(presentation.tone)}`}>
          <span className={`sync-dot ${toneClass(presentation.tone)}`} aria-hidden />
          <span>{statusLabel}</span>
        </div>
      </div>

      {!sync.configured ? (
        <div className="small page-feedback">{copy.envMissing}</div>
      ) : null}

      <div className="sync-card__grid">
        <div className="sync-card__cell">
          <div className="sync-card__label">{copy.account}</div>
          <div className="sync-card__value">{accountLabel}</div>
        </div>
        <div className="sync-card__cell">
          <div className="sync-card__label">{copy.lastSync}</div>
          <div className="sync-card__value">{formatRelativeAgo(Date.parse(sync.meta.lastSyncedAt || ""), locale, copy.noSync)}</div>
        </div>
        <div className="sync-card__cell">
          <div className="sync-card__label">{copy.pending}</div>
          <div className="sync-card__value">{sync.meta.pending ? copy.pendingYes : copy.pendingNo}</div>
        </div>
        <div className="sync-card__cell">
          <div className="sync-card__label">{copy.remote}</div>
          <div className="sync-card__value">{remoteLabel}</div>
        </div>
      </div>

      {sync.meta.lastError ? <div className="small page-feedback">{sync.meta.lastError}</div> : null}

      <div className="sync-card__actions">
        {connected ? (
          <>
            {presentation.showSyncActions ? (
              <>
                <button type="button" className="btn" onClick={sync.syncNow} disabled={sync.syncing || sync.loading}>
                  <span className="btn__icon"><IconRefreshCw size={14} /></span>
                  <span className="btn__label">{copy.syncNow}</span>
                </button>
                {sync.needsInitialUpload ? (
                  <button type="button" className="btn btn--subtle" onClick={sync.keepLocalVersion} disabled={sync.syncing}>
                    <span className="btn__icon"><IconUpload size={14} /></span>
                    <span className="btn__label">{copy.uploadLocal}</span>
                  </button>
                ) : null}
                {sync.canDownloadRemote ? (
                  <button type="button" className="btn btn--subtle" onClick={sync.useCloudVersion} disabled={sync.syncing}>
                    <span className="btn__icon"><IconDownload size={14} /></span>
                    <span className="btn__label">{copy.downloadRemote}</span>
                  </button>
                ) : null}
              </>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={onSignOut}>
              <span className="btn__icon"><IconCloud size={14} /></span>
              <span className="btn__label">{copy.disconnect}</span>
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={onSignIn} disabled={!sync.configured || auth.loading}>
            <span className="btn__icon"><IconCloud size={14} /></span>
            <span className="btn__label">{copy.signIn}</span>
          </button>
        )}
      </div>
    </section>
  );
}
