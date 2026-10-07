import { useState } from "react";

import { IconCloud, IconRefreshCw } from "../ui/AppIcons.jsx";
import MemoryConflictDialog from "./MemoryConflictDialog.jsx";

const titleFor = (copy, status) => copy.statusTitles?.[status] || copy.statusTitles.LOCAL_ONLY;
const leadFor = (copy, account) => {
  if (account.status === "PROMOTION_AVAILABLE") return copy.promotionCount(account.guestCardCount || 0);
  if (account.syncResultCode) return copy.syncLeads?.[account.syncResultCode] || copy.statusLeads?.[account.status];
  return copy.statusLeads?.[account.status] || copy.statusLeads.LOCAL_ONLY;
};
const titleSyncErrorFor = (error, locale) => {
  if (error === "TITLE_SYNC_OTHER_ACCOUNT") return locale === "ko"
    ? "이 기기에 다른 계정의 작품 기록이 있습니다. 원래 계정으로 로그인해 확인해 주세요."
    : "This device has title records from another account. Sign in to the original account to review them.";
  if (error === "TITLE_SYNC_DUPLICATE_KEY") return locale === "ko"
    ? "같은 작품이 중복 저장되어 동기화를 멈췄습니다. 기록을 확인해 주세요."
    : "A title is saved twice, so sync stopped. Review the records.";
  return locale === "ko"
    ? "작품·감상 기록을 동기화하지 못했습니다. 이 기기의 기록은 그대로 있습니다. 다시 시도해 주세요."
    : "Title records could not sync. Local records remain. Try again.";
};

export default function MemoryAccountPanel({ copy, auth, account, titleSync, locale = "ko" }) {
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
          <p className="pageLead">{titleSync?.enabled ? (locale === "ko" ? "기억·보드와 저장 작품·감상 기록을 계정에 동기화합니다." : "Sync memories, boards, saved titles and watch records with your account.") : copy.lead}</p>
        </div>
        <div className="sync-card__status">
          <span className="sync-dot" aria-hidden />
          <span>{titleFor(copy, account.status)}</span>
        </div>
      </div>

      <div className="list-stack">
        {!account.syncResultCode && <div className="small">{leadFor(copy, account)}</div>}
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
          <button type="button" className="btn" onClick={() => { setDismissedConflictId(null); account.syncNow(); titleSync?.runNow({ allowPromotion: true }); }} disabled={account.syncBusy || account.promotionBusy || titleSync?.busy}>
            <span className="btn__icon"><IconRefreshCw size={14} /></span>
            <span className="btn__label">{account.syncBusy || titleSync?.busy ? copy.syncing : copy.syncNow}</span>
          </button>
        ) : null}
        {account.syncBusy ? <button type="button" className="btn btn--ghost" onClick={account.pauseSync}>{copy.pauseSync}</button> : null}
        {connected ? (
          <button type="button" className="btn btn--ghost" onClick={auth.signOut} disabled={account.promotionBusy}>
            {copy.signOut}
          </button>
        ) : null}
      </div>

      {account.syncResultCode && (!account.syncErrorCode || account.syncResultCode === "PAUSED") ? <div className="small page-feedback" role="status">{copy.syncResults[account.syncResultCode] || copy.syncResults.ERROR}</div> : null}
      {connected && titleSync?.enabled && titleSync.result?.promotionRequired && <div className="small page-feedback" role="status">{locale === "ko" ? "이 기기의 작품·감상 기록을 계정에 저장하려면 기록 동기화를 눌러 주세요." : "Select Sync records to save this device's title records to your account."}</div>}
      {connected && titleSync?.enabled && titleSync.result && !titleSync.result.promotionRequired && <div className="small page-feedback" role="status">{titleSync.result.conflicts.length ? (locale === "ko" ? `작품·감상 기록 ${titleSync.result.conflicts.length}건을 확인해야 합니다.` : `${titleSync.result.conflicts.length} title records need review.`) : (locale === "ko" ? "작품·감상 기록도 동기화했어요." : "Titles and watch records synced.")}</div>}
      {connected && titleSync?.enabled && titleSync.result?.conflicts?.length > 0 && <details className="list-stack"><summary>{locale === "ko" ? "충돌 확인" : "Review conflicts"}</summary><p className="small">{locale === "ko" ? "두 기기에서 같은 기록을 바꿨습니다. 선택하지 않은 쪽의 변경은 반영되지 않습니다." : "The same record changed on two devices. The other version will not be applied."}</p>{titleSync.result.conflicts.map((item) => <div key={item.id} className="list-stack"><strong>{item.displayName}</strong>{item.remoteVersion > 0 && <div className="sync-card__actions"><button type="button" className="btn btn--subtle" disabled={titleSync.busy} onClick={() => titleSync.resolveConflict(item, "local")}>{locale === "ko" ? "이 기기 기록 사용" : "Use this device"}</button><button type="button" className="btn btn--subtle" disabled={titleSync.busy} onClick={() => titleSync.resolveConflict(item, "cloud")}>{locale === "ko" ? "계정 기록 사용" : "Use account record"}</button></div>}</div>)}</details>}
      {connected && titleSync?.enabled && titleSync.error && <div className="small page-feedback" role="alert">{titleSyncErrorFor(titleSync.error, locale)}</div>}
      {account.syncErrorCode && account.syncResultCode !== "PAUSED" ? <div className="small page-feedback" role="alert">{copy.syncErrors?.[account.syncErrorCode] || copy.syncFailed}</div> : null}

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
          {account.promotionErrorCode ? <div className="small page-feedback" role="alert">{copy.promotionErrors?.[account.promotionErrorCode] || copy.promotionFailed}</div> : null}
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
