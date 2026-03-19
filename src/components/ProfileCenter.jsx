import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getMessageGroup } from "../domain/messages.js";
import { buildPublicProfilePath, isValidProfileHandle } from "../domain/profileUtils.js";
import { useUiPreferences } from "../hooks/useUiPreferences.js";
import { useAuthSession } from "../hooks/useAuthSession.js";
import {
  buildPublicProfileUrl,
  ensureMyProfile,
  listFollowers,
  listFollowing,
  saveMyProfile,
} from "../repositories/profileRepo.js";
import { useShowcaseSource } from "../hooks/useShowcaseSource.js";
import { buildShowcaseModel, buildPublicShowcaseSnapshot } from "../domain/showcase/showcaseSelectors.js";
import {
  DEFAULT_SHOWCASE_LAYOUT,
  publishShowcaseSnapshot,
  readShowcaseLayout,
  saveShowcaseLayout,
} from "../repositories/showcaseRepo.js";
import { IconChevronDown, IconChevronUp, IconEye, IconEyeOff, IconGrip } from "./ui/AppIcons.jsx";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { ProfilePeopleList } from "./profile/ProfileUi.jsx";
import ShowcaseGrid from "./showcase/ShowcaseGrid.jsx";

function buildProfileFormState(profile) {
  return {
    displayName: profile?.displayName || "",
    handle: profile?.handle || "",
    bio: profile?.bio || "",
    profilePublic: profile?.profilePublic === true,
  };
}

function moveWidget(layout, fromIndex, toIndex) {
  if (!Array.isArray(layout?.widgets)) return layout;
  if (fromIndex === toIndex) return layout;
  if (fromIndex < 0 || toIndex < 0) return layout;
  if (fromIndex >= layout.widgets.length || toIndex >= layout.widgets.length) return layout;
  const next = [...layout.widgets];
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row);
  return { ...layout, widgets: next };
}

function findWidgetIndex(layout, widgetId) {
  if (!Array.isArray(layout?.widgets)) return -1;
  return layout.widgets.findIndex((row) => row.id === widgetId);
}

function moveWidgetByOffset(layout, widgetId, offset) {
  const fromIndex = findWidgetIndex(layout, widgetId);
  if (fromIndex < 0) return layout;
  const toIndex = Math.max(0, Math.min(layout.widgets.length - 1, fromIndex + offset));
  return moveWidget(layout, fromIndex, toIndex);
}

