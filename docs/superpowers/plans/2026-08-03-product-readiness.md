# MOEMOA Product Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 영어 사용자가 데모 데이터나 빈 로그 없이 첫 작품 3개와 첫 감상 기록을 남길 수 있는 안정적인 베타 제품을 만든다.

**Architecture:** 기존 Astro + React 구조와 offline-first 저장소를 유지한다. 초기 데이터·온보딩·퀵로그 저장 규칙은 순수 도메인 함수로 분리해 Node 테스트로 고정하고, 실제 사용자 흐름은 Playwright로 검증한다. 대규모 UI 재작성 없이 `Library.jsx`와 `Home.jsx`의 책임을 작은 컴포넌트와 도메인 함수로 분리한다.

**Tech Stack:** Astro 5, React 19, JavaScript ES modules, IndexedDB, localStorage, Node test runner, Playwright

## Global Constraints

- 영어를 신규 사용자의 기본 언어로 사용하고 한국어 전환 기능은 유지한다.
- 신규 사용자의 실제 라이브러리는 빈 배열로 시작한다.
- 퀵로그는 사용자가 `Save`를 누르기 전에는 영구 저장하지 않는다.
- 기본 기록, JSON 내보내기·복원, 계정·데이터 삭제 기능은 무료 범위로 유지한다.
- 이 계획에서는 광고, 결제, AniList 이미지 상업 이용을 활성화하지 않는다.
- 모바일 360×740 및 390×844, 데스크톱 1280×800 및 1440×900 회귀 테스트를 유지한다.
- 기능 단위 커밋 후 `git status --short`로 사용자 변경과 계획 변경만 포함됐는지 확인한다.

## File Structure

- `src/domain/onboardingState.js`: 작품·로그 개수에서 온보딩 단계를 계산하는 순수 함수.
- `src/domain/quickLogDraft.js`: 신규 로그 초안과 기존 로그 편집 초안을 구분하는 순수 함수.
- `src/domain/syncPresentation.js`: 설정·로그인·원격 확인 상태를 사용자 문구 상태로 변환.
- `src/components/home/HomeEmptyState.jsx`: 신규 사용자의 첫 작품 추가 CTA.
- `tests/unit/*.test.mjs`: 저장 규칙과 상태 계산을 검증하는 Node 테스트.
- `tests/helpers/appState.ts`: Playwright 컨텍스트에 빈 상태 또는 명시적 fixture를 주입.

---

### Task 1: 실행 가능한 테스트 기준선 복구

**Files:**
- Create: `tests/unit/run-tests.mjs`
- Create: `tests/helpers/appState.ts`
- Modify: `package.json:5-18`
- Modify: `tests/index.spec.ts:1-64`
- Modify: `tests/layout-desktop.spec.ts:1-137`
- Modify: `tests/layout-mobile.spec.ts:1-80`

**Interfaces:**
- Consumes: `anime:list:v1`, `anime:watchLogs:v1`, `ui:locale:v1` 저장 키.
- Produces: `installAppState(page, state)`와 `clearAppState(page)` E2E 헬퍼, 실행 가능한 `npm run test:unit`.

- [ ] **Step 1: 현재 실패 상태를 기록한다**

Run: `npm run test:unit`

Expected: FAIL because `tests/unit/run-tests.mjs` does not exist.

- [ ] **Step 2: Node 테스트 엔트리 파일을 만든다**

```js
// tests/unit/run-tests.mjs
import { readdir } from "node:fs/promises";

const files = (await readdir(new URL(".", import.meta.url)))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort();

for (const file of files) {
  await import(new URL(file, import.meta.url));
}
```

새 `*.test.mjs` 파일은 runner 수정 없이 자동으로 포함된다.

- [ ] **Step 3: E2E 상태 주입 헬퍼를 만든다**

