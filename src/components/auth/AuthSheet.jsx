import { IconArrowRight, IconCloud, IconLogOut, IconRefreshCw, IconUser } from "../ui/AppIcons.jsx";
import { shouldShowAuthSheetSyncAction } from "../../domain/syncPresentation.js";

export default function AuthSheet({
  copy,
  session,
  configured,
  loading,
  syncStatus,
  syncing,
  showSyncActions = false,
  onSignIn,
  onSignOut,
  onSyncNow,
  onOpenData,
  embedded = false,
  isDataPage = false,
}) {
  const user = session?.user || null;
  const email = String(user?.email || "").trim();
  const name = String(user?.user_metadata?.name || "").trim();
  const connected = configured && Boolean(user);
  const showSyncNow = shouldShowAuthSheetSyncAction({
    configured,
    connected: Boolean(user),
    showSyncActions,
  });

  return (
    <div
      className={embedded ? "auth-sheet auth-sheet--embedded" : "data-menu-panel auth-sheet"}
      role={embedded ? undefined : "dialog"}
      aria-label={copy.dialogTitle}
    >
      <div className="auth-sheet__header">
        <div className="auth-sheet__avatar">
          {user ? <IconUser size={18} /> : <IconCloud size={18} />}
        </div>
        <div className="auth-sheet__copy">
          <div className="auth-sheet__title">{user ? name || email || copy.connectedTitle : copy.localOnlyTitle}</div>
          {user ? (
            name && email && email !== name ? <div className="small auth-sheet__email">{email}</div> : null
          ) : <div className="small auth-sheet__lead">{copy.localOnlyLead}</div>}
        </div>
      </div>

      {!configured ? (
        <div className="small page-feedback">{copy.envMissing}</div>
      ) : null}

      <div className="auth-sheet__body">
        {connected ? (
          <div className="auth-sheet__status" role="status">
            <span className="auth-sheet__summary-label">{copy.syncLabel}</span>
            <span className="auth-sheet__summary-value">{syncStatus}</span>
          </div>
        ) : <div className="small auth-sheet__hint">{copy.signInHint}</div>}
        {showSyncNow ? (
          <button type="button" className="btn" onClick={onSyncNow} disabled={syncing || loading}>
            <span className="btn__icon"><IconRefreshCw size={14} /></span>
            <span className="btn__label">{copy.syncNow}</span>
          </button>
        ) : null}
        {!connected ? (
          <button type="button" className="btn" onClick={onSignIn} disabled={!configured || loading}>
            <span className="btn__icon"><IconCloud size={14} /></span>
            <span className="btn__label">{copy.signIn}</span>
          </button>
        ) : null}
        <button type="button" className="btn btn--subtle auth-sheet__data-link" onClick={onOpenData}
          aria-current={isDataPage ? "page" : undefined}>
          <span className="btn__icon"><IconArrowRight size={14} /></span>
          <span className="btn__label">{copy.openData}</span>
        </button>
        {connected ? <>
          <button type="button" className="btn btn--ghost" onClick={onSignOut}>
            <span className="btn__icon"><IconLogOut size={14} /></span>
            <span className="btn__label">{copy.signOut}</span>
          </button>
          <div className="small auth-sheet__hint">
            {copy.localDataSafe}
          </div>
        </> : null}
      </div>
    </div>
  );
}