function moveWidgetBeforeTarget(layout, draggedWidgetId, targetWidgetId) {
  const fromIndex = findWidgetIndex(layout, draggedWidgetId);
  const targetIndex = findWidgetIndex(layout, targetWidgetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return layout;
  return moveWidget(layout, fromIndex, targetIndex);
}

function resolveWidgetLabel(widgetId, locale = "ko") {
  const widgetCopy = getMessageGroup(locale, "showcaseWidgets");
  const titles = {
    resonanceShelf: widgetCopy?.resonanceShelf?.title || "resonanceShelf",
    memoryLineShelf: widgetCopy?.memoryLineShelf?.title || "memoryLineShelf",
    thisTimeCapsule: widgetCopy?.thisTimeCapsule?.title || "thisTimeCapsule",
    tasteFingerprint: widgetCopy?.tasteFingerprint?.title || "tasteFingerprint",
    logDensityCalendar: widgetCopy?.logDensityCalendar?.title || "logDensityCalendar",
    characterGravity: widgetCopy?.characterGravity?.title || "characterGravity",
    genreWordHeatmap: widgetCopy?.genreWordHeatmap?.title || "genreWordHeatmap",
    posterPalette: widgetCopy?.posterPalette?.title || "posterPalette",
  };
  return titles[widgetId] || widgetId;
}

export default function ProfileCenter() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const auth = useAuthSession(`${String(import.meta.env.BASE_URL || "/")}profile/`);
  const copy = getMessageGroup(locale, "profilePage");
  const editorCopy = getMessageGroup(locale, "showcaseEditor");
  const { items, logs, mediaMap, titleById } = useShowcaseSource(locale);
  const showcaseModel = useMemo(
    () => buildShowcaseModel({ items, logs, mediaMap, titleById, locale }),
    [items, logs, mediaMap, titleById, locale]
  );

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(buildProfileFormState(null));
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [showcaseLayout, setShowcaseLayout] = useState(DEFAULT_SHOWCASE_LAYOUT);
  const [publishing, setPublishing] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null);
  const [touchDragState, setTouchDragState] = useState(null);
  const editorListRef = useRef(null);
  const previousEditorRectsRef = useRef(new Map());
  const touchHoldTimerRef = useRef(null);
  const touchDragRef = useRef({ active: false, widgetId: null, overWidgetId: null, pointerId: null });

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) {
      setLoading(false);
      setProfile(null);
      setForm(buildProfileFormState(null));
      setFollowers([]);
      setFollowing([]);
      setEditing(false);
      setShowcaseLayout(DEFAULT_SHOWCASE_LAYOUT);
      return;
    }

    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const ensured = await ensureMyProfile(auth.user);
        const [nextFollowers, nextFollowing] = await Promise.all([
          listFollowers(ensured?.userId),
          listFollowing(ensured?.userId),
        ]);

        let layout = DEFAULT_SHOWCASE_LAYOUT;
        try {
          layout = await readShowcaseLayout(auth.user.id);
        } catch (layoutError) {
          console.error(layoutError);
          if (alive) setMessage(`Showcase layout load failed: ${layoutError?.message || copy.unknownError}`);
        }

        if (!alive) return;
        setProfile(ensured);
        setForm(buildProfileFormState(ensured));
        setFollowers(nextFollowers);
        setFollowing(nextFollowing);
        setShowcaseLayout(layout);
      } catch (error) {
        if (!alive) return;
        console.error(error);
        setMessage(`${copy.loadFailed}: ${error?.message || copy.unknownError}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [auth.loading, auth.user, copy.loadFailed, copy.unknownError]);

  const savedHandle = String(profile?.handle || "").trim().toLowerCase();
  const savedDisplayName = String(profile?.displayName || "").trim() || copy.publicTitle;
  const savedBio = String(profile?.bio || "").trim();
  const publicPath = useMemo(
    () => (savedHandle ? buildPublicProfilePath(savedHandle, base) : `${base}u/`),
    [base, savedHandle]
  );
  const editorOrderKey = useMemo(
    () => (Array.isArray(showcaseLayout?.widgets) ? showcaseLayout.widgets.map((row) => row.id).join("|") : ""),
    [showcaseLayout]
  );

  useLayoutEffect(() => {
    const list = editorListRef.current;
    if (!list) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

    const rows = Array.from(list.querySelectorAll("[data-widget-id]"));
    const nextRects = new Map(
      rows.map((row) => [
        row.getAttribute("data-widget-id"),
        row.getBoundingClientRect(),
      ])
    );
    const previousRects = previousEditorRectsRef.current;

    if (previousRects.size > 0) {
      rows.forEach((row) => {
        const widgetId = row.getAttribute("data-widget-id");
        const previous = previousRects.get(widgetId);
        const next = nextRects.get(widgetId);
        if (!previous || !next) return;
        const deltaX = previous.left - next.left;
        const deltaY = previous.top - next.top;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

        row.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" },
          ],
          {
            duration: 280,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          }
        );
      });
    }

    previousEditorRectsRef.current = nextRects;
  }, [editorOrderKey]);

  useEffect(() => {
    touchDragRef.current = {
      active: Boolean(touchDragState?.active),
      widgetId: touchDragState?.widgetId || null,
      overWidgetId: dragOverWidgetId || touchDragState?.widgetId || null,
      pointerId: touchDragState?.pointerId ?? null,
    };
  }, [touchDragState, dragOverWidgetId]);

  useEffect(() => () => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!touchDragState?.active) return undefined;

    function onPointerMove(event) {
      if (event.pointerId !== touchDragRef.current.pointerId) return;
      if (event.cancelable) event.preventDefault();
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const row = hit?.closest?.("[data-widget-id]");
      const widgetId = row?.getAttribute?.("data-widget-id") || touchDragRef.current.widgetId;
      if (widgetId && widgetId !== dragOverWidgetId) {
        setDragOverWidgetId(widgetId);
      }
    }

    function finish(pointerId) {
      if (pointerId !== touchDragRef.current.pointerId) return;
      const activeWidgetId = touchDragRef.current.widgetId;
      const overWidgetId = touchDragRef.current.overWidgetId;
      if (activeWidgetId && overWidgetId && activeWidgetId !== overWidgetId) {
        setShowcaseLayout((prev) => moveWidgetBeforeTarget(prev, activeWidgetId, overWidgetId));
      }
      setTouchDragState(null);
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
    }

    function onPointerUp(event) {
      finish(event.pointerId);
    }

    function onPointerCancel(event) {
      finish(event.pointerId);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [touchDragState, dragOverWidgetId]);

  async function copyProfileLink() {
    if (!isValidProfileHandle(savedHandle)) {
      setMessage(copy.handleInvalid);
      return;
    }
    try {
      await navigator.clipboard.writeText(buildPublicProfileUrl(savedHandle));
      setMessage(copy.linkCopied);
    } catch {
      setMessage(copy.copyFailed);
    }
  }

  async function handleSave() {
    if (!auth.user || !profile) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveMyProfile(
        auth.user.id,
        {
          displayName: form.displayName,
          handle: form.handle,
          bio: form.bio,
          profilePublic: form.profilePublic,
        },
        profile
      );
      const [nextFollowers, nextFollowing] = await Promise.all([
        listFollowers(saved?.userId),
        listFollowing(saved?.userId),
      ]);
      setProfile(saved);
      setForm(buildProfileFormState(saved));
      setFollowers(nextFollowers);
      setFollowing(nextFollowing);
      setEditing(false);
      setMessage(copy.saveDone);
    } catch (error) {
      console.error(error);
      setMessage(`${copy.saveFailed}: ${error?.message || copy.unknownError}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveShowcaseLayout() {
    if (!auth.user?.id) return;
    try {
      const saved = await saveShowcaseLayout(auth.user.id, showcaseLayout);
      setShowcaseLayout(saved);
      setMessage(editorCopy.layoutSaved);
    } catch (error) {
      console.error(error);
      setMessage(`Showcase layout save failed: ${error?.message || copy.unknownError}`);
    }
  }

  async function handlePublishShowcase() {
    if (!auth.user?.id || !profile) return;
    setPublishing(true);
    try {
      const snapshot = buildPublicShowcaseSnapshot({
        profile,
        layout: showcaseLayout,
        model: showcaseModel,
      });
      await publishShowcaseSnapshot(auth.user.id, snapshot);
      setMessage(editorCopy.published);
    } catch (error) {
      console.error(error);
      setMessage(`Public showcase publish failed: ${error?.message || copy.unknownError}`);
    } finally {
      setPublishing(false);
    }
  }

  function handleEditStart() {
    setForm(buildProfileFormState(profile));
    setEditing(true);
    setMessage("");
  }

  function handleEditCancel() {
    setForm(buildProfileFormState(profile));
    setEditing(false);
    setMessage("");
  }

  function handleMoveWidget(widgetId, offset, control) {
    control?.blur?.();
    setShowcaseLayout((prev) => moveWidgetByOffset(prev, widgetId, offset));
  }

  function handleWidgetDragStart(event, widgetId) {
    setDraggedWidgetId(widgetId);
    setDragOverWidgetId(widgetId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", widgetId);
  }

  function handleWidgetDragOver(event, widgetId) {
    if (!draggedWidgetId || draggedWidgetId === widgetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverWidgetId !== widgetId) setDragOverWidgetId(widgetId);
  }

  function handleWidgetDrop(event, widgetId) {
    event.preventDefault();
    const droppedWidgetId = draggedWidgetId || event.dataTransfer.getData("text/plain");
    if (!droppedWidgetId || droppedWidgetId === widgetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }
    setShowcaseLayout((prev) => moveWidgetBeforeTarget(prev, droppedWidgetId, widgetId));
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  }

  function handleWidgetDragEnd() {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  }

  function clearTouchHoldTimer() {
    if (!touchHoldTimerRef.current) return;
    clearTimeout(touchHoldTimerRef.current);
    touchHoldTimerRef.current = null;
  }

  function handleTouchHandlePointerDown(event, widgetId) {
    if (event.pointerType === "mouse") return;
    clearTouchHoldTimer();
    touchHoldTimerRef.current = setTimeout(() => {
      setDraggedWidgetId(widgetId);
      setDragOverWidgetId(widgetId);
      setTouchDragState({
        active: true,
        widgetId,
        pointerId: event.pointerId,
      });
    }, 180);
  }

  function handleTouchHandlePointerEnd() {
    clearTouchHoldTimer();
  }

  return (
    <div className="profile-page minihome-page page-shell page-shell--wide">
      <TopNavDataMenu
        base={base}
        panelId="profile-menu-panel"
        currentRoute="profile"
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || (locale === "ko" ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />

      {!auth.user ? (
        <section className="surface-card profile-signin-card">
          <div className="pageHeader">
            <h1 className="pageTitle">{copy.signInTitle}</h1>
            <p className="pageLead">{copy.signInLead}</p>
          </div>
          {!auth.configured ? <div className="small page-feedback">{copy.envMissing}</div> : null}
          <div className="action-row">
            <button
              type="button"
              className="btn"
              onClick={() => auth.signIn(`${base}profile/`)}
              disabled={!auth.configured || auth.loading}
            >
              {copy.signInButton}
            </button>
          </div>
        </section>
      ) : (
        <div className="profile-page__stack minihome-page__stack">
          <section className="surface-card minihome-hero-card">
            <div className="minihome-page__header">
              <div className="pageHeader">
              <p className="pageLead">{copy.lead}</p>
              <h1 className="pageTitle">{copy.title}</h1>
              <p className="small minihome-page__meta">
                {profile?.profilePublic ? copy.visibilityPublic : copy.visibilityPrivate} · @
                {savedHandle || form.handle || copy.handlePlaceholder}
              </p>
              </div>

            <div className="action-row">
              <button type="button" className="btn btn--subtle" onClick={copyProfileLink}>
                {copy.copyLink}
              </button>
              <a href={publicPath} className="btn btn--subtle">
                {copy.openPublicProfile}
              </a>
              <button type="button" className="btn" onClick={handlePublishShowcase} disabled={publishing || !profile}>
                {publishing ? editorCopy.publishing : editorCopy.publish}
              </button>
            </div>
            </div>
          </section>

          {message ? <div className="small page-feedback">{message}</div> : null}
          {loading ? <div className="small page-feedback">{copy.loading}</div> : null}

          <section className="surface-card minihome-settings">
            <div className="minihome-settings__head">
              <div className="pageHeader">
                <h2 className="sectionTitle">{copy.settingsTitle}</h2>
              </div>
              <div className="action-row minihome-settings__actions">
                {!editing ? (
                  <button type="button" className="btn btn--subtle" onClick={handleEditStart}>
                    {copy.editProfile}
                  </button>
                ) : null}
              </div>
            </div>

            {editing ? (
              <div className="profile-form">
                <label className="profile-field">
                  <span className="small profile-field__label">{copy.displayNameLabel}</span>
                  <input
                    className="input"
                    value={form.displayName}
                    onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                    placeholder={copy.displayNamePlaceholder}
                  />
                </label>

                <label className="profile-field">
                  <span className="small profile-field__label">{copy.handleLabel}</span>
                  <input
                    className="input"
                    value={form.handle}
                    onChange={(event) => setForm((prev) => ({ ...prev, handle: event.target.value.toLowerCase() }))}
                    placeholder={copy.handlePlaceholder}
                  />
                  <span className="small profile-field__hint">{copy.handleHint}</span>
                </label>

                <label className="profile-field">
                  <span className="small profile-field__label">{copy.bioLabel}</span>
                  <textarea
                    className="textarea profile-field__textarea"
                    value={form.bio}
                    onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                    placeholder={copy.bioPlaceholder}
                  />
                </label>

                <label className="profile-toggle">
                  <input
                    type="checkbox"
                    checked={form.profilePublic}
                    onChange={(event) => setForm((prev) => ({ ...prev, profilePublic: event.target.checked }))}
                  />
                  <span className="profile-toggle__copy">
                    <span className="profile-toggle__title">{copy.publicToggleLabel}</span>
                    <span className="small profile-toggle__hint">
                      {form.profilePublic ? copy.publicToggleOn : copy.publicToggleOff}
                    </span>
                  </span>
                </label>

                <div className="action-row">
                  <button type="button" className="btn" onClick={handleSave} disabled={saving || loading}>
                    {saving ? copy.saving : copy.save}
                  </button>
                  <button type="button" className="btn btn--subtle" onClick={handleEditCancel} disabled={saving}>
                    {copy.cancelEdit}
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-link-box-stack">
                <div className="profile-link-box">
                  <div className="small profile-link-box__label">{copy.displayNameLabel}</div>
                  <div className="profile-link-box__value">{savedDisplayName}</div>
                </div>
                <div className="profile-link-box">
                  <div className="small profile-link-box__label">{copy.publicLink}</div>
                  <div className="profile-link-box__value">{publicPath}</div>
                </div>
                <div className="profile-link-box">
                  <div className="small profile-link-box__label">{copy.bioLabel}</div>
                  <div className="profile-link-box__value">{savedBio || copy.bioEmpty}</div>
                </div>
              </div>
            )}
          </section>

          <div className="profile-page__lists">
            <ProfilePeopleList title={copy.followersTitle} emptyText={copy.followersEmpty} people={followers} base={base} />
            <ProfilePeopleList title={copy.followingTitle} emptyText={copy.followingEmpty} people={following} base={base} />
          </div>

          <section className="minihome-workbench">
            <div className="surface-card minihome-canvas">
              <div className="pageHeader">
                <p className="sectionLead">{copy.canvasLead}</p>
                <h2 className="sectionTitle">{copy.canvasTitle}</h2>
              </div>
              <ShowcaseGrid locale={locale} model={showcaseModel} layout={showcaseLayout} />
            </div>

            <aside className="surface-card minihome-controls">
              <div className="pageHeader">
                <p className="sectionLead">{editorCopy.lead}</p>
                <h2 className="sectionTitle">{editorCopy.title}</h2>
              </div>

              <div className="showcase-editor-list" ref={editorListRef}>
                {(showcaseLayout.widgets || []).map((widget, index) => (
                  <div
                    key={widget.id}
                    className={`showcase-editor-row showcase-editor-row--${widget.size === "wide" ? "wide" : "half"}${draggedWidgetId === widget.id ? " is-dragging" : ""}${dragOverWidgetId === widget.id && draggedWidgetId !== widget.id ? " is-drop-target" : ""}`}
                    data-widget-id={widget.id}
                    draggable
                    onDragStart={(event) => handleWidgetDragStart(event, widget.id)}
                    onDragOver={(event) => handleWidgetDragOver(event, widget.id)}
                    onDrop={(event) => handleWidgetDrop(event, widget.id)}
                    onDragEnd={handleWidgetDragEnd}
                  >
                    <div className="showcase-editor-row__main">
                      <div className="showcase-editor-row__title">{resolveWidgetLabel(widget.id, locale)}</div>
                      <div className="small showcase-editor-row__meta">
                        {widget.size === "wide" ? editorCopy.wideCard : editorCopy.baseCard}
                      </div>
                    </div>

                    <div className="showcase-editor-row__actions">
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon showcase-editor-row__drag-handle"
                        aria-label={editorCopy.dragReorder}
                        title={editorCopy.dragReorder}
                        onPointerDown={(event) => handleTouchHandlePointerDown(event, widget.id)}
                        onPointerUp={handleTouchHandlePointerEnd}
                        onPointerCancel={handleTouchHandlePointerEnd}
                        onPointerLeave={handleTouchHandlePointerEnd}
                      >
                        <span className="btn__icon"><IconGrip size={18} /></span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon showcase-editor-row__icon-btn"
                        onClick={(event) => handleMoveWidget(widget.id, -1, event.currentTarget)}
                        disabled={index === 0}
                        aria-label={editorCopy.moveUp}
                        title={editorCopy.moveUp}
                      >
                        <span className="btn__icon"><IconChevronUp size={22} /></span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon showcase-editor-row__icon-btn"
                        onClick={(event) => handleMoveWidget(widget.id, 1, event.currentTarget)}
                        disabled={index === showcaseLayout.widgets.length - 1}
                        aria-label={editorCopy.moveDown}
                        title={editorCopy.moveDown}
                      >
                        <span className="btn__icon"><IconChevronDown size={22} /></span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon showcase-editor-row__icon-btn"
                        onClick={() => {
                          setShowcaseLayout((prev) => ({
                            ...prev,
                            widgets: prev.widgets.map((row) =>
                              row.id === widget.id ? { ...row, enabled: !row.enabled } : row
                            ),
                          }));
                        }}
                        aria-label={widget.enabled ? editorCopy.hide : editorCopy.show}
                        title={widget.enabled ? editorCopy.hide : editorCopy.show}
                      >
                        <span className="btn__icon">
                          {widget.enabled ? <IconEyeOff size={22} /> : <IconEye size={22} />}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="action-row">
                <button type="button" className="btn btn--subtle" onClick={handleSaveShowcaseLayout}>
                  {editorCopy.saveLayout}
                </button>
                <button type="button" className="btn" onClick={handlePublishShowcase} disabled={publishing || !profile}>
                  {publishing ? editorCopy.publishing : editorCopy.publish}
                </button>
              </div>

              <div className="small page-feedback">
                {profile?.profilePublic ? editorCopy.publishHint : editorCopy.privateHint}
              </div>
            </aside>
          </section>
        </div>
      )}
    </div>
  );
}
