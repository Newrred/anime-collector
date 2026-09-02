import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryCardCommand } from "../../src/features/memory/application/createMemoryCard.js";

const OWNER_ID = "guest:11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-12T01:00:00.000Z";

class FakeRepository {
  constructor() {
    this.operations = new Map();
    this.titles = new Map();
    this.animeRefs = new Map();
    this.cards = new Map();
    this.assets = new Map();
  }

  async getOperation(ownerId, operationId) {
    const operation = this.operations.get(operationId) || null;
    return operation?.ownerId === ownerId ? structuredClone(operation) : null;
  }

  async countCompleteCards(ownerId) {
    return [...this.cards.values()].filter(
      (card) => card.ownerId === ownerId && card.status === "COMPLETE_PRIVATE",
    ).length;
  }

  async findAnimeRefBySourceKey(sourceKey) {
    return [...this.animeRefs.values()].find((animeRef) => animeRef.sourceKey === sourceKey) || null;
  }

  async reserveCreate({ title, animeRef, card, asset, operation }) {
    if (title) this.titles.set(title.id, structuredClone(title));
    if (animeRef) this.animeRefs.set(animeRef.id, structuredClone(animeRef));
    this.cards.set(card.id, structuredClone(card));
    this.assets.set(asset.id, structuredClone(asset));
    this.operations.set(operation.id, structuredClone(operation));
  }

  async completeCreate({ title, animeRef, card, asset, operation }) {
    if (title) this.titles.set(title.id, structuredClone(title));
    if (animeRef) this.animeRefs.set(animeRef.id, structuredClone(animeRef));
    this.cards.set(card.id, structuredClone(card));
    this.assets.set(asset.id, structuredClone(asset));
    this.operations.set(operation.id, structuredClone(operation));
  }

  async failOperation({ ownerId, operationId, errorCode, now }) {
    const operation = this.operations.get(operationId);
    assert.equal(operation.ownerId, ownerId);
    this.operations.set(operationId, {
      ...operation,
      state: "FAILED",
      attemptCount: operation.attemptCount,
      lastErrorCode: errorCode,
      updatedAt: now,
    });
  }
}

const createHarness = ({ promoteError } = {}) => {
  const repository = new FakeRepository();
  const calls = { promote: 0, events: [] };
  const command = createMemoryCardCommand({
    repository,
    localMedia: {
      async promoteTicket({ ticketId, assetId }) {
        calls.promote += 1;
        if (promoteError) throw Object.assign(new Error("native detail must stay private"), { code: promoteError });
        assert.equal(ticketId, "ticket-1");
        assert.equal(assetId, "asset-1");
        return {
          localRef: "asset:asset-1",
          checksumSha256: "a".repeat(64),
          mimeType: "image/png",
          byteSize: 1024,
          width: 800,
          height: 450,
        };
      },
    },
    telemetry: {
      track(name, properties) {
        calls.events.push({ name, properties });
      },
    },
    clock: { now: () => NOW },
    ids: { next: (kind) => ({
      card: "card-1",
      asset: "asset-1",
      privateTitle: "title-1",
      animeRef: "anime-ref-1",
    })[kind] },
  });
  return { command, repository, calls };
};

const input = () => ({
  operationId: "operation-1",
  ownerId: OWNER_ID,
  titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "Frieren" },
  intakeTicketId: "ticket-1",
  note: "A note that must never enter telemetry",
  rightsConfirmed: true,
});

test("create command reserves then completes a local-only private card", async () => {
  const { command, repository, calls } = createHarness();

  const result = await command.execute(input());

  assert.deepEqual(result, {
    operationId: "operation-1",
    cardId: "card-1",
    visualAssetId: "asset-1",
    privateTitleId: "title-1",
  });
  assert.equal(repository.cards.get("card-1").status, "COMPLETE_PRIVATE");
  assert.equal(repository.assets.get("asset-1").state, "READY");
  assert.equal(repository.assets.get("asset-1").localRef, "asset:asset-1");
  assert.equal(repository.assets.get("asset-1").imageType, "UNKNOWN");
  assert.equal(repository.assets.get("asset-1").rightsBasis, "UNKNOWN");
  assert.equal(repository.operations.get("operation-1").state, "COMPLETED");
  assert.equal(calls.promote, 1);
  assert.deepEqual(calls.events, [{
    name: "first_memory_card_saved",
    properties: { storageScope: "LOCAL_ONLY", titleKind: "PRIVATE_TITLE" },
  }]);
  assert.doesNotMatch(JSON.stringify(calls.events), /Frieren|note/i);
});