```ts
// tests/helpers/appState.ts
import type { Page } from "@playwright/test";

type AppState = {
  locale?: "en" | "ko";
  list?: unknown[];
  watchLogs?: unknown[];
  mediaById?: Record<string, unknown>;
};

export async function installAppState(page: Page, state: AppState = {}) {
  await page.addInitScript((seed) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify(seed.locale ?? "en"));
    localStorage.setItem("anime:list:v1", JSON.stringify(seed.list ?? []));
    localStorage.setItem("anime:watchLogs:v1", JSON.stringify(seed.watchLogs ?? []));
    const mediaCache = Object.fromEntries(
      Object.entries(seed.mediaById ?? {}).map(([id, media]) => [id, { ts: Date.now(), media }]),
    );
    localStorage.setItem("anime:mediaCache:v1", JSON.stringify(mediaCache));
  }, state);
}

export async function clearAppState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("anime-collector-db");
  });
}
```

DB 이름은 `src/storage/idb.js`의 현재 `DB_NAME = "anime-collector-db"`와 일치시킨다.

- [ ] **Step 4: package script의 존재하지 않는 프로젝트 이름을 수정한다**

```json
{
  "test:unit": "node tests/unit/run-tests.mjs",
  "test:e2e:live": "playwright test tests/library-userflow.spec.ts --project=chromium --workers=1 --output=test-results-live"
}
```

기존 `desktop-chromium` 참조를 `playwright.config.ts`에 실제로 존재하는 `chromium`으로 바꾼다.

- [ ] **Step 5: 상태 의존 테스트가 fixture를 명시하도록 수정한다**

`tests/layout-desktop.spec.ts`와 `tests/layout-mobile.spec.ts`에서 첫 카드와 상세 모달이 필요한 테스트에 다음 fixture를 주입한다.

```ts
await installAppState(page, {
  locale: "en",
  list: [{ anilistId: 1, status: "완료", score: 9, memo: "fixture", addedAt: 1 }],
  watchLogs: [],
});
```

신규 사용자 테스트는 `clearAppState(page)`만 호출한다. 테스트가 제품 기본 seed에 의존하지 않게 한다.

- [ ] **Step 6: 홈 테스트가 암묵적 seed 대신 명시적 fixture를 사용하게 한다**

`tests/index.spec.ts`의 기존 한국어 제목·seed 통계·최근 기록 버튼 테스트를 모두 제거하고, 현재 UI의 기본 렌더링만 다음 명시적 fixture 테스트 하나로 검증한다.

```ts
test("seeded returning visitor sees the home shell", async ({ page }) => {
  await installAppState(page, {
    locale: "ko",
    list: [{ anilistId: 1, status: "완료", score: 9, memo: "fixture", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/");
  await expect(page.locator(".home-page")).toBeVisible();
  await expect(page.locator(".top-nav__links--routes")).toBeVisible();
});
```

- [ ] **Step 7: 기준선 테스트를 실행한다**

Run: `npm run build`

Expected: PASS.

Run: `npm run test:e2e -- --project=chromium tests/layout-desktop.spec.ts tests/layout-mobile.spec.ts`

Expected: fixture 기반 홈·레이아웃 테스트 PASS.

- [ ] **Step 8: 테스트 기준선을 커밋한다**

```bash
git add package.json tests/index.spec.ts tests/layout-desktop.spec.ts tests/layout-mobile.spec.ts tests/helpers/appState.ts tests/unit/run-tests.mjs
git commit -m "test: establish explicit beta app fixtures"
```

---

### Task 2: 데모 데이터 제거와 단계형 빈 상태 구현

**Files:**
- Create: `src/domain/onboardingState.js`
- Create: `src/components/home/HomeEmptyState.jsx`
- Create: `tests/unit/onboardingState.test.mjs`
- Delete: `src/data/myAnime.json`
- Modify: `src/components/Library.jsx:1-365`
- Modify: `src/hooks/useShowcaseSource.js:1-55`
- Modify: `src/components/Home.jsx:153-409`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Modify: `tests/index.spec.ts`

**Interfaces:**
- Consumes: `items: Array`, `logs: Array`.
- Produces: `deriveOnboardingState({ itemCount, logCount })` returning `{ stage, primaryAction }`, and `HomeEmptyState({ locale, stage, onAddTitle, libraryHref })`.

- [ ] **Step 1: 온보딩 단계의 실패 테스트를 작성한다**

