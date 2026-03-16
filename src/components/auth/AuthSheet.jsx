import { IconArrowRight, IconCloud, IconLogOut, IconRefreshCw, IconShield, IconUser } from "../ui/AppIcons.jsx";

function SummaryRow({ label, value }) {
  return (
    <div className="auth-sheet__summary-row">
      <span className="auth-sheet__summary-label">{label}</span>
      <span className="auth-sheet__summary-value">{value}</span>
    </div>
  );
}

export default function AuthSheet({
  copy,
  session,
  configured,
  loading,
  syncStatus,
  syncing,
  onSignIn,
  onSignOut,
  onSyncNow,
  onOpenData,
  onOpenProfile,
  embedded = false,
}) {
  const user = session?.user || null;
  const email = String(user?.email || "").trim();
  const name = String(user?.user_metadata?.name || "").trim() || email || copy.localOnlyTitle;

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
          <div className="auth-sheet__title">{user ? copy.connectedTitle : copy.localOnlyTitle}</div>
          <div className="small auth-sheet__lead">{user ? name : copy.localOnlyLead}</div>
        </div>
      </div>

      {!configured ? (
        <div className="small page-feedback">{copy.envMissing}</div>
      ) : null}

      {configured && user ? (
        <div className="auth-sheet__body">
          {email ? <div className="small auth-sheet__email">{email}</div> : null}
          <div className="auth-sheet__summary">
            <SummaryRow label={copy.syncLabel} value={syncStatus} />
            <SummaryRow label={copy.storageModeLabel} value={copy.localFirstValue} />
          </div>
          <button type="button" className="btn" onClick={onSyncNow} disabled={syncing || loading}>
            <span className="btn__icon"><IconRefreshCw size={14} /></span>
            <span className="btn__label">{copy.syncNow}</span>
          </button>
          <button type="button" className="btn btn--subtle" onClick={onOpenData}>
            <span className="btn__icon"><IconArrowRight size={14} /></span>
            <span className="btn__label">{copy.openData}</span>
          </button>
          <button type="button" className="btn btn--subtle" onClick={onOpenProfile}>
            <span className="btn__icon"><IconUser size={14} /></span>
            <span className="btn__label">{copy.openProfile}</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={onSignOut}>
            <span className="btn__icon"><IconLogOut size={14} /></span>
            <span className="btn__label">{copy.signOut}</span>
          </button>
        </div>
      ) : (
        <div className="auth-sheet__body">
          <div className="small auth-sheet__hint">{copy.signInHint}</div>
          <div className="small auth-sheet__hint">
            <span className="auth-sheet__hint-icon"><IconShield size={14} /></span>
            {copy.localDataSafe}
          </div>
          <button type="button" className="btn" onClick={onSignIn} disabled={!configured || loading}>
            <span className="btn__icon"><IconCloud size={14} /></span>
            <span className="btn__label">{copy.signIn}</span>
          </button>
          <button type="button" className="btn btn--subtle" onClick={onOpenData}>
            <span className="btn__icon"><IconArrowRight size={14} /></span>
            <span className="btn__label">{copy.openData}</span>
          </button>
        </div>
      )}
    </div>
  );
}
