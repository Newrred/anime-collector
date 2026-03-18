import { useEffect, useMemo, useState } from "react";
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
  const [settingsExpanded, setSettingsExpanded] = useState(false);

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
      setSettingsExpanded(false);
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
    setSettingsExpanded(true);
    setEditing(true);
    setMessage("");
  }

  function handleEditCancel() {
    setForm(buildProfileFormState(profile));
    setEditing(false);
    setMessage("");
  }

  return (
    <div className="profile-page minihome-page">
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
          <section className="pageHeader minihome-page__header">
            <div>
              <h1 className="pageTitle">{copy.title}</h1>
              <p className="pageLead">{copy.lead}</p>
              <p className="small minihome-page__meta">
                {profile?.profilePublic ? copy.visibilityPublic : copy.visibilityPrivate} · @
                {savedHandle || form.handle || copy.handlePlaceholder}
              </p>
            </div>

            <div className="action-row">
              {!editing ? (
                <button type="button" className="btn btn--subtle" onClick={handleEditStart}>
                  {copy.editProfile}
                </button>
              ) : null}
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
          </section>

          {message ? <div className="small page-feedback">{message}</div> : null}
          {loading ? <div className="small page-feedback">{copy.loading}</div> : null}

          <section className="minihome-workbench">
            <div className="surface-card minihome-canvas">
              <div className="pageHeader">
                <h2 className="sectionTitle">{copy.canvasTitle}</h2>
                <p className="sectionLead">{copy.canvasLead}</p>
              </div>
              <ShowcaseGrid locale={locale} model={showcaseModel} layout={showcaseLayout} />
            </div>

            <aside className="surface-card minihome-controls">
              <div className="pageHeader">
                <h2 className="sectionTitle">{editorCopy.title}</h2>
                <p className="sectionLead">{editorCopy.lead}</p>
              </div>

              <div className="showcase-editor-list">
                {(showcaseLayout.widgets || []).map((widget, index) => (
                  <div key={widget.id} className="showcase-editor-row">
                    <div className="showcase-editor-row__main">
                      <div className="showcase-editor-row__title">{resolveWidgetLabel(widget.id, locale)}</div>
                      <div className="small showcase-editor-row__meta">
                        {widget.size === "wide" ? editorCopy.wideCard : editorCopy.baseCard}
                      </div>
                    </div>

                    <div className="showcase-editor-row__actions">
                      <button
                        type="button"
                        className="btn btn--subtle"
                        onClick={() => setShowcaseLayout((prev) => moveWidget(prev, index, index - 1))}
                        disabled={index === 0}
                      >
                        {editorCopy.moveUp}
                      </button>
                      <button
                        type="button"
                        className="btn btn--subtle"
                        onClick={() => setShowcaseLayout((prev) => moveWidget(prev, index, index + 1))}
                        disabled={index === showcaseLayout.widgets.length - 1}
                      >
                        {editorCopy.moveDown}
                      </button>
                      <button
                        type="button"
                        className="btn btn--subtle"
                        onClick={() => {
                          setShowcaseLayout((prev) => ({
                            ...prev,
                            widgets: prev.widgets.map((row) =>
                              row.id === widget.id ? { ...row, enabled: !row.enabled } : row
                            ),
                          }));
                        }}
                      >
                        {widget.enabled ? editorCopy.hide : editorCopy.show}
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

          <section className="surface-card minihome-settings">
            <div className="minihome-settings__head">
              <div className="pageHeader">
                <h2 className="sectionTitle">{copy.settingsTitle}</h2>
                <p className="sectionLead">{copy.settingsLead}</p>
              </div>
              <div className="action-row minihome-settings__actions">
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={() => setSettingsExpanded((current) => !current)}
                >
                  {settingsExpanded ? copy.closeSettings : copy.openSettings}
                </button>
                {!editing ? (
                  <button type="button" className="btn btn--subtle" onClick={handleEditStart}>
                    {copy.editProfile}
                  </button>
                ) : null}
              </div>
            </div>

            {settingsExpanded ? (
              editing ? (
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
              )
            ) : (
              <div className="small page-feedback">{copy.settingsCollapsedHint}</div>
            )}
          </section>

          <div className="profile-page__lists">
            <ProfilePeopleList title={copy.followersTitle} emptyText={copy.followersEmpty} people={followers} base={base} />
            <ProfilePeopleList title={copy.followingTitle} emptyText={copy.followingEmpty} people={following} base={base} />
          </div>
        </div>
      )}
    </div>
  );
}
