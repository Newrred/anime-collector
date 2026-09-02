import { useState } from "react";

import { IconCloud, IconRefreshCw } from "../ui/AppIcons.jsx";
import MemoryConflictDialog from "./MemoryConflictDialog.jsx";

const titleFor = (copy, status) => copy.statusTitles?.[status] || copy.statusTitles.LOCAL_ONLY;
const leadFor = (copy, account) => {
  if (account.status === "PROMOTION_AVAILABLE") return copy.promotionCount(account.guestCardCount || 0);
  if (account.syncResultCode) return copy.syncLeads?.[account.syncResultCode] || copy.statusLeads?.[account.status];
  return copy.statusLeads?.[account.status] || copy.statusLeads.LOCAL_ONLY;
};

export default function MemoryAccountPanel({ copy, auth, account }) {
  const connected = Boolean(auth?.session?.user);
  const [choiceState, setChoiceState] = useState({ sourceHash: null, values: {} });
  const [dismissedConflictId, setDismissedConflictId] = useState(null);
  const preview = account.promotionPreview;
  const titleChoices = choiceState.sourceHash === preview?.sourceHash ? choiceState.values : {};
  const unresolved = preview?.unresolvedAnimeRefs || [];
  const choicesComplete = unresolved.every((animeRef) => Boolean(titleChoices[animeRef.id]));
  const conflict = (account.conflicts || []).find((row) => row.id !== dismissedConflictId) || null;

  const confirmPromotion = () => account.promote(unresolved.map((animeRef) => ({
    animeRefId: animeRef.id,
    choice: titleChoices[animeRef.id] === "CATALOG"
      ? { kind: "CATALOG", catalogAnimeId: animeRef.catalogCandidate.animeId }
      : { kind: "KEEP_PRIVATE" },
  })));
  const exportConflict = async () => {
    if (!conflict) return;
    const backup = await account.exportConflictBackup(conflict.id);
    if (!backup) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moemoa-memory-conflict-${conflict.entityId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="surface-card sync-card" data-memory-account-status={account.status}>
      <div className="sync-card__header">
        <div className="pageHeader">
          <h2 className="sectionTitle">{copy.title}</h2>
          <p className="pageLead">{copy.lead}</p>
        </div>
        <div className="sync-card__status">
          <span className="sync-dot" aria-hidden />
          <span>{titleFor(copy, account.status)}</span>
        </div>
      </div>

      <div className="list-stack">
        <div className="small">{leadFor(copy, account)}</div>
        {connected ? <div className="small">{auth.user?.email || copy.connectedAccount}</div> : null}
      </div>

      <div className="sync-card__actions">
        {!connected ? (
          <button type="button" className="btn" onClick={() => auth.signIn()} disabled={!auth.configured || auth.loading}>
            <span className="btn__icon"><IconCloud size={14} /></span>
            <span className="btn__label">{copy.signIn}</span>
          </button>
        ) : null}
        {account.status === "INITIALIZATION_FAILED" ? (
          <button type="button" className="btn" onClick={account.retry}>
            <span className="btn__icon"><IconRefreshCw size={14} /></span>
            <span className="btn__label">{copy.retry}</span>
          </button>
        ) : null}
        {account.status === "PROMOTION_AVAILABLE" && !preview ? (
          <button type="button" className="btn" onClick={account.buildPromotionPreview} disabled={account.promotionBusy}>
            {account.promotionBusy ? copy.reviewing : copy.reviewPromotion}
          </button>
        ) : null}
        {connected && ["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(account.status) ? (
          <button type="button" className="btn" onClick={() => { setDismissedConflictId(null); account.syncNow(); }} disabled={account.syncBusy || account.promotionBusy}>
            <span className="btn__icon"><IconRefreshCw size={14} /></span>
            <span className="btn__label">{account.syncBusy ? copy.syncing : copy.syncNow}</span>
          </button>
        ) : null}
        {connected ? (
          <button type="button" className="btn btn--ghost" onClick={auth.signOut} disabled={account.promotionBusy}>
            {copy.signOut}
          </button>
        ) : null}
      </div>

      {account.syncResultCode ? <div className="small page-feedback" role="status">{copy.syncResults[account.syncResultCode] || copy.syncResults.ERROR}</div> : null}
      {account.syncErrorCode ? <div className="small page-feedback" role="alert">{copy.syncFailed}</div> : null}

      {preview ? (
        <div className="promotion-preview" aria-labelledby="promotion-preview-title">
          <div>
            <h3 id="promotion-preview-title" className="sectionTitle sectionTitle--small">{copy.previewTitle}</h3>
            <p className="small">{copy.previewLead}</p>
          </div>
          <dl className="promotion-preview__counts">
            {Object.entries(copy.countLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{preview.counts[key] || 0}</dd>
              </div>
            ))}
          </dl>
          <div className="promotion-preview__warning" role="note">{copy.localImageWarning}</div>
          {unresolved.map((animeRef) => (
            <fieldset key={animeRef.id} className="promotion-preview__choice">
              <legend>{copy.titleChoice(animeRef.displayTitle)}</legend>
              {animeRef.catalogCandidate ? (
                <label>
                  <input
                    type="radio"
                    name={`promotion-${animeRef.id}`}
                    value="CATALOG"
                    checked={titleChoices[animeRef.id] === "CATALOG"}
                    onChange={() => setChoiceState({
                      sourceHash: preview.sourceHash,
                      values: { ...titleChoices, [animeRef.id]: "CATALOG" },
                    })}
                  />
                  {copy.useCatalog(animeRef.catalogCandidate.displayTitle)}
                </label>
              ) : null}
              <label>
                <input
                  type="radio"
                  name={`promotion-${animeRef.id}`}
                  value="KEEP_PRIVATE"
                  checked={titleChoices[animeRef.id] === "KEEP_PRIVATE"}
                  onChange={() => setChoiceState({
                    sourceHash: preview.sourceHash,
                    values: { ...titleChoices, [animeRef.id]: "KEEP_PRIVATE" },
                  })}
                />
                {copy.keepPrivate}
              </label>
            </fieldset>
          ))}
          {account.promotionErrorCode ? <div className="small page-feedback" role="alert">{copy.promotionFailed}</div> : null}
          <div className="sync-card__actions">
            <button type="button" className="btn btn--ghost" onClick={account.cancelPromotionPreview} disabled={account.promotionBusy}>
              {copy.cancelPromotion}
            </button>
            <button type="button" className="btn" onClick={confirmPromotion} disabled={!choicesComplete || account.promotionBusy}>
              {account.promotionBusy ? copy.promoting : copy.confirmPromotion}
            </button>
          </div>
        </div>
      ) : null}
      <MemoryConflictDialog
        copy={copy.conflict}
        conflict={conflict}
        busy={account.conflictBusy}
        onClose={() => setDismissedConflictId(conflict?.id || null)}
        onKeepLocal={() => account.resolveConflict(conflict.id, "KEEP_LOCAL")}
        onUseCloud={() => account.resolveConflict(conflict.id, "USE_CLOUD")}
        onExport={exportConflict}
      />
    </section>
  );
}
