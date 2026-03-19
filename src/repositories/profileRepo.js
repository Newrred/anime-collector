import { supabase } from "../lib/supabaseClient.js";
import {
  listMockFollowers,
  readMockAuthSession,
  readMockProfileRow,
  writeMockProfileRow,
} from "./mockAuthStorage.js";
import {
  buildDefaultProfileDraft,
  buildPublicProfilePath,
  isValidProfileHandle,
  normalizeProfileBio,
  normalizeProfileDisplayName,
  normalizeProfileHandle,
  suggestProfileHandle,
} from "../domain/profileUtils.js";

const PROFILE_TABLE = "user_profiles";
const FOLLOW_TABLE = "user_follows";
const PROFILE_FIELDS = "user_id,handle,display_name,bio,profile_public,created_at,updated_at";

function shouldUseMockProfileStore(userId = null) {
  if (supabase) return false;
  const mockSession = readMockAuthSession();
  const sessionUserId = String(mockSession?.user?.id || "").trim();
  if (!sessionUserId) return false;
  if (userId == null) return true;
  return sessionUserId === String(userId || "").trim();
}

function normalizeMockProfileRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    userId: String(row.userId || row.user_id || "").trim(),
    handle: String(row.handle || "").trim().toLowerCase(),
    displayName: String(row.displayName || row.display_name || "").trim(),
    bio: String(row.bio || ""),
    profilePublic: row.profilePublic === true || row.profile_public === true,
    createdAt: String(row.createdAt || row.created_at || "").trim() || null,
    updatedAt: String(row.updatedAt || row.updated_at || "").trim() || null,
  };
}

function toMockProfileRow(profile) {
  const normalized = normalizeMockProfileRow(profile);
  if (!normalized) return null;
  return {
    userId: normalized.userId,
    handle: normalized.handle,
    displayName: normalized.displayName,
    bio: normalized.bio,
    profilePublic: normalized.profilePublic,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
}

function basePath() {
  const rawBase = String(import.meta.env.BASE_URL || "/");
  return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
}

function normalizeProfileRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    userId: String(row.user_id || "").trim(),
    handle: String(row.handle || "").trim().toLowerCase(),
    displayName: String(row.display_name || "").trim(),
    bio: String(row.bio || ""),
    profilePublic: row.profile_public === true,
    createdAt: String(row.created_at || "").trim() || null,
    updatedAt: String(row.updated_at || "").trim() || null,
  };
}

function dedupeIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function mapProfilesByOrder(rows, orderedIds) {
  const map = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row?.userId || ""), row]));
  return orderedIds.map((id) => map.get(id)).filter(Boolean);
}

function toPublicProfilePayload(userId, patch, fallback = {}) {
  const handle = normalizeProfileHandle(patch?.handle, fallback?.handle || suggestProfileHandle({ id: userId }));
  if (!isValidProfileHandle(handle)) {
    throw new Error("Handle must use 3-24 lowercase letters, numbers, or hyphens.");
  }

  return {
    user_id: userId,
    handle,
    display_name: normalizeProfileDisplayName(patch?.displayName, fallback?.displayName || ""),
    bio: normalizeProfileBio(patch?.bio),
    avatar_url: null,
    profile_public: patch?.profilePublic === true,
    updated_at: new Date().toISOString(),
  };
}

async function listProfilesByIds(userIds) {
  const ids = dedupeIds(userIds);
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select(PROFILE_FIELDS)
    .in("user_id", ids);
  if (error) throw error;
  const profiles = (data || []).map(normalizeProfileRow).filter(Boolean);
  return mapProfilesByOrder(profiles, ids);
}