test("completed operation is idempotent and does not promote the ticket twice", async () => {
  const { command, calls } = createHarness();

  const first = await command.execute(input());
  const second = await command.execute(input());

  assert.deepEqual(second, first);
  assert.equal(calls.promote, 1);
});

test("native failure is reduced to a typed code and leaves no complete card", async () => {
  const { command, repository, calls } = createHarness({ promoteError: "MEDIA_STORAGE_FULL" });

  await assert.rejects(() => command.execute(input()), { code: "MEDIA_STORAGE_FULL" });

  assert.equal(repository.cards.get("card-1").status, "DRAFT");
  assert.equal(repository.assets.get("asset-1").state, "IMPORTING");
  assert.equal(repository.operations.get("operation-1").state, "FAILED");
  assert.equal(repository.operations.get("operation-1").lastErrorCode, "MEDIA_STORAGE_FULL");
  assert.equal(repository.operations.get("operation-1").attemptCount, 1);
  assert.deepEqual(calls.events, []);
});

test("create command rejects missing local-use confirmation before reserving records", async () => {
  const { command, repository, calls } = createHarness();
  const unconfirmed = { ...input(), rightsConfirmed: false };

  await assert.rejects(() => command.execute(unconfirmed), { code: "LOCAL_USE_CONFIRMATION_REQUIRED" });

  assert.equal(repository.operations.size, 0);
  assert.equal(calls.promote, 0);
});

test("system design completes without native media or local-use confirmation", async () => {
  const { command, repository, calls } = createHarness();
  const designInput = {
    operationId: "operation-1",
    ownerId: OWNER_ID,
    titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "Frieren" },
    systemDesignSpec: {
      version: 1,
      templateId: "memory-gradient",
      paletteId: "violet-dawn",
      patternSeed: "seed-1",
      titleLayout: "BOTTOM_LEFT",
      genreTokens: [],
    },
    note: "system memory",
    rightsConfirmed: false,
  };

  await command.execute(designInput);

  const asset = repository.assets.get("asset-1");
  assert.equal(calls.promote, 0);
  assert.equal(asset.state, "READY");
  assert.equal(asset.imageType, "SYSTEM_DESIGN");
  assert.equal(asset.rightsBasis, "SYSTEM_GENERATED");
  assert.equal(asset.localRef, null);
  assert.deepEqual(asset.designSpec, designInput.systemDesignSpec);
  assert.equal(repository.cards.get("card-1").status, "COMPLETE_PRIVATE");
});

test("selected catalog candidate creates an AnimeRef card without retaining provider artwork", async () => {
  const { command, repository, calls } = createHarness();
  const animeInput = {
    operationId: "operation-1",
    ownerId: OWNER_ID,
    titleChoice: {
      kind: "ANIME_REF",
      animeId: "anime:11111111-1111-4111-8111-000000154587",
      displayTitle: "Frieren: Beyond Journey's End",
      aliases: ["Sousou no Frieren", "葬送のフリーレン"],
      genres: ["Adventure", "Fantasy"],
      sourceBinding: { provider: "ANILIST", externalId: "154587" },
      verificationState: "PROVIDER_CANDIDATE",
      coverImage: "https://cdn.example/private-provider-art.jpg",
    },
    systemDesignSpec: {
      version: 1,
      templateId: "memory-gradient",
      paletteId: "violet-dawn",
      patternSeed: "seed-1",
      titleLayout: "BOTTOM_LEFT",
      genreTokens: ["Adventure", "Fantasy"],
    },
  };

  const result = await command.execute(animeInput);

  assert.deepEqual(result, {
    operationId: "operation-1",
    cardId: "card-1",
    visualAssetId: "asset-1",
    animeRefId: "anime-ref-1",
  });
  assert.equal(repository.cards.get("card-1").animeRefId, "anime-ref-1");
  assert.equal(repository.cards.get("card-1").privateTitleId, null);
  assert.equal(repository.titles.size, 0);
  assert.deepEqual(repository.animeRefs.get("anime-ref-1").sourceBinding, {
    provider: "ANILIST",
    externalId: "154587",
  });
  assert.equal(
    repository.animeRefs.get("anime-ref-1").catalogAnimeId,
    "anime:11111111-1111-4111-8111-000000154587",
  );
  assert.equal("coverImage" in repository.animeRefs.get("anime-ref-1"), false);
  assert.deepEqual(calls.events, [
    { name: "system_design_selected", properties: { templateId: "memory-gradient" } },
    {
      name: "first_memory_card_saved",
      properties: { storageScope: "LOCAL_ONLY", titleKind: "ANIME_REF" },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(calls.events), /Frieren|154587|https?/i);
});
