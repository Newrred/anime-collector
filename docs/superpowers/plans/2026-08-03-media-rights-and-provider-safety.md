# MOEMOA Media Rights and Provider Safety Implementation Plan

> **문서 상태: `SUPERSEDED` — 현재 계획으로 실행 금지**
> 공급자 차단 가능성의 문제의식은 유효하지만 `anilistId` 호환 키 중심 구조와 당시 rollout은 최신 catalog/image 규칙이 대체했다. 현재 기준은 [`04_CATALOG_DATA_AND_INGESTION_SPEC.md`](../../moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md)와 [`05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`](../../moemoa/05_IMAGE_UGC_POLICY_MODERATION_SPEC.md)를 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AniList 답변이 허용·부분 허용·불허 중 어느 경우여도 작품 데이터와 이미지를 안전하게 끄거나 교체할 수 있는 출시 구조를 만든다.

**Architecture:** 현재 AniList 직접 호출을 `mediaCatalog` 서비스 뒤로 숨기고, 별도의 media policy가 반환 데이터에서 이미지 URL을 제거하거나 허용한다. 사용자 라이브러리와 백업에는 공급자·원본 ID·권리 상태를 보존하되 기존 `anilistId`를 호환 키로 유지한다. 배포 전 검사 스크립트가 공개 채널에서 서면 승인 근거 없이 AniList 또는 원격 이미지를 활성화하지 못하게 한다.

**Tech Stack:** Astro 5, React 19, JavaScript ES modules, AniList GraphQL, IndexedDB, localStorage, Node test runner, Playwright

## Global Constraints

- AniList의 서면 승인 전 `PUBLIC_RELEASE_CHANNEL=public` 또는 `closed-beta` 배포를 허용하지 않는다.
- API 사용 승인과 표지 이미지 사용 승인을 별도 상태로 기록한다.
- `PUBLIC_MEDIA_ARTWORK_MODE=off`가 안전한 기본값이다.
- 이미지 핫링크는 저작권 허락으로 취급하지 않는다.
- AniList 응답의 이미지 바이너리를 MOEMOA 서버나 스토리지에 복제하지 않는다.
- 광고 소재와 공유 카드에는 별도 사용 허가가 없는 애니 포스터·배너·캐릭터 이미지를 넣지 않는다.
- 기존 version 5 백업은 계속 가져올 수 있어야 하며 새 내보내기는 version 6을 사용한다.
- 법률 페이지는 사실관계와 연락 창구를 제공하지만 법률 자문을 대신하지 않는다.

## File Structure

- `src/config/mediaPolicy.js`: 빌드 환경에서 공급자·아트워크 모드를 읽는 단일 위치.
- `src/domain/mediaRights.js`: media 객체에서 이미지 제거, 권리 상태 정규화, placeholder 색상 계산.
- `src/services/mediaCatalog.js`: AniList 구현을 감싸는 공급자 중립 API.
- `src/components/ui/MediaArtwork.jsx`: 이미지 허용 상태와 fallback을 일관되게 렌더링.
- `scripts/validate-release.mjs`: 공개 배포 전 승인·연락처·이미지 설정을 검사.
- `docs/launch/ANILIST_RIGHTS_RUNBOOK.md`: 문의·회신·증빙·설정 분기 운영 문서.

---

### Task 1: 미디어 정책과 공개 배포 차단 규칙 구현

**Files:**
- Create: `.env.example`
- Create: `src/config/mediaPolicy.js`
- Create: `src/domain/mediaRights.js`
- Create: `tests/unit/mediaRights.test.mjs`
- Create: `scripts/validate-release.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `package.json:5-18`

**Interfaces:**
- Consumes: `PUBLIC_RELEASE_CHANNEL`, `PUBLIC_MEDIA_PROVIDER`, `PUBLIC_MEDIA_ARTWORK_MODE`, `ANILIST_AUTHORIZATION_REF`, `PUBLIC_LEGAL_CONTACT_EMAIL`.
- Produces: `MEDIA_POLICY`, `sanitizeMediaForPolicy(media, policy)`, `npm run validate:release`, `npm run build:release`.

- [ ] **Step 1: 권리 정책의 실패 테스트를 작성한다**

```js
// tests/unit/mediaRights.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMediaPolicy, sanitizeMediaForPolicy } from "../../src/domain/mediaRights.js";

test("artwork is removed when mode is off", () => {
  const policy = normalizeMediaPolicy({ provider: "anilist", artworkMode: "off" });
  const media = sanitizeMediaForPolicy({
    id: 1,
    coverImage: { large: "https://example.test/cover.jpg" },
    bannerImage: "https://example.test/banner.jpg",
    characters: { edges: [{ node: { id: 2, image: { large: "https://example.test/c.jpg" } } }] },
  }, policy);
  assert.equal(media.coverImage.large, "");
  assert.equal(media.bannerImage, "");
  assert.equal(media.characters.edges[0].node.image.large, "");
});

