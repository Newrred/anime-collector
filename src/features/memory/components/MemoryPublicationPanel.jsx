import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { createPublicationController } from "../application/createPublicationController.js";
import { getPublicationServices, publicationUiEnabled } from "../runtime/platformPublication.js";
import { PUBLIC_FIELDS, publicationLink } from "../domain/publicationView.js";
import PublicBoardSnapshot from "./PublicBoardSnapshot.jsx";
import PublicLinkCopy from "./PublicLinkCopy.jsx";
import MemoryVisual from "./MemoryVisual.jsx";
import { publicationCopy, publicationError } from "./publicationCopy.js";
import "./memory-publication.css";
import { getPlatformMemoryRuntime } from '../runtime/platformMemoryRuntime.js';
import { privateImageTransfer, privateImageUiEnabled } from '../runtime/platformPrivateImages.js';

function ImagePreparation({ cardId, controller, copy, policyRevision, busy }) {
  const [file, setFile] = useState(null);
  const [consented, setConsented] = useState(false);
  const [privateChoice, setPrivateChoice] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(false);
  const canChoosePrivate = privateImageUiEnabled() && import.meta.env.PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1 === '1';
  const activeRequest = useRef(null), objectUrl = useRef(null);
  useEffect(() => () => { activeRequest.current?.abort(); activeRequest.current = null; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, [cardId]);
  const choosePrivate = async () => {
    activeRequest.current?.abort(); const abort = new AbortController(); activeRequest.current = abort;
    setLoading(true); setError(false); setConsented(false); setPrivateChoice(null); setFile(null);
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const runtime = await getPlatformMemoryRuntime(), bundle = await runtime.getCard(cardId);
      const transfer = privateImageTransfer(runtime, bundle), policy = await transfer.policy(abort.signal);
      if (!policy.representation) throw new Error('missing');
      const blob = await transfer.read(abort.signal), latest = await transfer.policy(abort.signal);
      if (latest.representation?.id !== policy.representation.id || latest.representation.mainHash !== policy.representation.mainHash) throw new Error('changed');
      if (abort.signal.aborted || activeRequest.current !== abort) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setPrivateChoice({ id: policy.representation.id, hash: policy.representation.mainHash, src: objectUrl.current });
    } catch { if (activeRequest.current === abort) setError(true); }
    finally { clearTimeout(timer); if (activeRequest.current === abort) { setLoading(false); activeRequest.current = null; } }
  };
  return <div className="memory-publication__image-preparation">
    <p>{canChoosePrivate ? copy.privateImageHelp : copy.imageHelp}</p>
    {!policyRevision ? <p>{copy.imagePolicyMissing}</p> : <>
      <p>{copy.policy}: {policyRevision}</p>
      <label>{copy.file}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || loading}
        onChange={(event) => { setFile(event.target.files?.[0] || null); setPrivateChoice(null); setConsented(false); if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; } }} /></label>
      {canChoosePrivate && <button type="button" className="btn btn--subtle" disabled={busy || loading} onClick={choosePrivate}>{copy.choosePrivate}</button>}
      {loading && <p role="status">{copy.loading}</p>}
      {error && <p role="alert">{copy.privateUnavailable}</p>}
      {privateChoice && <MemoryVisual visual={{ kind: 'IMAGE', src: privateChoice.src, alt: copy.privatePreview }} />}
      <label className="memory-publication__check"><input type="checkbox" checked={consented} disabled={busy || loading || (!file && !privateChoice)}
        onChange={(event) => setConsented(event.target.checked)} />{privateChoice ? copy.privateConsent : copy.imageConsent}</label>
      <button type="button" className="btn btn--subtle" disabled={busy || loading || (!file && !privateChoice) || !consented}
        onClick={() => controller.upload({ cardId, file, privateRepresentation: privateChoice && {id:privateChoice.id,hash:privateChoice.hash}, consented })}>{copy.upload}</button>
    </>}
  </div>;
}

