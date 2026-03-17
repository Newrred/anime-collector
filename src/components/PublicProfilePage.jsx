import { useEffect, useMemo, useState } from "react";
import { getMessageGroup } from "../domain/messages.js";
import { isValidProfileHandle } from "../domain/profileUtils.js";
import { useUiPreferences } from "../hooks/useUiPreferences.js";
import { useAuthSession } from "../hooks/useAuthSession.js";
import {
  buildPublicProfileUrl,
  followProfile,
  getFollowCounts,
  getPublicProfileByHandle,
  isFollowingProfile,
  listFollowers,
  listFollowing,
  unfollowProfile,
} from "../repositories/profileRepo.js";
import { DEFAULT_SHOWCASE_LAYOUT, readPublicShowcaseSnapshot } from "../repositories/showcaseRepo.js";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { IconArrowRight, IconCopy, IconShare } from "./ui/AppIcons.jsx";
import { ProfileAvatar, ProfileMetric, ProfilePeopleList } from "./profile/ProfileUi.jsx";
import ShowcaseGrid from "./showcase/ShowcaseGrid.jsx";

export default function PublicProfilePage() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = getMessageGroup(locale, "profilePage");
  const auth = useAuthSession(
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/u/"
  );
  const [handle, setHandle] = useState("");
  const [profile, setProfile] = useState(null);
  const [publicShowcase, setPublicShowcase] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setHandle(String(params.get("handle") || "").trim().toLowerCase());
  }, []);

  async function refreshProfileState(nextHandle, viewerId = auth.user?.id || null) {
    if (!nextHandle || !isValidProfileHandle(nextHandle)) {
      setProfile(null);
      setPublicShowcase(null);
      setCounts({ followers: 0, following: 0 });
      setFollowers([]);
      setFollowing([]);
      setIsFollowing(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextProfile = await getPublicProfileByHandle(nextHandle);
      if (!nextProfile) {
        setProfile(null);
        setPublicShowcase(null);
        setCounts({ followers: 0, following: 0 });
        setFollowers([]);
        setFollowing([]);
        setIsFollowing(false);
        return;
      }

      const [nextCounts, nextFollowers, nextFollowing, nextIsFollowing, nextShowcase] = await Promise.all([
        getFollowCounts(nextProfile.userId),
        listFollowers(nextProfile.userId),
        listFollowing(nextProfile.userId),
        viewerId && viewerId !== nextProfile.userId
          ? isFollowingProfile(viewerId, nextProfile.userId)
          : Promise.resolve(false),
        readPublicShowcaseSnapshot(nextProfile.userId),
      ]);

      setProfile(nextProfile);
      setPublicShowcase(nextShowcase);
      setCounts(nextCounts);
      setFollowers(nextFollowers);
      setFollowing(nextFollowing);
      setIsFollowing(nextIsFollowing);
    } catch (error) {
      console.error(error);
      setMessage(`${copy.loadFailed}: ${error?.message || copy.unknownError}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProfileState(handle, auth.user?.id || null);
  }, [handle, auth.user?.id]);

  const shareUrl = useMemo(() => (profile?.handle ? buildPublicProfileUrl(profile.handle) : ""), [profile?.handle]);

  async function copyProfileLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage(copy.linkCopied);
    } catch {
      setMessage(copy.copyFailed);
    }
  }

  async function shareProfileLink() {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: copy.shareTitle,
          text: copy.shareBody,
          url: shareUrl,
        });
        setMessage(copy.shareSucceeded);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setMessage(copy.shareCancelled);
        return;
      }
    }
    await copyProfileLink();
  }

  async function handleFollowToggle() {
    if (!profile) return;
    if (!auth.user) {
      await auth.signIn(`${base}u/?handle=${encodeURIComponent(profile.handle)}`);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (isFollowing) {
        await unfollowProfile(auth.user.id, profile.userId);
        setMessage(copy.unfollowed);
      } else {
        await followProfile(auth.user.id, profile.userId);
        setMessage(copy.followed);
      }
      await refreshProfileState(profile.handle, auth.user.id);
    } catch (error) {
      console.error(error);
      setMessage(`${isFollowing ? copy.unfollowFailed : copy.followFailed}: ${error?.message || copy.unknownError}`);
    } finally {
      setBusy(false);
    }
  }

  const isOwnProfile = Boolean(auth.user?.id && profile?.userId && auth.user.id === profile.userId);

  return (
    <div className="profile-page">
      <TopNavDataMenu
        base={base}
        panelId="public-profile-menu-panel"
        currentRoute="profile"
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || (locale === "ko" ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />

      {!handle ? (
        <section className="surface-card profile-signin-card">
          <div className="pageHeader">
            <h1 className="pageTitle">{copy.publicTitle}</h1>
            <p className="pageLead">{copy.missingHandle}</p>
          </div>
        </section>
      ) : !profile && !loading ? (
        <section className="surface-card profile-signin-card">
          <div className="pageHeader">
            <h1 className="pageTitle">{copy.publicTitle}</h1>
            <p className="pageLead">{copy.notFound}</p>
          </div>
        </section>
      ) : (
        <div className="profile-page__stack">
          <section className="surface-card profile-hero-card">
            <div className="profile-hero-card__header">
              <ProfileAvatar profile={profile} size={72} />
              <div className="pageHeader profile-hero-card__copy">
                <div className="small profile-kicker">{copy.publicTitle}</div>
                <h1 className="pageTitle">{profile?.displayName || copy.publicTitle}</h1>
                <p className="pageLead">@{profile?.handle || handle}</p>
                {profile?.bio ? <p className="sectionLead">{profile.bio}</p> : null}
              </div>
            </div>

            <div className="metric-grid profile-metric-grid">
              <ProfileMetric label={copy.followersLabel} value={counts.followers} />
              <ProfileMetric label={copy.followingLabel} value={counts.following} />
            </div>

            <div className="action-row">
              <button type="button" className="btn btn--subtle" onClick={copyProfileLink}>
                <span className="btn__icon">
                  <IconCopy size={14} />
                </span>
                <span className="btn__label">{copy.copyLink}</span>
              </button>
              <button type="button" className="btn btn--subtle" onClick={shareProfileLink}>
                <span className="btn__icon">
                  <IconShare size={14} />
                </span>
                <span className="btn__label">{copy.shareLink}</span>
              </button>
              {isOwnProfile ? (
                <a href={`${base}profile/`} className="btn">
                  <span className="btn__icon">
                    <IconArrowRight size={14} />
                  </span>
                  <span className="btn__label">{copy.openOwnProfile}</span>
                </a>
              ) : (
                <button type="button" className="btn" onClick={handleFollowToggle} disabled={busy || loading}>
                  {auth.user ? (isFollowing ? copy.unfollow : copy.follow) : copy.signInToFollow}
                </button>
              )}
            </div>
            {message ? <div className="small page-feedback">{message}</div> : null}
            {loading ? <div className="small page-feedback">{copy.loading}</div> : null}
          </section>

          {publicShowcase?.widgets ? (
            <ShowcaseGrid
              locale={locale}
              model={publicShowcase.widgets}
              layout={publicShowcase.layout || DEFAULT_SHOWCASE_LAYOUT}
            />
          ) : (
            <section className="surface-card ui-panel-stack">
              <h2 className="sectionTitle">{copy.noShowcaseTitle}</h2>
              <p className="sectionLead">{copy.noShowcaseLead}</p>
            </section>
          )}

          <div className="profile-page__lists">
            <ProfilePeopleList title={copy.followersTitle} emptyText={copy.followersEmpty} people={followers} base={base} />
            <ProfilePeopleList title={copy.followingTitle} emptyText={copy.followingEmpty} people={following} base={base} />
          </div>
        </div>
      )}
    </div>
  );
}