```js
// tests/unit/onboardingState.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingState } from "../../src/domain/onboardingState.js";

test("zero titles asks for the first title", () => {
  assert.deepEqual(deriveOnboardingState({ itemCount: 0, logCount: 0 }), {
    stage: "add-first-title",
    primaryAction: "add-title",
  });
});

test("one or two titles asks for the first memory", () => {
  assert.equal(deriveOnboardingState({ itemCount: 2, logCount: 0 }).stage, "write-first-log");
});

test("three titles and one log unlocks the normal home", () => {
  assert.equal(deriveOnboardingState({ itemCount: 3, logCount: 1 }).stage, "active");
});
```

`tests/index.spec.ts`에는 신규 사용자 계약을 함께 추가한다.

```ts
test("new visitor sees one primary add-title action", async ({ page }) => {
  await clearAppState(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add your first title" })).toHaveCount(1);
  await expect(page.locator(".library-card")).toHaveCount(0);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm run test:unit`

Expected: unit test FAIL with missing `src/domain/onboardingState.js`; E2E contract FAIL because the dedicated empty state does not exist.

- [ ] **Step 3: 최소 단계 계산 함수를 구현한다**

```js
// src/domain/onboardingState.js
export function deriveOnboardingState({ itemCount = 0, logCount = 0 } = {}) {
  const items = Math.max(0, Number(itemCount) || 0);
  const logs = Math.max(0, Number(logCount) || 0);
  if (items === 0) return { stage: "add-first-title", primaryAction: "add-title" };
  if (logs === 0) return { stage: "write-first-log", primaryAction: "write-log" };
  if (items < 3) return { stage: "add-three-titles", primaryAction: "add-title" };
  return { stage: "active", primaryAction: "open-library" };
}
```

- [ ] **Step 4: seed fallback을 빈 배열로 바꾼다**

`Library.jsx`와 `useShowcaseSource.js`에서 `myListSeed` import를 삭제하고 모든 초기 fallback을 `[]`로 바꾼다.

```js
const preferred = await readLibraryListPreferred([]).catch(() => []);
```

`src/data/myAnime.json`은 어떤 런타임 경로에서도 참조되지 않는 것을 `rg -n "myAnime" src tests`로 확인한 뒤 삭제한다.

- [ ] **Step 5: 신규 사용자 전용 빈 상태 컴포넌트를 만든다**

```jsx
// src/components/home/HomeEmptyState.jsx
export default function HomeEmptyState({ copy, stage, onAddTitle, libraryHref }) {
  const first = stage === "add-first-title";
  return (
    <section className="surface-card home-empty-state" aria-labelledby="home-empty-title">
      <p className="sectionLead">{copy.eyebrow}</p>
      <h1 id="home-empty-title" className="pageTitle">{first ? copy.firstTitle : copy.firstLog}</h1>
      <p className="pageLead">{first ? copy.firstTitleLead : copy.firstLogLead}</p>
      {first ? (
        <button type="button" className="btn" onClick={onAddTitle}>{copy.addFirstTitle}</button>
      ) : (
        <a className="btn" href={libraryHref}>{copy.writeFirstLog}</a>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Home에서 빈 상태와 정상 상태를 분기한다**

`Home.jsx`에서 `deriveOnboardingState`를 계산하고 `stage !== "active"`인 경우 상단에 `HomeEmptyState`를 렌더링한다. 작품 0개일 때 `HomeShowcasePreview`, 통계, 연간 회고를 숨기고 하나의 기본 CTA만 보여준다. 작품은 있지만 로그가 없을 때는 첫 작품 상세의 quick-log 딥링크로 연결한다.

- [ ] **Step 7: 영문·한국어 빈 상태 문구를 추가한다**

```js
// messages group: homeOnboarding
{
  eyebrow: "Your private anime journal",
  firstTitle: "Start with one anime you remember",
  firstTitleLead: "Add a title now. You can write as much or as little as you want later.",
  addFirstTitle: "Add your first title",
  firstLog: "Add the memory you want to keep",
  firstLogLead: "A date and one short line are enough.",
  writeFirstLog: "Write your first memory"
}
```

한국어 그룹은 동일한 키를 사용한다.

- [ ] **Step 8: 단위·E2E 테스트를 실행한다**

Run: `npm run test:unit`

Expected: 현재 존재하는 onboarding tests PASS.

Run: `npm run test:e2e -- --project=chromium tests/index.spec.ts`

Expected: PASS with a single visible `Add your first title` primary action.

- [ ] **Step 9: 빈 상태를 커밋한다**

```bash
git add src/domain/onboardingState.js src/components/home/HomeEmptyState.jsx src/components/Library.jsx src/hooks/useShowcaseSource.js src/components/Home.jsx src/messages/en.js src/messages/ko.js tests/unit/onboardingState.test.mjs tests/index.spec.ts
git rm src/data/myAnime.json
git commit -m "feat: start new users with an intentional empty library"
```

---

### Task 3: 퀵로그를 저장 버튼 기준의 원자적 작업으로 변경

**Files:**
- Create: `src/domain/quickLogDraft.js`
- Create: `tests/unit/quickLogDraft.test.mjs`
- Modify: `src/components/Library.jsx:1186-1634`
- Modify: `src/components/library/LibraryQuickLogSheet.jsx:1-330`
- Modify: `tests/library-userflow.spec.ts`

**Interfaces:**
- Consumes: 신규 초안 입력 또는 저장된 watch log.
- Produces: `createNewQuickLogDraft(input)`, `createEditQuickLogDraft(log)`, `isNewQuickLogDraft(draft)`.

- [ ] **Step 1: 신규·편집 초안 구분 테스트를 작성한다**

```js
// tests/unit/quickLogDraft.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  createNewQuickLogDraft,
  createEditQuickLogDraft,
  isNewQuickLogDraft,
} from "../../src/domain/quickLogDraft.js";

