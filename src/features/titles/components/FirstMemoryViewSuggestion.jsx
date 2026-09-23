import { Capacitor } from "@capacitor/core";
import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";
import { writeTitleCollectionViewPreference } from "../application/titleCollectionPreference.js";

export default function FirstMemoryViewSuggestion({ base, copy, onDismiss }) {
  function openMemoryView() {
    writeTitleCollectionViewPreference("MEMORY");
    window.location.assign(toPlatformAppHref(`${base}titles/`, { native: Capacitor.isNativePlatform() }));
  }
  return (
    <section className="surface-card memory-archive__board-suggestion first-memory-view-suggestion" aria-labelledby="first-memory-view-title">
      <div>
        <h2 id="first-memory-view-title">{copy.title}</h2>
        <p role="status">{copy.body}</p>
      </div>
      <div className="action-row">
        <button type="button" className="btn" onClick={openMemoryView}>{copy.action}</button>
        <button type="button" className="btn btn--subtle" onClick={onDismiss}>{copy.dismiss}</button>
      </div>
    </section>
  );
}