function PublicationReview({ review, controller, services, locale, busy }) {
  const copy = publicationCopy(locale);
  const [consented, setConsented] = useState(false);
  const [visualsReady, setVisualsReady] = useState(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <>
    <h3 ref={heading} tabIndex={-1}>{copy.previewTitle}</h3>
    <PublicBoardSnapshot snapshot={review.snapshot} publicationId={review.id} services={services}
      preview locale={locale} onReady={setVisualsReady} />
    <p>{copy.policy}: {review.policyRevision}</p>
    <label className="memory-publication__check"><input type="checkbox" checked={consented} disabled={busy}
      onChange={(event) => setConsented(event.target.checked)} />{copy.consent}</label>
    <div className="memory-publication__actions">
      <button type="button" className="btn" disabled={busy || !consented || !visualsReady}
        onClick={() => controller.publish({ consented, visualsReady })}>{copy.publish}</button>
      <button type="button" className="btn btn--subtle" disabled={busy} onClick={() => controller.cancel()}>{copy.cancel}</button>
    </div>
  </>;
}

function PublicationEditor({ detail, runtime, services, locale, base, onClose }) {
  const copy = publicationCopy(locale);
  const controller = useMemo(() => createPublicationController({ boardId: detail.board.id, ownerId: detail.board.ownerId,
    gateway: services.gateway, getSession: services.getSession, getBoard: (id) => runtime.getBoard(id), policyRevision: services.policyRevision,
  }), [detail.board.id, detail.board.ownerId, runtime, services]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selection, setSelection] = useState({});
  useUnsavedNavigation(Boolean(title || description || Object.keys(selection).length) && state.phase !== "published", locale, { busy: state.busy });
  useEffect(() => { controller.load(); return () => controller.dispose(); }, [controller]);
  const review = state.review;
  const publication = state.publication;
  const mutating = state.busy && ["publishing", "revoking"].includes(state.phase);
  const close = () => {
    if (mutating) return;
    if ((title || description || Object.keys(selection).length) && state.phase !== "published"
      && !confirm(locale === "ko" ? "게시하지 않고 공유 화면을 닫을까요?" : "Close sharing without publishing?")) return;
    controller.cancel(); onClose();
  };
  return <section className="memory-publication" aria-label={copy.title} aria-busy={state.busy}>
    <header><h2>{copy.title}</h2><button type="button" className="btn btn--subtle" disabled={mutating} onClick={close}>{copy.close}</button></header>
    <p>{copy.intro}</p>
    {state.error && <p role="alert">{publicationError(state.error, locale)}</p>}
    {state.busy && <p role="status">{state.phase === "publishing" ? copy.publishing : state.phase === "preparing" ? copy.preparing : copy.loading}</p>}
    {state.phase === "imageReady" && <p role="status">{copy.imageReady}</p>}
    {state.phase === "cardRevoked" && <p role="status">{copy.cardRevoked}</p>}
    {publication?.hidden && <p role="status">{publicationError("PUBLICATION_RESTRICTED", locale)}</p>}
    {publication?.hasPublished && !publication.hidden && <div role="status"><p>{copy.published}</p>
      {publication.sourceChanged && <p>{copy.changed}</p>}
      <a href={publicationLink(publication.id, base)} data-astro-reload>{copy.visit}</a><PublicLinkCopy key={publication.id} kind="board" id={publication.id} locale={locale} base={base} /></div>}
    {publication?.state === "REVOKED" && <p role="status">{copy.revoked}</p>}
    {publication && publication.state !== "REVOKED" && <button type="button" className="btn btn--subtle" disabled={state.busy}
      onClick={() => { if (confirm(copy.withdrawConfirm)) controller.revoke(); }}>{copy.withdraw}</button>}
    {review ? <PublicationReview key={review.reviewHash} review={review} controller={controller} services={services} locale={locale} busy={state.busy} /> : <form onSubmit={(event) => {
      event.preventDefault();
      controller.prepare({ title, description, cards: detail.items.filter((item) => item.bundle.card.id in selection)
        .map((item) => ({ cardId: item.bundle.card.id, fields: selection[item.bundle.card.id] })) });
    }}>
      <fieldset disabled={state.busy}>
        <label>{copy.publicTitle}<input value={title} maxLength={80} required onChange={(event) => { controller.cancel(); setTitle(event.target.value); }} /></label>
        <label>{copy.description}<textarea value={description} maxLength={500} rows={3} onChange={(event) => { controller.cancel(); setDescription(event.target.value); }} /></label>
        <p>{copy.included}</p>
        <p>{locale === "ko" ? "공개 미니홈이 있으면 방문자가 이 보드에서 미니홈으로 이동할 수 있습니다." : "If you have a public home, visitors can open it from this board."}</p>
        <ol className="memory-publication__selection">{detail.items.map(({ bundle, visual }, index) => {
          const id = bundle.card.id, selected = id in selection;
          const image = !["SYSTEM_DESIGN", "CATALOG_COVER"].includes(bundle.asset.imageType);
          return <li key={id}>
            <MemoryVisual visual={visual} systemCopy={{ fallbackTitle: bundle.title.displayTitle }} missingLabel={copy.missing} />
            <div><h3>{index + 1}. {bundle.title.displayTitle}</h3>
              <p>{bundle.card.note}</p>{bundle.card.watchedAt && <p>{bundle.card.watchedAt.slice(0, 10)}</p>}
              <button type="button" className="btn btn--subtle" onClick={() => {
                if (confirm(copy.revokeCardConfirm)) controller.revokeCard(id);
              }}>{copy.revokeCard}</button>
              <label className="memory-publication__check"><input type="checkbox" checked={selected}
                onChange={(event) => {
                  controller.cancel();
                  const checked = event.target.checked;
                  setSelection((current) => { const next = { ...current }; if (checked) next[id] = []; else delete next[id]; return next; });
                }} />{copy.select}</label>
              {selected && <fieldset><legend>{copy.fields}</legend>{PUBLIC_FIELDS.map((field) => <label key={field} className="memory-publication__check">
                <input type="checkbox" checked={selection[id].includes(field)} onChange={(event) => {
                  controller.cancel();
                  const checked = event.target.checked;
                  setSelection((current) => ({ ...current, [id]: checked ? [...current[id], field] : current[id].filter((value) => value !== field) }));
                }} />{copy.details[field]}</label>)}</fieldset>}
              {selected && image && <ImagePreparation cardId={id} controller={controller} copy={copy} policyRevision={services.policyRevision} busy={state.busy} />}
            </div>
          </li>;
        })}</ol>
        <button type="submit" className="btn" disabled={!title.trim() || !Object.keys(selection).length}>{publication?.hasPublished ? copy.update : copy.preview}</button>
      </fieldset>
    </form>}
    {state.busy && !mutating && <button type="button" className="btn btn--subtle" onClick={() => controller.cancel()}>{copy.cancel}</button>}
  </section>;
}

export default function MemoryPublicationPanel({ detail, runtime, locale, base, disabled = false }) {
  const auth = useAuthSession();
  const [open, setOpen] = useState(false);
  if (!publicationUiEnabled()) return null;
  const copy = publicationCopy(locale), services = getPublicationServices();
  if (!services.enabled) return <p>{copy.disabled}</p>;
  if (!auth.user || detail.board.ownerId !== `account:${auth.user.id}`) return <p>{copy.login} <a href={`${base}data/`}>{copy.account}</a></p>;
  if (!open) return <button type="button" className="btn btn--subtle" disabled={disabled}
    onClick={() => setOpen(true)}>{copy.start}</button>;
  return <PublicationEditor key={`${detail.board.id}:${auth.user.id}`} detail={detail} runtime={runtime} services={services}
    locale={locale} base={base} onClose={() => setOpen(false)} />;
}