test("new draft has no persisted log id", () => {
  const draft = createNewQuickLogDraft({ anilistId: 1, eventType: "시작", watchedAtValue: "2026-08-03" });
  assert.equal(draft.mode, "create");
  assert.equal(draft.logId, null);
  assert.equal(isNewQuickLogDraft(draft), true);
});

test("edit draft preserves the stored id", () => {
  const draft = createEditQuickLogDraft({ id: "log-1", anilistId: 1, eventType: "완료" });
  assert.equal(draft.mode, "edit");
  assert.equal(draft.logId, "log-1");
});
```

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test:unit`

Expected: FAIL with missing `quickLogDraft.js`.

- [ ] **Step 3: 초안 생성 함수를 구현한다**

```js
// src/domain/quickLogDraft.js
function baseDraft(log, mode) {
  return {
    mode,
    logId: mode === "edit" ? String(log?.id || "") : null,
    anilistId: Number(log?.anilistId),
    eventType: String(log?.eventType || "시작"),
    watchedAtPrecision: String(log?.watchedAtPrecision || "day"),
    watchedAtValue: String(log?.watchedAtValue || ""),
    cue: String(log?.cue || "").slice(0, 120),
    note: String(log?.note || ""),
  };
}

export const createNewQuickLogDraft = (input) => baseDraft(input, "create");
export const createEditQuickLogDraft = (log) => baseDraft(log, "edit");
export const isNewQuickLogDraft = (draft) => draft?.mode === "create" && !draft?.logId;
```

- [ ] **Step 4: 수동 퀵로그 열기에서 선행 append를 제거한다**

`createQuickLogFromDetail()`은 `appendSelectedWatchLog()`를 호출하지 않고 `createWatchLog(...)` 결과를 `createNewQuickLogDraft()`로 변환해 시트만 연다. `closeQuickLogSheet()`은 초안 상태만 버리고 repository를 호출하지 않는다.

- [ ] **Step 5: 저장 함수에서 create와 edit를 분기한다**

```js
const payload = {
  anilistId: Number(quickLogDraft.anilistId),
  eventType: quickLogDraft.eventType,
  watchedAtPrecision: watchedInput.precision,
  watchedAtValue: watchedInput.value,
  watchedAtStart: watchedMeta.watchedAtStart,
  watchedAtEnd: watchedMeta.watchedAtEnd,
  watchedAtSort: watchedMeta.watchedAtSort,
  cue: String(quickLogDraft.cue || "").slice(0, 120),
  note: String(quickLogDraft.note || ""),
  characterIds: selectedRefs.map((row) => row.characterId),
  characterRefs: selectedRefs,
};

const saved = isNewQuickLogDraft(quickLogDraft)
  ? await appendWatchLog(createWatchLog(payload))
  : await updateWatchLog(quickLogDraft.logId, payload);
```

