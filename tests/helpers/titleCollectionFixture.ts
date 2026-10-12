import type {Page} from '@playwright/test';
const cover = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='100%25' height='100%25' fill='%235f6c91'/%3E%3C/svg%3E";


export async function seedTitleCollection(page: Page) {
  await page.addInitScript((coverUrl) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("ko"));
    const memory = (id: string, title: string, note: string, updatedAt: string) => ({
      card: { id, note, updatedAt },
      title: { displayTitle: title },
      sourceKind: "CATALOG_COVER",
      visual: { kind: "IMAGE", src: coverUrl.replace("5f6c91", id === "memory-1" ? "e88598" : id === "memory-3" ? "80ae95" : "edbe70"), alt: `${title} 메모리` },
    });
    window.__MOEMOA_TEST_TITLE_COLLECTION_SERVICE__ = {
      load: async () => [{
        key: "ANILIST:154587",
        titleRef: { kind: "ANIME", animeId: "anime:11111111-1111-4111-8111-000000154587" },
        anilistId: 154587,
        displayTitle: "장송의 프리렌",
        aliases: ["Frieren"],
        genres: ["Adventure", "Fantasy"],
        catalogDetail: { release: { startDate: "2023-09-29" } },
        isPrivateTitle: false,
        officialCover: { src: coverUrl, width: 200, height: 300 },
        tracking: { isSaved: true, watchStatus: "보는중", rating: 5 },
        libraryItem: { addedAt: 30 },
        memoryCount: 3,
        latestMemoryAt: "2026-09-03T03:00:00.000Z",
        memories: [memory("memory-1", "장송의 프리렌", "눈 내리던 장면이 오래 남았다.", "2026-09-03T03:00:00.000Z"), memory("memory-3", "장송의 프리렌", "합성 기억3", "2026-09-02T03:00:00.000Z"), memory("memory-4", "장송의 프리렌", "합성 기억4", "2026-09-01T03:00:00.000Z")],
        previewMemories: [memory("memory-1", "장송의 프리렌", "눈 내리던 장면이 오래 남았다.", "2026-09-03T03:00:00.000Z"), memory("memory-3", "장송의 프리렌", "합성 기억3", "2026-09-02T03:00:00.000Z"), memory("memory-4", "장송의 프리렌", "합성 기억4", "2026-09-01T03:00:00.000Z")],
      }, {
        key: "ANILIST:153518",
        titleRef: { kind: "ANIME", animeId: "anime:22222222-2222-4222-8222-000000153518" },
        anilistId: 153518,
        displayTitle: "던전밥",
        aliases: ["Delicious in Dungeon"],
        genres: ["Comedy", "Fantasy"],
        catalogDetail: { release: { startDate: "2024-01-04" } },
        isPrivateTitle: false,
        officialCover: { src: coverUrl, width: 200, height: 300 },
        tracking: { isSaved: true, watchStatus: "완료", rating: 4 },
        libraryItem: { addedAt: 20 },
        memoryCount: 0,
        latestMemoryAt: null,
        memories: [],
        previewMemories: [],
      }, {
        key: "PRIVATE:private-one",
        titleRef: { kind: "PRIVATE_TITLE", privateTitleId: "private-one" },
        anilistId: null,
        displayTitle: "나만의 여름 애니",
        aliases: [],
        genres: ["Slice of Life"],
        catalogDetail: null,
        isPrivateTitle: true,
        officialCover: null,
        tracking: { isSaved: false, watchStatus: null },
        libraryItem: null,
        memoryCount: 1,
        latestMemoryAt: "2026-09-02T03:00:00.000Z",
        memories: [memory("memory-2", "나만의 여름 애니", "여름밤의 색감.", "2026-09-02T03:00:00.000Z")],
        previewMemories: [memory("memory-2", "나만의 여름 애니", "여름밤의 색감.", "2026-09-02T03:00:00.000Z")],
      }],
    };
  }, cover);
}
