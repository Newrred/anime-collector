import { assertCompletePrivateCard, createDefaultSyncEnvelope, createPrivateTitle, requireOwnerId } from "../domain/memoryDomain.js";
import { createMemoryBoard, createBoardCard } from "../domain/memoryBoard.js";

export const BACKUP_STORES = ["private_titles", "anime_refs", "visual_assets", "memory_cards", "memory_boards", "memory_board_cards"];
const fail = () => { throw Object.assign(new Error("Invalid Memory backup"), { code: "INVALID_MEMORY_BACKUP" }); };
const unique = (rows) => new Map(rows.map((row) => [row.id, row]));

export function createMemoryBackup(rows, ownerId, now) {
  const cards = rows.memory_cards.filter((r) => r.ownerId === ownerId && r.status === "COMPLETE_PRIVATE" && !r.deletedAt);
  const ids = (field) => new Set(cards.map((c) => c[field]).filter(Boolean));
  const privateIds = ids("privateTitleId"), animeIds = ids("animeRefId"), assetIds = ids("visualAssetId");
  const boards = rows.memory_boards.filter((r) => r.ownerId === ownerId && !r.deletedAt);
  const boardIds = new Set(boards.map((r) => r.id)), cardIds = new Set(cards.map((r) => r.id));
  const data = {
    private_titles: rows.private_titles.filter((r) => r.ownerId === ownerId && privateIds.has(r.id)),
    anime_refs: rows.anime_refs.filter((r) => animeIds.has(r.id)),
    visual_assets: rows.visual_assets.filter((r) => r.ownerId === ownerId && assetIds.has(r.id)).map((r) => ({ ...r, localRef: null })),
    memory_cards: cards,
    memory_boards: boards,
    memory_board_cards: rows.memory_board_cards.filter((r) => r.ownerId === ownerId && !r.deletedAt && boardIds.has(r.boardId) && cardIds.has(r.cardId)),
  };
  return { format: "moemoa-memory-metadata", version: 1, exportedAt: now, sourceOwnerId: ownerId, includesImageFiles: false, data };
}

export function prepareMemoryRestore(snapshot, ownerId, nextId = () => crypto.randomUUID()) {
  requireOwnerId(ownerId);
  // Account import needs its own promotion/sync flow; never bypass the outbox.
  if (!ownerId.startsWith("guest:")) throw Object.assign(new Error("Restore while signed out"), { code: "BACKUP_GUEST_ONLY" });
  if (snapshot?.format !== "moemoa-memory-metadata" || snapshot.version !== 1 || snapshot.includesImageFiles !== false) fail();
  const source = requireOwnerId(snapshot.sourceOwnerId);
  const data = snapshot.data;
  if (!data || BACKUP_STORES.some((key) => !Array.isArray(data[key]) || data[key].length > 50000)) fail();
  const maps = {};
  for (const key of BACKUP_STORES) {
    if (data[key].some((r) => !r || typeof r.id !== "string" || !r.id || (key !== "anime_refs" && r.ownerId !== source))) fail();
    if (unique(data[key]).size !== data[key].length) fail();
    maps[key] = new Map(data[key].map((r) => [r.id, nextId()]));
  }
  const ref = (key, id) => id == null ? null : maps[key].get(id) || fail();
  const transformed = Object.fromEntries(BACKUP_STORES.map((key) => [key, data[key].map((r) => {
    if (!Number.isFinite(Date.parse(r.createdAt)) || !Number.isFinite(Date.parse(r.updatedAt))) fail();
    const row = { ...structuredClone(r), id: maps[key].get(r.id), ...(key === "anime_refs" ? {} : { ownerId }), sync: createDefaultSyncEnvelope(r.updatedAt) };
    if (key === "visual_assets") { row.localRef = null; if (r.cardId != null) row.cardId = ref("memory_cards", r.cardId); }
    if (key === "memory_cards") Object.assign(row, {privateTitleId: ref("private_titles", r.privateTitleId), animeRefId: ref("anime_refs", r.animeRefId), visualAssetId: ref("visual_assets", r.visualAssetId)});
    if (key === "memory_board_cards") Object.assign(row, {boardId: ref("memory_boards", r.boardId), cardId: ref("memory_cards", r.cardId)});
    return row;
  })]));
  const titles = unique(transformed.private_titles), anime = unique(transformed.anime_refs), assets = unique(transformed.visual_assets);
  for (const title of transformed.private_titles) createPrivateTitle({ ...title, now: title.createdAt });
  for (const card of transformed.memory_cards) {
    if (card.deletedAt || String(card.note || "").length > 500) fail();
    assertCompletePrivateCard({card, title: titles.get(card.privateTitleId), animeRef: anime.get(card.animeRefId), asset: assets.get(card.visualAssetId)});
  }
  for (const board of transformed.memory_boards) {
    if (board.deletedAt || board.visibility !== "PRIVATE") fail();
    createMemoryBoard({ ...board, now: board.createdAt });
  }
  const memberships = new Set();
  for (const row of transformed.memory_board_cards) {
    if (row.deletedAt || memberships.has(`${row.boardId}:${row.cardId}`)) fail();
    memberships.add(`${row.boardId}:${row.cardId}`);
    createBoardCard({ ...row, now: row.createdAt });
  }
  return transformed;
}