기존 로그 행의 편집 버튼은 `createEditQuickLogDraft(log)`를 사용한다. 상태 변경으로 자동 생성되는 비어 있지 않은 상태 이벤트는 기존 동작을 유지한다.

- [ ] **Step 6: E2E에서 취소와 저장을 각각 검증한다**

```ts
test("opening and cancelling quick log does not persist a row", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "완료", score: 9, memo: "fixture", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/library/?animeId=1&focus=quick-log");
  await expect(page.locator(".log-sheet")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(0);
});
```

두 번째 테스트는 `Save` 후 로그가 정확히 1개이고, 다시 편집 저장 후에도 개수가 1개인지 검증한다.

- [ ] **Step 7: 단위·사용자 흐름 테스트를 실행한다**

Run: `npm run test:unit`

Expected: 현재 존재하는 onboarding and quick-log tests PASS.

Run: `npm run test:e2e -- --project=chromium tests/library-userflow.spec.ts --workers=1`

Expected: cancel creates 0 rows; save creates 1 row; edit keeps 1 row.

- [ ] **Step 8: 퀵로그 원자성을 커밋한다**

```bash
git add src/domain/quickLogDraft.js src/components/Library.jsx src/components/library/LibraryQuickLogSheet.jsx tests/unit/quickLogDraft.test.mjs tests/library-userflow.spec.ts
git commit -m "fix: persist quick logs only after explicit save"
```

---

### Task 4: 영어 기본값과 핵심 정보 구조 정리

**Files:**
- Modify: `src/domain/uiPreferences.js:1-65`
- Modify: `src/layouts/BaseLayout.astro:42-62`
- Modify: `public/manifest.webmanifest`
- Modify: `src/components/TopNavDataMenu.jsx:75-310`
- Modify: `src/components/Home.jsx:300-409`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Modify: `tests/index.spec.ts`
- Modify: `tests/page-design-system.spec.ts`

**Interfaces:**
- Consumes: 기존 `useUiPreferences()`.
- Produces: 기본 locale `en`, 기본 내비게이션 `Home / Library / Tier`, 후순위 `Minihome` 관리 링크.

- [ ] **Step 1: 영어 기본값 실패 테스트를 추가한다**

```ts
test("fresh browser uses English shell and primary navigation", async ({ page }) => {
  await clearAppState(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const primary = page.locator(".top-nav__links--routes");
  await expect(primary.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Library" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Tier" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Minihome" })).toHaveCount(0);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:e2e -- --project=chromium tests/index.spec.ts`

Expected: FAIL because the default locale is Korean and Minihome occupies the third primary slot.

- [ ] **Step 3: 문서·PWA 기본 언어를 영어로 바꾼다**

```js
export const DEFAULT_UI_PREFERENCES = {
  theme: UI_THEME.dark,
  locale: UI_LOCALE.en,
};
```

`BaseLayout.astro`의 초기 `<html lang="en">`, title, Apple app title을 영어 MOEMOA 카피로 바꾸고 `manifest.webmanifest`의 `name`, `short_name`, `description`, `lang`을 영어로 맞춘다.

- [ ] **Step 4: Tier를 핵심 내비게이션으로 승격한다**

데스크톱과 모바일 기본 링크 순서를 `Home`, `Library`, `Tier`로 만든다. Minihome은 관리 메뉴 안의 `Profile & Minihome` 섹션으로 이동한다. `Tier Maker (Lab)`과 `Labs` 문구를 삭제하고 `Tier` 또는 `Tier Board`로 통일한다.

- [ ] **Step 5: 홈 섹션 우선순위를 기록 중심으로 바꾼다**

활성 사용자의 홈 순서를 다음으로 고정한다.