export function buildPublicProfileUrl(handle) {
  const path = buildPublicProfilePath(handle, basePath());
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export async function getMyProfile(userId) {
  if (shouldUseMockProfileStore(userId)) {
    return normalizeMockProfileRow(readMockProfileRow(userId));
  }
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select(PROFILE_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeProfileRow(data);
}

export async function ensureMyProfile(user) {
  if (shouldUseMockProfileStore(user?.id)) {
    const existing = normalizeMockProfileRow(readMockProfileRow(user.id));
    if (existing) return existing;

    const draft = buildDefaultProfileDraft(user);
    const next = {
      userId: String(user.id),
      handle: normalizeProfileHandle(draft.handle, `user-${String(user.id).slice(0, 8).toLowerCase()}`),
      displayName: normalizeProfileDisplayName(draft.displayName, draft.handle),
      bio: normalizeProfileBio(draft.bio),
      profilePublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeMockProfileRow(user.id, next);
    return next;
  }
  if (!supabase || !user?.id) return null;

  const existing = await getMyProfile(user.id);
  if (existing) return existing;

  const draft = buildDefaultProfileDraft(user);
  const baseHandle = normalizeProfileHandle(draft.handle, `user-${String(user.id).slice(0, 8).toLowerCase()}`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const handle = normalizeProfileHandle(`${baseHandle}${suffix}`, `user-${String(user.id).slice(0, 8).toLowerCase()}`);
    const row = {
      user_id: user.id,
      handle,
      display_name: normalizeProfileDisplayName(draft.displayName, draft.handle),
      bio: normalizeProfileBio(draft.bio),
      avatar_url: null,
      profile_public: false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .insert(row)
      .select(PROFILE_FIELDS)
      .single();
    if (!error) return normalizeProfileRow(data);
    if (error.code !== "23505" && !/duplicate/i.test(String(error.message || ""))) {
      throw error;
    }
  }

  throw new Error("Could not reserve a profile handle. Try again.");
}

export async function saveMyProfile(userId, patch, currentProfile = null) {
  if (shouldUseMockProfileStore(userId)) {
    const fallback = currentProfile || normalizeMockProfileRow(readMockProfileRow(userId)) || {};
    const handle = normalizeProfileHandle(patch?.handle, fallback?.handle || suggestProfileHandle({ id: userId }));
    if (!isValidProfileHandle(handle)) {
      throw new Error("Handle must use 3-24 lowercase letters, numbers, or hyphens.");
    }
    const saved = {
      userId: String(userId),
      handle,
      displayName: normalizeProfileDisplayName(patch?.displayName, fallback?.displayName || ""),
      bio: normalizeProfileBio(patch?.bio),
      profilePublic: patch?.profilePublic === true,
      createdAt: fallback?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeMockProfileRow(userId, saved);
    return saved;
  }
  if (!supabase || !userId) throw new Error("Profile save requires a signed-in user.");
  const fallback = currentProfile || {};
  const row = toPublicProfilePayload(userId, patch, fallback);
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .upsert(row, { onConflict: "user_id" })
    .select(PROFILE_FIELDS)
    .single();
  if (error) {
    if (error.code === "23505" || /duplicate/i.test(String(error.message || ""))) {
      throw new Error("That handle is already in use.");
    }
    throw error;
  }
  return normalizeProfileRow(data);
}

export async function getPublicProfileByHandle(handle) {
  if (shouldUseMockProfileStore()) {
    const normalizedHandle = normalizeProfileHandle(handle);
    const mockSession = readMockAuthSession();
    const ownProfile = normalizeMockProfileRow(readMockProfileRow(mockSession?.user?.id));
    if (ownProfile?.handle === normalizedHandle) return ownProfile;
    return null;
  }
  if (!supabase) return null;
  const normalizedHandle = normalizeProfileHandle(handle);
  if (!isValidProfileHandle(normalizedHandle)) return null;
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select(PROFILE_FIELDS)
    .eq("handle", normalizedHandle)
    .maybeSingle();
  if (error) throw error;
  return normalizeProfileRow(data);
}

export async function getFollowCounts(userId) {
  if (shouldUseMockProfileStore(userId)) {
    return { followers: listMockFollowers(userId).length, following: 0 };
  }
  if (!supabase || !userId) return { followers: 0, following: 0 };
  const [{ count: followers, error: followerError }, { count: following, error: followingError }] = await Promise.all([
    supabase.from(FOLLOW_TABLE).select("*", { count: "exact", head: true }).eq("followed_user_id", userId),
    supabase.from(FOLLOW_TABLE).select("*", { count: "exact", head: true }).eq("follower_user_id", userId),
  ]);
  if (followerError) throw followerError;
  if (followingError) throw followingError;
  return {
    followers: Number(followers || 0),
    following: Number(following || 0),
  };
}

export async function listFollowers(userId, limit = 24) {
  if (shouldUseMockProfileStore(userId)) {
    return listMockFollowers(userId)
      .slice(0, limit)
      .map(toMockProfileRow)
      .filter(Boolean);
  }
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from(FOLLOW_TABLE)
    .select("follower_user_id,created_at")
    .eq("followed_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = (data || []).map((row) => row.follower_user_id);
  return listProfilesByIds(ids);
}

export async function listFollowing(userId, limit = 24) {
  if (shouldUseMockProfileStore(userId)) {
    return listMockFollowers(`following:${userId}`)
      .slice(0, limit)
      .map(toMockProfileRow)
      .filter(Boolean);
  }
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from(FOLLOW_TABLE)
    .select("followed_user_id,created_at")
    .eq("follower_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = (data || []).map((row) => row.followed_user_id);
  return listProfilesByIds(ids);
}

export async function isFollowingProfile(followerUserId, followedUserId) {
  if (shouldUseMockProfileStore(followerUserId)) {
    return listMockFollowers(`following:${followerUserId}`).some(
      (row) => String(row?.userId || "") === String(followedUserId || "")
    );
  }
  if (!supabase || !followerUserId || !followedUserId) return false;
  const { data, error } = await supabase
    .from(FOLLOW_TABLE)
    .select("follower_user_id")
    .eq("follower_user_id", followerUserId)
    .eq("followed_user_id", followedUserId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function followProfile(followerUserId, followedUserId) {
  if (shouldUseMockProfileStore(followerUserId)) {
    return true;
  }
  if (!supabase || !followerUserId || !followedUserId) throw new Error("Follow requires a signed-in user.");
  if (String(followerUserId) === String(followedUserId)) throw new Error("You cannot follow yourself.");
  const { error } = await supabase.from(FOLLOW_TABLE).insert({
    follower_user_id: followerUserId,
    followed_user_id: followedUserId,
  });
  if (error && error.code !== "23505") throw error;
  return true;
}

export async function unfollowProfile(followerUserId, followedUserId) {
  if (shouldUseMockProfileStore(followerUserId)) {
    return true;
  }
  if (!supabase || !followerUserId || !followedUserId) throw new Error("Unfollow requires a signed-in user.");
  const { error } = await supabase
    .from(FOLLOW_TABLE)
    .delete()
    .eq("follower_user_id", followerUserId)
    .eq("followed_user_id", followedUserId);
  if (error) throw error;
  return true;
}