test("remote artwork remains only in remote mode", () => {
  const policy = normalizeMediaPolicy({ provider: "anilist", artworkMode: "remote", rightsStatus: "approved" });
  const media = sanitizeMediaForPolicy({ id: 1, coverImage: { large: "https://example.test/cover.jpg" } }, policy);
  assert.equal(media.coverImage.large, "https://example.test/cover.jpg");
  assert.equal(media.__moemoa.rightsStatus, "approved");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:unit`

Expected: FAIL with missing `mediaRights.js`.

- [ ] **Step 3: 정책 정규화와 이미지 제거를 구현한다**

```js
// src/domain/mediaRights.js
export function normalizeMediaPolicy(input = {}) {
  return {
    provider: input.provider === "anilist" ? "anilist" : "manual",
    artworkMode: input.artworkMode === "remote" ? "remote" : "off",
    rightsStatus: ["approved", "api-only", "denied"].includes(input.rightsStatus)
      ? input.rightsStatus
      : "unverified",
  };
}

function blankImage(image) {
  if (!image || typeof image !== "object") return image;
  return Object.fromEntries(Object.keys(image).map((key) => [key, key === "color" ? image[key] : ""]));
}

export function sanitizeMediaForPolicy(media, inputPolicy = {}) {
  if (!media || typeof media !== "object") return media;
  const policy = normalizeMediaPolicy(inputPolicy);
  const allow = policy.artworkMode === "remote" && policy.rightsStatus === "approved";
  const next = structuredClone(media);
  next.__moemoa = {
    provider: policy.provider,
    providerMediaId: Number(media.id),
    rightsStatus: policy.rightsStatus,
    fetchedAt: new Date().toISOString(),
  };
  if (allow) return next;
  next.coverImage = blankImage(next.coverImage) || {};
  next.bannerImage = "";
  for (const edge of next.characters?.edges || []) {
    if (edge?.node) edge.node.image = blankImage(edge.node.image) || {};
  }
  return next;
}
```

- [ ] **Step 4: 환경 설정의 단일 진입점을 만든다**

```js
// src/config/mediaPolicy.js
import { normalizeMediaPolicy } from "../domain/mediaRights.js";

const env = import.meta.env || {};
export const MEDIA_POLICY = normalizeMediaPolicy({
  provider: env.PUBLIC_MEDIA_PROVIDER || "anilist",
  artworkMode: env.PUBLIC_MEDIA_ARTWORK_MODE || "off",
  rightsStatus: env.PUBLIC_MEDIA_RIGHTS_STATUS || "unverified",
});
```

`.env.example`에는 다음 값을 정확히 기록한다.

```dotenv
PUBLIC_RELEASE_CHANNEL=private
PUBLIC_MEDIA_PROVIDER=anilist
PUBLIC_MEDIA_ARTWORK_MODE=off
PUBLIC_MEDIA_RIGHTS_STATUS=unverified
ANILIST_AUTHORIZATION_REF=
PUBLIC_LEGAL_CONTACT_EMAIL=contact@example.invalid
PUBLIC_DISABLE_VERCEL_ANALYTICS=1
```

- [ ] **Step 5: 공개 배포 검사 스크립트를 만든다**

```js
// scripts/validate-release.mjs
const channel = process.env.PUBLIC_RELEASE_CHANNEL || "private";
const provider = process.env.PUBLIC_MEDIA_PROVIDER || "anilist";
const artwork = process.env.PUBLIC_MEDIA_ARTWORK_MODE || "off";
const rights = process.env.PUBLIC_MEDIA_RIGHTS_STATUS || "unverified";
const authorization = String(process.env.ANILIST_AUTHORIZATION_REF || "").trim();
const contact = String(process.env.PUBLIC_LEGAL_CONTACT_EMAIL || "").trim();
const deployed = channel === "closed-beta" || channel === "public";
const errors = [];

if (deployed && provider === "anilist" && !authorization) errors.push("AniList authorization reference is required.");
if (deployed && artwork === "remote" && rights !== "approved") errors.push("Remote artwork requires approved media rights.");
if (deployed && (!contact || contact.endsWith(".invalid"))) errors.push("A real legal contact email is required.");

if (errors.length) {
  for (const error of errors) process.stderr.write(`${error}\n`);
  process.exit(1);
}
process.stdout.write(`Release policy valid for ${channel}.\n`);
```

- [ ] **Step 6: package scripts를 연결한다**

```json
{
  "validate:release": "node scripts/validate-release.mjs",
  "build:release": "npm run validate:release && npm run build"
}
```

- [ ] **Step 7: 안전 기본값과 차단 동작을 검증한다**

Run: `npm run test:unit`

Expected: media-rights tests PASS.

Run: `$env:PUBLIC_RELEASE_CHANNEL='public'; $env:PUBLIC_MEDIA_PROVIDER='anilist'; Remove-Item Env:ANILIST_AUTHORIZATION_REF -ErrorAction SilentlyContinue; npm run validate:release`

Expected: FAIL with `AniList authorization reference is required.`

Run: `$env:PUBLIC_RELEASE_CHANNEL='private'; npm run validate:release`

Expected: PASS.

- [ ] **Step 8: 정책 기반을 커밋한다**

```bash
git add .env.example src/config/mediaPolicy.js src/domain/mediaRights.js tests/unit/mediaRights.test.mjs tests/unit/run-tests.mjs scripts/validate-release.mjs package.json
git commit -m "feat: gate public media usage behind rights policy"
```

---

### Task 2: AniList 직접 사용을 공급자 서비스 뒤로 이동

**Files:**
- Create: `src/services/mediaCatalog.js`
- Create: `tests/unit/mediaCatalog.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `src/components/AddAnime.jsx:1-10`
- Modify: `src/components/Library.jsx:1-50`
- Modify: `src/components/TierBoard.jsx:1-10`
- Modify: `src/hooks/useShowcaseSource.js:1-8`
- Modify: `src/hooks/useGlobalQuickActionSource.js:1-8`
- Modify: `src/domain/search/quickActionRemote.js:1-10`

**Interfaces:**
- Consumes: 기존 `src/lib/anilist.js` 함수와 `MEDIA_POLICY`.
- Produces: `searchMediaByTitle`, `fetchMediaByIds`, `fetchMediaCardsByIds`, `fetchMediaByIdsCached`, `getCachedMediaMap`.

- [ ] **Step 1: wrapper가 반환값을 sanitize하는 실패 테스트를 작성한다**

`mediaCatalog`은 테스트에서 transport를 주입할 수 있게 factory를 제공한다.

```js
// tests/unit/mediaCatalog.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createMediaCatalog } from "../../src/services/mediaCatalog.js";

test("catalog strips artwork according to policy", async () => {
  const catalog = createMediaCatalog({
    policy: { provider: "anilist", artworkMode: "off", rightsStatus: "unverified" },
    transport: { searchAnimeByTitle: async () => [{ id: 1, coverImage: { large: "https://example.test/a.jpg" } }] },
  });
  const rows = await catalog.searchMediaByTitle("test", 5);
  assert.equal(rows[0].coverImage.large, "");
});
```

- [ ] **Step 2: 실패를 확인한 뒤 factory와 기본 인스턴스를 구현한다**

```js
// src/services/mediaCatalog.js
import * as anilist from "../lib/anilist.js";
import { MEDIA_POLICY } from "../config/mediaPolicy.js";
import { sanitizeMediaForPolicy } from "../domain/mediaRights.js";

const sanitizeRows = (rows, policy) => (Array.isArray(rows) ? rows.map((row) => sanitizeMediaForPolicy(row, policy)) : []);
const sanitizeMap = (map, policy) => new Map([...map.entries()].map(([id, media]) => [id, sanitizeMediaForPolicy(media, policy)]));

export function createMediaCatalog({ policy, transport }) {
  return {
    async searchMediaByTitle(search, perPage = 10) {
      return sanitizeRows(await transport.searchAnimeByTitle(search, perPage), policy);
    },
    async fetchMediaByIds(ids) {
      return sanitizeMap(await transport.fetchAnimeByIds(ids), policy);
    },
    async fetchMediaCardsByIds(ids) {
      return sanitizeMap(await transport.fetchAnimeCardsByIds(ids), policy);
    },
    async fetchMediaByIdsCached(ids, options = {}) {
      return sanitizeMap(await transport.fetchAnimeByIdsCached(ids, options), policy);
    },
    getCachedMediaMap(ids) {
      return sanitizeMap(transport.getCachedAnimeMap(ids), policy);
    },
  };
}

const catalog = createMediaCatalog({ policy: MEDIA_POLICY, transport: anilist });
export const searchMediaByTitle = catalog.searchMediaByTitle;
export const fetchMediaByIds = catalog.fetchMediaByIds;
export const fetchMediaCardsByIds = catalog.fetchMediaCardsByIds;
export const fetchMediaByIdsCached = catalog.fetchMediaByIdsCached;
export const getCachedMediaMap = catalog.getCachedMediaMap;
```

- [ ] **Step 3: 직접 import를 wrapper import로 교체한다**

각 호출부에서 이름을 다음처럼 치환한다.

```js
import { searchMediaByTitle, fetchMediaByIdsCached } from "../services/mediaCatalog.js";
```

`quickActionRemote.js`는 상대 경로 `../../services/mediaCatalog.js`를 사용한다. 함수 호출 이름도 새 interface와 일치시킨다.

- [ ] **Step 4: AniList 직접 import가 서비스 밖에 없는지 확인한다**

Run: `rg -n "from .*lib/anilist" src`

Expected: only `src/services/mediaCatalog.js` matches.

- [ ] **Step 5: 단위 테스트와 빌드를 실행한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: 공급자 경계를 커밋한다**

```bash
git add src/services/mediaCatalog.js tests/unit/mediaCatalog.test.mjs tests/unit/run-tests.mjs src/components/AddAnime.jsx src/components/Library.jsx src/components/TierBoard.jsx src/hooks/useShowcaseSource.js src/hooks/useGlobalQuickActionSource.js src/domain/search/quickActionRemote.js
git commit -m "refactor: isolate AniList behind the media catalog"
```

---

### Task 3: 전역 이미지 kill switch와 완성된 placeholder 구현

**Files:**
- Create: `src/components/ui/MediaArtwork.jsx`
- Create: `tests/unit/mediaArtwork.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `src/domain/mediaRights.js`
- Modify: `src/components/AddAnime.jsx`
- Modify: `src/components/Home.jsx`
- Modify: `src/components/home/ResurfacingCards.jsx`
- Modify: `src/components/library/LibraryDetailModal.jsx`
- Modify: `src/components/Library.jsx`
- Modify: `src/components/TierBoard.jsx`
- Modify: `src/components/library/LibraryQuickLogSheet.jsx`
- Modify: `src/domain/showcase/showcaseSelectors.js`
- Modify: `src/styles/global.css`
- Modify: `tests/page-design-system.spec.ts`

**Interfaces:**
- Consumes: media title, optional image URL, artwork policy.
- Produces: `resolveArtwork({ url, title, artworkMode, rightsStatus })` and `MediaArtwork`.

- [ ] **Step 1: 이미지 차단과 fallback monogram 테스트를 작성한다**

```js
// tests/unit/mediaArtwork.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { resolveArtwork } from "../../src/domain/mediaRights.js";

test("unapproved artwork resolves to a stable fallback", () => {
  assert.deepEqual(resolveArtwork({
    url: "https://example.test/a.jpg",
    title: "Frieren",
    artworkMode: "remote",
    rightsStatus: "unverified",
  }), { src: "", monogram: "F", hasImage: false });
});
```

- [ ] **Step 2: resolver와 React 컴포넌트를 구현한다**

```jsx
// src/components/ui/MediaArtwork.jsx
import { MEDIA_POLICY } from "../../config/mediaPolicy.js";
import { resolveArtwork } from "../../domain/mediaRights.js";

export default function MediaArtwork({ src = "", title = "", className = "", loading = "lazy" }) {
  const artwork = resolveArtwork({ ...MEDIA_POLICY, url: src, title });
  if (artwork.hasImage) return <img src={artwork.src} alt={title} loading={loading} className={className} />;
  return <div role="img" aria-label={title} className={`${className} media-artwork-fallback`}><span>{artwork.monogram}</span></div>;
}
```

`resolveArtwork`는 이미지 허용 조건을 `artworkMode === "remote" && rightsStatus === "approved"`로 고정하고, title의 첫 영숫자 대문자를 monogram으로 사용한다.

- [ ] **Step 3: 직접 poster·banner·character `<img>`를 교체한다**

`rg -n "coverImage|bannerImage|imageSnapshot|<img" src/components src/domain/showcase` 결과를 하나씩 처리한다. 카드·상세·홈·티어·캐릭터 초안에서 모두 `MediaArtwork` 또는 `resolveArtwork`를 거치게 한다. CSS background image를 사용하는 홈 hero도 `resolveArtwork(...).src`가 비어 있으면 gradient-only로 렌더링한다.

- [ ] **Step 4: placeholder가 포스터 비율을 유지하도록 스타일을 추가한다**

```css
.media-artwork-fallback {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(145deg, var(--color-surface-raised), var(--color-surface));
  color: var(--color-text-muted);
}
.media-artwork-fallback > span {
  font-size: clamp(1rem, 8cqi, 2.25rem);
  font-weight: 700;
}
```

- [ ] **Step 5: off 모드 시 외부 이미지 요청이 없는 E2E를 추가한다**

```ts
test("artwork-off mode renders placeholders without external image requests", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image" && /^https?:/.test(request.url())) imageRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator(".media-artwork-fallback").first()).toBeVisible();
  expect(imageRequests).toEqual([]);
});
```

테스트에는 명시적 library fixture를 넣어 placeholder가 실제로 렌더링되게 한다.

- [ ] **Step 6: 테스트와 이미지 참조 감사를 실행한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `npm run test:e2e -- --project=chromium tests/page-design-system.spec.ts tests/layout-mobile.spec.ts tests/layout-desktop.spec.ts`

Expected: PASS with zero external image requests in artwork-off test.

- [ ] **Step 7: 이미지 kill switch를 커밋한다**

```bash
git add src/components/ui/MediaArtwork.jsx src/domain/mediaRights.js src/components src/domain/showcase/showcaseSelectors.js src/styles/global.css tests/unit/mediaArtwork.test.mjs tests/unit/run-tests.mjs tests/page-design-system.spec.ts
git commit -m "feat: add a global media artwork kill switch"
```

---

### Task 4: 공급자·권리 provenance와 backup version 6 추가

**Files:**
- Create: `tests/unit/snapshotProvider.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `src/domain/animeState.js:81-95`
- Modify: `src/domain/snapshotCodec.js:1-660`
- Modify: `src/domain/cloudSyncTables.js:1-75`
- Modify: `src/components/Library.jsx`
- Modify: `src/domain/search/quickActionActions.js`
- Modify: `docs/deploy/supabase-split-sync.sql`
- Modify: `README.md`

**Interfaces:**
- Consumes: legacy item `{ anilistId }` and new item `{ provider, providerMediaId, rightsStatus }`.
- Produces: normalized item with `provider`, `providerMediaId`, `rightsStatus`; version 6 backup with version 5 import compatibility.

- [ ] **Step 1: legacy와 version 6 왕복 테스트를 작성한다**

```js
// tests/unit/snapshotProvider.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { encodeSyncSnapshot, normalizeSyncSnapshot } from "../../src/domain/snapshotCodec.js";

test("legacy list items receive AniList provenance", () => {
  const decoded = normalizeSyncSnapshot({ version: 5, list: [{ anilistId: 1 }] });
  assert.equal(decoded.list[0].provider, "anilist");
  assert.equal(decoded.list[0].providerMediaId, "1");
  assert.equal(decoded.list[0].rightsStatus, "unverified");
});

test("version 6 compact snapshots preserve provider fields", () => {
  const encoded = encodeSyncSnapshot({ version: 6, list: [{ anilistId: 1, provider: "anilist", providerMediaId: "1", rightsStatus: "approved" }] });
  const decoded = normalizeSyncSnapshot(encoded);
  assert.equal(decoded.version, 6);
  assert.equal(decoded.list[0].rightsStatus, "approved");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:unit`

Expected: FAIL because provider fields are dropped and snapshot version is 5.

- [ ] **Step 3: library item 정규화를 확장한다**

`normalizeItem()`이 다음 필드를 항상 반환하게 한다.

```js
provider: it?.provider === "manual" ? "manual" : "anilist",
providerMediaId: String(it?.providerMediaId ?? anilistId),
rightsStatus: ["approved", "api-only", "denied"].includes(it?.rightsStatus)
  ? it.rightsStatus
  : "unverified",
```

새 작품 추가 경로인 `Library.jsx`와 `quickActionActions.js`도 동일한 필드를 기록한다.

- [ ] **Step 4: compact list에 provenance 필드를 추가한다**

`SYNC_SNAPSHOT_VERSION`을 6으로 올리고 list 배열 index를 다음처럼 확장한다.

```text
0 anilistId
1 koTitle
2 status
3 score
4 memo
5 rewatchCount
6 lastRewatchAt
7 provider
8 providerMediaId
9 rightsStatus
```

문자열 pool에 provider, providerMediaId, rightsStatus를 포함한다. version 5 compact payload는 별도의 `isCompactSnapshotV5`와 `decodeCompactSnapshotV5`로 기존 index 0~6을 읽고 기본 provenance를 붙인다.

- [ ] **Step 5: cloud sync schema와 mapper에 provenance를 추가한다**

Cloud row mapper와 Supabase schema도 동일 필드를 보존하도록 확장한다.

```sql
alter table public.user_library_items
  add column if not exists provider text not null default 'anilist',
  add column if not exists provider_media_id text,
  add column if not exists rights_status text not null default 'unverified';
```

`buildLibraryCloudRows()`는 `provider`, `provider_media_id`, `rights_status`를 쓰고 `libraryCloudRowsToItems()`는 이를 다시 camelCase field로 읽는다. `snapshotProvider.test.mjs`에 cloud row 왕복 assertion을 추가한다.

- [ ] **Step 6: 모든 백업·cloud mapping 테스트를 실행한다**

Run: `npm run test:unit`

Expected: legacy import and version 6 round-trip tests PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: README의 wire-format 예제를 version 6으로 갱신한다**

README에 provider field와 version 5 호환성을 기록한다. 작품 ID를 일반화하는 전체 리팩터링은 이 계획에서 하지 않으며 `anilistId`는 기존 관계 키로 유지한다고 명시한다.

- [ ] **Step 8: provenance를 커밋한다**

```bash
git add src/domain/animeState.js src/domain/snapshotCodec.js src/domain/cloudSyncTables.js src/components/Library.jsx src/domain/search/quickActionActions.js docs/deploy/supabase-split-sync.sql tests/unit/snapshotProvider.test.mjs tests/unit/run-tests.mjs README.md
git commit -m "feat: preserve media provider provenance in backups"
```

---

### Task 5: 법적 고지·attribution·삭제 요청 경로 추가

**Files:**
- Create: `src/pages/privacy.astro`
- Create: `src/pages/terms.astro`
- Create: `src/pages/copyright.astro`
- Create: `src/components/SiteFooter.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/layout-desktop.spec.ts`
- Modify: `tests/layout-mobile.spec.ts`

**Interfaces:**
- Consumes: `PUBLIC_LEGAL_CONTACT_EMAIL`, `MEDIA_POLICY`.
- Produces: `/privacy/`, `/terms/`, `/copyright/`와 모든 앱 페이지의 footer 링크.

- [ ] **Step 1: 법적 페이지 route 테스트를 작성한다**

```ts
for (const route of ["/privacy/", "/terms/", "/copyright/"]) {
  test(`${route} is reachable from the footer`, async ({ page }) => {
    await page.goto("/");
    await page.locator(`a[href='${route}']`).click();
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("main")).toContainText("contact@example.invalid");
  });
}
```

E2E local 환경은 `.env.example`의 명시적 invalid 주소를 사용하고, 공개 배포는 Task 1 validator가 실제 주소를 강제한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:e2e -- --project=chromium tests/layout-desktop.spec.ts`

Expected: FAIL because the footer and routes do not exist.

- [ ] **Step 3: footer와 세 페이지를 구현한다**

각 Astro 파일은 `const contactEmail = import.meta.env.PUBLIC_LEGAL_CONTACT_EMAIL || "contact@example.invalid";`를 사용한다. local test는 invalid 도메인임을 명확히 보여주고, 공개 배포에서는 Task 1 validator가 실제 주소를 강제한다.

각 페이지에는 다음 사실을 영어로 명시한다.

- MOEMOA stores anime journals locally first and can optionally sync after sign-in.
- External metadata and artwork may come from the provider named in the footer.
- MOEMOA does not claim ownership of third-party artwork.
- Rights holders can request removal through `PUBLIC_LEGAL_CONTACT_EMAIL`.
- The copyright page requests the work URL, proof of authority, affected material, and preferred action.
- Privacy page lists stored library/log/profile/sync data and analytics events without notes or titles.
- Terms prohibit uploading unlawful content and explain account/data deletion.

AniList attribution text는 서면 회신이 요구한 정확한 문구가 있을 때만 `PUBLIC_MEDIA_ATTRIBUTION_TEXT`와 `PUBLIC_MEDIA_ATTRIBUTION_URL` 환경값으로 표시한다.

- [ ] **Step 4: 모바일·데스크톱 footer 레이아웃을 추가한다**

footer는 광고처럼 보이지 않으며 본문보다 작은 텍스트로 `Privacy`, `Terms`, `Copyright`, 선택적 provider attribution을 표시한다. 앱 기록 CTA와 시각적으로 분리한다.

- [ ] **Step 5: route와 overflow 테스트를 실행한다**

Run: `npm run test:e2e -- --project=chromium tests/layout-desktop.spec.ts tests/layout-mobile.spec.ts`

Expected: all legal routes load and have no horizontal overflow.

- [ ] **Step 6: 법적 고지 경로를 커밋한다**

```bash
git add src/pages/privacy.astro src/pages/terms.astro src/pages/copyright.astro src/components/SiteFooter.astro src/layouts/BaseLayout.astro src/styles/global.css tests/layout-desktop.spec.ts tests/layout-mobile.spec.ts
git commit -m "feat: add media attribution and rights request pages"
```

---

### Task 6: 실제 계정·로컬·클라우드 데이터 삭제 구현

**Files:**
- Create: `supabase/functions/delete-account/index.ts`
- Create: `src/domain/accountDeletion.js`
- Create: `src/repositories/accountRepo.js`
- Create: `src/components/data/DangerZone.jsx`
- Create: `tests/unit/accountDeletion.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `src/storage/idb.js`
- Modify: `src/components/DataCenter.jsx`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Modify: `tests/authenticated-minihome.spec.ts`
- Modify: `docs/launch/GO_LIVE_CHECKLIST.md`

**Interfaces:**
- Consumes: 현재 Supabase access token과 사용자의 대문자 `DELETE` 확인 입력.
- Produces: `deleteAccountAndData()`, `clearLocalAccountData(storage, indexedDB)`, `/functions/v1/delete-account`.

- [ ] **Step 1: 삭제 대상 로컬 키의 실패 테스트를 작성한다**

```js
// tests/unit/accountDeletion.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { listLocalDeletionKeys } from "../../src/domain/accountDeletion.js";

test("account deletion includes journals, sync metadata, profile, and UI state", () => {
  const keys = new Set(listLocalDeletionKeys());
  for (const key of [
    "anime:list:v1",
    "anime:watchLogs:v1",
    "anime:characterPins:v1",
    "anime:tier:v1",
    "sync.deviceId",
    "sync.lastSyncedHash",
    "ui:locale:v1",
  ]) assert.equal(keys.has(key), true, key);
});
```

- [ ] **Step 2: 모든 MOEMOA 로컬 키를 한 곳에서 정의한다**

```js
// src/domain/accountDeletion.js
import { STORAGE_KEYS } from "../storage/keys.js";
import { UI_PREFERENCE_KEYS } from "./uiPreferences.js";
import { deleteAppDatabase } from "../storage/idb.js";

export function listLocalDeletionKeys() {
  return [...new Set([
    ...Object.values(STORAGE_KEYS),
    ...Object.values(UI_PREFERENCE_KEYS),
    "anime:mediaCache:v1",
    "moemoa:acquisition:v1",
  ])];
}

export async function clearLocalAccountData(
  persistentStorage = localStorage,
  sessionStorageRef = sessionStorage,
  deleteDatabase = deleteAppDatabase,
) {
  persistentStorage.clear();
  sessionStorageRef.clear();
  await deleteDatabase();
}
```

`src/storage/idb.js`에는 현재 `dbOpenPromise`가 resolve한 DB를 `close()`하고 promise를 null로 되돌린 뒤 `indexedDB.deleteDatabase("anime-collector-db")`의 success/error/blocked를 각각 처리하는 `deleteAppDatabase()`를 export한다. `blocked`는 성공으로 삼지 않고 `IndexedDB deletion was blocked.` 오류로 reject한다.

- [ ] **Step 3: 인증된 Supabase Edge Function을 구현한다**

`delete-account/index.ts`는 `OPTIONS` CORS 요청을 처리하고 `POST`만 허용한다. 요청 Authorization header의 access token을 service-role client의 `auth.getUser(token)`으로 검증한다. 검증된 `user.id`에 대해 다음 데이터를 순서대로 삭제한다.

```text
user_follows where follower_user_id or followed_user_id matches
user_showcase_layouts
user_showcase_public
user_profiles
user_library_items
user_watch_logs
user_character_pins
user_preferences
user_snapshots
auth.users row via auth.admin.deleteUser(user.id)
```

각 delete 결과의 `error`를 검사하고 하나라도 실패하면 auth user 삭제 전에 HTTP 500으로 종료한다. 응답 body에는 삭제된 user ID나 이메일을 넣지 않고 `{ "deleted": true }`만 반환한다. Service role key는 브라우저 bundle과 저장소에 절대 기록하지 않는다.

- [ ] **Step 4: client repository와 Danger Zone을 구현한다**

```js
// src/repositories/accountRepo.js
import { supabase } from "../lib/supabaseClient.js";
import { clearLocalAccountData } from "../domain/accountDeletion.js";

export async function deleteAccountAndData() {
  if (!supabase) throw new Error("Cloud account deletion is unavailable.");
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
  await clearLocalAccountData();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}
```

`DangerZone.jsx`는 로그인 사용자에게만 보이며 입력값이 정확히 `DELETE`일 때만 버튼을 활성화한다. 클릭 후 최종 `window.confirm`을 한 번 더 받고, 성공하면 `/`로 이동한다. 서버 삭제 실패 시 로컬 데이터를 먼저 지우지 않는다.

- [ ] **Step 5: Data Center와 양 언어 카피에 연결한다**

Data Center 하단에 `Delete account and all data` 섹션을 추가한다. 영어·한국어 모두 복구 불가, 클라우드와 이 기기의 기록 삭제, 다른 기기의 로컬 사본은 각 기기에서 별도 삭제해야 함을 명시한다.

- [ ] **Step 6: Edge Function 호출 E2E를 mock해 순서를 검증한다**

```ts
await page.route("**/functions/v1/delete-account", async (route) => {
  expect(route.request().method()).toBe("POST");
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true }) });
});
```

로그인 fixture에서 `DELETE` 입력 전 버튼 disabled, 성공 응답 후 localStorage 키 제거와 `/` 이동을 확인한다. 별도 테스트에서 HTTP 500을 반환하고 로컬 library가 그대로 남는지 확인한다.

- [ ] **Step 7: 테스트와 함수 배포 검증을 실행한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `npm run test:e2e -- --project=chromium tests/authenticated-minihome.spec.ts --workers=1`

Expected: success and server-failure account deletion paths PASS.

Run after selecting the production Supabase project: `supabase functions deploy delete-account`

Expected: deployment succeeds and Supabase dashboard shows JWT verification enabled.

- [ ] **Step 8: go-live checklist에 실계정 삭제 시험을 추가한다**

별도 테스트 계정을 생성해 작품·로그·프로필·showcase를 저장하고 삭제 후 모든 public tables와 Auth Users에서 해당 계정이 사라졌는지 확인한다. 이 검증이 끝나기 전 공개 가입을 열지 않는다.

- [ ] **Step 9: 계정 삭제를 커밋한다**

```bash
git add supabase/functions/delete-account/index.ts src/domain/accountDeletion.js src/repositories/accountRepo.js src/components/data/DangerZone.jsx tests/unit/accountDeletion.test.mjs tests/unit/run-tests.mjs src/storage/idb.js src/components/DataCenter.jsx src/messages/en.js src/messages/ko.js tests/authenticated-minihome.spec.ts docs/launch/GO_LIVE_CHECKLIST.md
git commit -m "feat: delete user accounts and all stored records"
```

---

### Task 7: AniList 회신 운영 문서와 release gate 검증

**Files:**
- Create: `docs/launch/ANILIST_RIGHTS_RUNBOOK.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: AniList 이메일 원문과 Task 1의 환경 변수.
- Produces: 답변별 배포 설정과 증빙 보관 규칙.

- [ ] **Step 1: 회신 기록 양식을 만든다**

문서에 다음 고정 필드를 사용한다.

```yaml
request_sent_at: pending
response_received_at: pending
api_tracking_service: pending
cover_art_display: pending
image_caching: pending
required_attribution: pending
commercial_threshold: pending
evidence_location: private-owner-storage
```

`pending`은 출시 허용을 의미하지 않으며 validator에 사용할 수 없다.

- [ ] **Step 2: 답변별 환경 설정을 명시한다**

```text
Full approval:
  PUBLIC_MEDIA_PROVIDER=anilist
  PUBLIC_MEDIA_ARTWORK_MODE=remote
  PUBLIC_MEDIA_RIGHTS_STATUS=approved
  ANILIST_AUTHORIZATION_REF=owner-vault:anilist-authorization

API only:
  PUBLIC_MEDIA_PROVIDER=anilist
  PUBLIC_MEDIA_ARTWORK_MODE=off
  PUBLIC_MEDIA_RIGHTS_STATUS=api-only
  ANILIST_AUTHORIZATION_REF=owner-vault:anilist-authorization

Denied or no response:
  PUBLIC_RELEASE_CHANNEL=private
  PUBLIC_MEDIA_ARTWORK_MODE=off
```

실제 증빙 식별자는 저장소에 커밋하지 않고 Vercel의 비공개 환경 변수에만 둔다.

- [ ] **Step 3: 전체 검증을 실행한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `npm run test:e2e -- --project=chromium --workers=1`

Expected: PASS in artwork-off mode.

Run: `npm run build:release`

Expected: private channel PASS; public/closed-beta without authorization FAIL.

- [ ] **Step 4: 직접 provider·이미지 우회 경로를 감사한다**

Run: `rg -n "from .*lib/anilist|coverImage|bannerImage|imageSnapshot|<img" src`

Expected: AniList import appears only in `mediaCatalog.js`; every third-party media image path is sanitized or rendered by `MediaArtwork`.

- [ ] **Step 5: 권리 안전 단계를 커밋한다**

```bash
git add docs/launch/ANILIST_RIGHTS_RUNBOOK.md README.md
git commit -m "docs: add AniList rights decision runbook"
```

## Completion Gate

이 계획은 다음 조건에서만 완료된다.

- public/closed-beta release가 승인 근거 없이 빌드되지 않는다.
- artwork-off 모드에서 제3자 이미지 네트워크 요청이 0개다.
- AniList 직접 import가 `mediaCatalog.js` 한 곳에만 있다.
- version 5 백업을 읽고 version 6 provider provenance를 왕복 보존한다.
- Privacy, Terms, Copyright, 삭제 요청 연락처가 모든 앱 페이지에서 접근 가능하다.
- 사용자가 로컬·클라우드 데이터와 인증 계정을 실제로 삭제할 수 있다.
- AniList 회신의 API·이미지·캐시·attribution 조건이 서로 구분되어 기록된다.