```text
오늘의 기록 CTA
최근 기록 / 기록 없는 작품 / 이맘때 기록
연간 회고
취향 통계
Minihome 미리보기
```

신규 사용자는 Task 2의 단계형 온보딩만 먼저 본다.

- [ ] **Step 6: 영어 카피의 용어를 통일한다**

`record`, `memory`, `library`, `tier`, `sync`, `backup`을 기준 용어로 사용한다. `Minihome`은 고유 기능명으로만 남긴다. 자동 번역투인 `keep things going`, `pick up your records`는 각각 `store your records locally`, `continue on another device`처럼 직접적인 문장으로 바꾼다.

- [ ] **Step 7: E2E와 빌드를 실행한다**

Run: `npm run test:e2e -- --project=chromium tests/index.spec.ts tests/page-design-system.spec.ts tests/layout-desktop.spec.ts tests/layout-mobile.spec.ts`

Expected: PASS across primary navigation and four viewport sizes.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: 정보 구조 변경을 커밋한다**

```bash
git add src/domain/uiPreferences.js src/layouts/BaseLayout.astro public/manifest.webmanifest src/components/TopNavDataMenu.jsx src/components/Home.jsx src/messages/en.js src/messages/ko.js tests/index.spec.ts tests/page-design-system.spec.ts
git commit -m "feat: make English journaling flow the primary experience"
```

---

### Task 5: 동기화 상태를 실제 확인 상태와 일치시키기

**Files:**
- Create: `src/domain/syncPresentation.js`
- Create: `tests/unit/syncPresentation.test.mjs`
- Modify: `src/components/data/SyncStatusCard.jsx:1-94`
- Modify: `src/components/TopNavDataMenu.jsx:24-150`
- Modify: `src/messages/en.js:276-317`
- Modify: `src/messages/ko.js:276-317`
- Modify: `tests/index.spec.ts`

**Interfaces:**
- Consumes: `{ configured, connected, loading, remoteChecked, remoteMissing, status }`.
- Produces: `deriveSyncPresentation(input)` returning `{ tone, accountState, remoteState, showSyncActions }`.

- [ ] **Step 1: 표시 상태 테스트를 작성한다**

```js
// tests/unit/syncPresentation.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { deriveSyncPresentation } from "../../src/domain/syncPresentation.js";

test("unconfigured cloud never claims remote data exists", () => {
  assert.deepEqual(deriveSyncPresentation({ configured: false }), {
    tone: "disabled",
    accountState: "local-only",
    remoteState: "unavailable",
    showSyncActions: false,
  });
});

test("signed-out configured cloud is not checked", () => {
  assert.equal(deriveSyncPresentation({ configured: true, connected: false }).remoteState, "not-checked");
});

test("checked empty remote is reported as empty", () => {
  assert.equal(deriveSyncPresentation({ configured: true, connected: true, remoteChecked: true, remoteMissing: true }).remoteState, "empty");
});
```

- [ ] **Step 2: 실패를 확인하고 최소 함수를 구현한다**

Run: `npm run test:unit`

Expected: FAIL with missing `syncPresentation.js`.

```js
// src/domain/syncPresentation.js
export function deriveSyncPresentation(input = {}) {
  if (!input.configured) return { tone: "disabled", accountState: "local-only", remoteState: "unavailable", showSyncActions: false };
  if (!input.connected) return { tone: "idle", accountState: "signed-out", remoteState: "not-checked", showSyncActions: false };
  if (input.loading || !input.remoteChecked) return { tone: "idle", accountState: "connected", remoteState: "checking", showSyncActions: false };
  return {
    tone: input.status || "connected",
    accountState: "connected",
    remoteState: input.remoteMissing ? "empty" : "available",
    showSyncActions: true,
  };
}
```

- [ ] **Step 3: hook에서 원격 확인 완료 값을 노출한다**

`useSyncStatus` 반환값에 `remoteChecked: !loading && Boolean(session?.user) && isSupabaseConfigured`를 추가한다. 로그아웃 또는 미설정 상태에서는 false다.

- [ ] **Step 4: SyncStatusCard와 상단 상태 점을 표시 모델에 연결한다**

