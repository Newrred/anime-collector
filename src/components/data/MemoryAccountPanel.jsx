import { IconCloud, IconRefreshCw } from "../ui/AppIcons.jsx";

const titleFor = (copy, status) => copy.statusTitles?.[status] || copy.statusTitles.LOCAL_ONLY;
const leadFor = (copy, account) => {
  if (account.status === "PROMOTION_AVAILABLE") return copy.promotionCount(account.guestCardCount || 0);
  return copy.statusLeads?.[account.status] || copy.statusLeads.LOCAL_ONLY;
};

export default function MemoryAccountPanel({ copy, auth, account }) {
  const connected = Boolean(auth?.session?.user);
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
        {connected ? (
          <button type="button" className="btn btn--ghost" onClick={auth.signOut}>
            {copy.signOut}
          </button>
        ) : null}
      </div>
    </section>
  );
}