`SyncStatusCard`는 `copy.remoteReady`를 기본값으로 사용하지 않는다. `remoteState`별로 `Unavailable`, `Not checked`, `Checking`, `No cloud backup yet`, `Cloud backup found`를 표시한다. 설정이 없을 때 상단 점은 성공 색상이 아니라 disabled 색상을 사용한다.

- [ ] **Step 5: 전체 Node 테스트를 실행한다**

Run: `npm run test:unit`

Expected: onboarding, quick-log draft, sync presentation tests all PASS.

- [ ] **Step 6: 설정 없는 브라우저 흐름을 검증한다**

Run: `npm run test:e2e -- --project=chromium tests/index.spec.ts tests/layout-desktop.spec.ts`

Expected: settings menu shows local-only/unavailable and never shows `Cloud backup found`.

- [ ] **Step 7: 동기화 표시 변경을 커밋한다**

```bash
git add src/domain/syncPresentation.js src/hooks/useSyncStatus.js src/components/data/SyncStatusCard.jsx src/components/TopNavDataMenu.jsx src/messages/en.js src/messages/ko.js tests/unit/syncPresentation.test.mjs tests/index.spec.ts
git commit -m "fix: present cloud sync state without false readiness"
```

---

### Task 6: 제품 준비 회귀 검증과 문서 갱신

**Files:**
- Modify: `README.md`
- Modify: `docs/UI_EDIT_GUIDE.md`
- Modify: `tests/library-userflow.spec.ts`

**Interfaces:**
- Consumes: Task 1~5의 완성된 제품 흐름.
- Produces: 재현 가능한 개발·검증 명령과 영어 우선 UX 규칙.

- [ ] **Step 1: README의 손상된 인코딩과 오래된 테스트 목록을 정리한다**

README를 UTF-8 한국어로 다시 저장하고 다음을 정확히 문서화한다.

```text
npm run test:unit
npm run test:e2e -- --project=chromium
npm run build
```

신규 사용자는 빈 라이브러리로 시작하며, 영어가 기본이고 한국어 전환이 가능하다는 점을 포함한다.

- [ ] **Step 2: UI 가이드에 온보딩·기록 규칙을 추가한다**

`docs/UI_EDIT_GUIDE.md`에 다음 불변 조건을 추가한다.

- 빈 상태의 primary CTA는 한 개다.
- 퀵로그 닫기는 데이터 변경을 만들지 않는다.
- Tier는 핵심 탐색 항목이다.
- cloud 상태는 실제 설정·확인 결과보다 앞서 표현하지 않는다.

- [ ] **Step 3: 전체 제품 흐름을 실행한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `npm run test:e2e -- --project=chromium --workers=1`

Expected: PASS. 외부 AniList 응답에 의존하는 live 검색 테스트가 있다면 네트워크 실패와 제품 회귀를 구분해 결과에 기록한다.

Run: `npm run build`

Expected: PASS with no Astro errors.

- [ ] **Step 4: 변경 파일과 seed 제거를 확인한다**

Run: `rg -n "myAnime|Tier Maker \(Lab\)|Cloud backup found" src tests README.md`

Expected: `myAnime` and lab wording have no matches; `Cloud backup found` appears only in the explicit available-state copy or tests.

- [ ] **Step 5: 제품 준비 단계를 커밋한다**

```bash
git add README.md docs/UI_EDIT_GUIDE.md tests/library-userflow.spec.ts
git commit -m "docs: document beta product readiness contract"
```

## Completion Gate

이 계획은 다음 조건에서만 완료된다.

- 빈 브라우저에서 작품 카드와 감상 로그가 0개다.
- 첫 작품 추가 CTA가 하나만 보인다.
- 퀵로그 열기·닫기 후 로그 개수가 변하지 않는다.
- 저장 후 정확히 한 로그가 생기고 편집 후에도 개수가 늘지 않는다.
- 영어 기본 셸과 `Home / Library / Tier` 탐색이 네 viewport에서 동작한다.
- Supabase 미설정 상태에서 클라우드 데이터가 있다는 문구가 표시되지 않는다.
- `npm run test:unit`, Chromium E2E, `npm run build`가 모두 통과한다.
