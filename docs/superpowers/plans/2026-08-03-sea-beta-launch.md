# MOEMOA Southeast Asia Beta Launch Implementation Plan

> **문서 상태: `SUPERSEDED` — 현재 계획으로 집행 금지**
> 4주·600,000원, 필리핀/싱가포르, 작품·감상 로그 activation을 전제로 한 legacy 출시안이다. 현재 예산·국가·광고 이벤트는 `GROWTH-01~03`과 `BETA-01`에서 미정이며 [`open-decision-questions.md`](../../moemoa/reports/open-decision-questions.md)를 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 필리핀을 주 시장, 싱가포르를 교차 검증 시장으로 삼아 4주·600,000원 한도에서 활성화와 재방문을 측정할 수 있는 영어 베타를 출시한다.

**Architecture:** Vercel Analytics custom events를 얇은 제품 분석 adapter 뒤에서 호출하고, 이벤트명과 속성을 allowlist로 제한해 애니 제목·사용자 메모·이메일을 전송하지 않는다. 광고 유입 정보는 영구 쿠키 대신 현재 탭의 `sessionStorage`에 제한적으로 보관한다. 배포는 rights validator, build, preview smoke, production smoke의 순서로 통과해야 하며 수익화 플래그는 베타 기간 내내 off로 강제한다.

**Tech Stack:** Astro 5, React 19, Vercel, Vercel Analytics, Supabase Auth/Sync, Playwright, Meta Ads Manager

## Global Constraints

- 1차 시장은 필리핀, 교차 검증 시장은 싱가포르다.
- 베트남·태국 현지화와 유료 광고는 필리핀·싱가포르 베타 판단 후에만 검토한다.
- 유료 사용자 획득 총액은 4주간 600,000원을 초과하지 않는다.
- 베타 내부에는 배너·전면·보상형 광고와 결제를 넣지 않는다.
- 제품 이벤트에 사용자 이메일, 사용자 ID, 애니 제목, AniList ID, 감상 메모, 캐릭터 이름을 보내지 않는다.
- 활성화 사용자는 첫 방문 또는 가입 후 24시간 안에 작품 3개와 감상 로그 1개를 저장한 사용자다.
- Meta 광고 소재에는 애니 포스터·캐릭터·공식 키아트를 사용하지 않는다.
- AniList/API/이미지 release gate가 통과하지 않으면 공개 유료 광고를 시작하지 않는다.
- 수치 임계값은 첫 100명 활성화 코호트 후 한 번 조정할 수 있으며, 변경 사유와 적용 시각을 운영 로그에 남긴다.

## File Structure

- `src/services/productAnalytics.js`: event allowlist, 속성 sanitize, Vercel `track()` 호출.
- `src/services/acquisitionAttribution.js`: UTM 값을 sessionStorage에 보관하고 이벤트 속성으로 제공.
- `src/domain/activationMilestones.js`: 작품·로그 수에서 첫 작품·세 번째 작품·첫 로그 milestone을 계산.
- `scripts/smoke-release.mjs`: 배포 URL의 핵심 route와 보안 상태를 확인.
- `docs/launch/SEA_BETA_RUNBOOK.md`: 4주 광고·리텐션 운영 절차.
- `docs/launch/SEA_BETA_SCORECARD.md`: 일별/주별 지표 입력 형식과 go/rework/stop 판단.

---

### Task 1: 개인정보 최소화 제품 분석 adapter 구현

**Files:**
- Create: `src/services/productAnalytics.js`
- Create: `tests/unit/productAnalytics.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `.env.example`
- Modify: `src/layouts/BaseLayout.astro:1-62`

**Interfaces:**
- Consumes: `PUBLIC_PRODUCT_ANALYTICS_ENABLED`, event name, flat primitive properties.
- Produces: `trackProductEvent(name, properties)`, `sanitizeProductEvent(name, properties)`.

- [ ] **Step 1: 이벤트 allowlist와 개인정보 제거 실패 테스트를 작성한다**

```js
// tests/unit/productAnalytics.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeProductEvent } from "../../src/services/productAnalytics.js";

test("approved event keeps only approved primitive properties", () => {
  assert.deepEqual(sanitizeProductEvent("first_log_saved", {
    locale: "en",
    surface: "quick-log",
    title: "must not leave",
    note: "must not leave",
    nested: { value: 1 },
  }), {
    name: "first_log_saved",
    properties: { locale: "en", surface: "quick-log" },
  });
});

test("unknown event is rejected", () => {
  assert.equal(sanitizeProductEvent("free_form_event", { locale: "en" }), null);
});
```

- [ ] **Step 2: 테스트 실패를 확인한다**

Run: `npm run test:unit`

Expected: FAIL with missing `productAnalytics.js`.

- [ ] **Step 3: 이벤트·속성 allowlist를 구현한다**

```js
// src/services/productAnalytics.js
import { track } from "@vercel/analytics";

const env = import.meta.env || {};

const EVENT_NAMES = new Set([
  "landing_view",
  "sign_in_started",
  "sign_in_completed",
  "first_title_added",
  "third_title_added",
  "first_log_saved",
  "recap_viewed",
  "tier_entry_added",
  "backup_exported",
  "sync_enabled",
]);

const PROPERTY_NAMES = new Set([
  "locale",
  "surface",
  "status",
  "item_count_bucket",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
]);

export function sanitizeProductEvent(name, input = {}) {
  if (!EVENT_NAMES.has(name)) return null;
  const properties = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!PROPERTY_NAMES.has(key)) continue;
    if (!["string", "number", "boolean"].includes(typeof value) && value !== null) continue;
    properties[key] = typeof value === "string" ? value.slice(0, 80) : value;
  }
  return { name, properties };
}

export function trackProductEvent(name, properties = {}) {
  const event = sanitizeProductEvent(name, properties);
  if (!event || env.PUBLIC_PRODUCT_ANALYTICS_ENABLED !== "1") return false;
  track(event.name, event.properties);
  return true;
}
```

- [ ] **Step 4: Analytics 컴포넌트와 custom event 플래그를 같은 조건으로 묶는다**

`BaseLayout.astro`의 analytics 조건을 다음처럼 바꾼다.

```js
const analyticsEnabled =
  isProd &&
  import.meta.env.PUBLIC_PRODUCT_ANALYTICS_ENABLED === "1" &&
  import.meta.env.PUBLIC_DISABLE_VERCEL_ANALYTICS !== "1";
```

`.env.example`에 `PUBLIC_PRODUCT_ANALYTICS_ENABLED=0`을 추가한다.

- [ ] **Step 5: 단위 테스트와 disabled build를 검증한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `$env:PUBLIC_PRODUCT_ANALYTICS_ENABLED='0'; npm run build`

Expected: PASS and no custom event call occurs in browser tests.

- [ ] **Step 6: 분석 adapter를 커밋한다**

```bash
git add src/services/productAnalytics.js tests/unit/productAnalytics.test.mjs tests/unit/run-tests.mjs .env.example src/layouts/BaseLayout.astro
git commit -m "feat: add privacy-minimized product analytics events"
```

---

### Task 2: 활성화 milestone을 제품 행동에 연결

**Files:**
- Create: `src/domain/activationMilestones.js`
- Create: `tests/unit/activationMilestones.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `src/components/Library.jsx`
- Modify: `src/domain/search/quickActionActions.js`
- Modify: `src/components/Home.jsx`
- Modify: `src/components/TierBoard.jsx`
- Modify: `src/components/data/ManualDataTools.jsx`
- Modify: `src/hooks/useSyncStatus.js`
- Modify: `src/components/auth/AuthCallbackClient.jsx`
- Modify: `tests/library-userflow.spec.ts`

**Interfaces:**
- Consumes: `{ previousItemCount, nextItemCount, previousLogCount, nextLogCount }`.
- Produces: `deriveActivationEvents(counts)` returning a subset of `first_title_added`, `third_title_added`, `first_log_saved`.

- [ ] **Step 1: milestone 경계 테스트를 작성한다**

```js
// tests/unit/activationMilestones.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { deriveActivationEvents } from "../../src/domain/activationMilestones.js";

test("crossing zero to one title emits first title", () => {
  assert.deepEqual(deriveActivationEvents({ previousItemCount: 0, nextItemCount: 1, previousLogCount: 0, nextLogCount: 0 }), ["first_title_added"]);
});

test("crossing two to three titles emits third title", () => {
  assert.deepEqual(deriveActivationEvents({ previousItemCount: 2, nextItemCount: 3, previousLogCount: 0, nextLogCount: 0 }), ["third_title_added"]);
});

test("editing one existing log emits nothing", () => {
  assert.deepEqual(deriveActivationEvents({ previousItemCount: 3, nextItemCount: 3, previousLogCount: 1, nextLogCount: 1 }), []);
});
```

- [ ] **Step 2: 실패 후 순수 milestone 함수를 구현한다**

```js
// src/domain/activationMilestones.js
export function deriveActivationEvents(input = {}) {
  const previousItems = Math.max(0, Number(input.previousItemCount) || 0);
  const nextItems = Math.max(0, Number(input.nextItemCount) || 0);
  const previousLogs = Math.max(0, Number(input.previousLogCount) || 0);
  const nextLogs = Math.max(0, Number(input.nextLogCount) || 0);
  const events = [];
  if (previousItems < 1 && nextItems >= 1) events.push("first_title_added");
  if (previousItems < 3 && nextItems >= 3) events.push("third_title_added");
  if (previousLogs < 1 && nextLogs >= 1) events.push("first_log_saved");
  return events;
}
```

- [ ] **Step 3: 작품 추가의 두 진입점을 계측한다**

`Library.jsx`의 검색 추가 성공과 `quickActionActions.js`의 전역 quick add 성공에서 이전·이후 item count를 넘겨 milestone을 계산한다. `trackProductEvent` 속성은 `locale`, `surface`, `status`, `item_count_bucket`만 사용한다. 작품 ID와 제목은 전달하지 않는다.

- [ ] **Step 4: 명시적 로그 저장을 계측한다**

Task 3 product-readiness에서 만든 `saveQuickLogDraft()`의 create 분기가 성공한 뒤 전체 로그 수의 0→1 전환만 `first_log_saved`로 전송한다. 자동 상태 이벤트와 import는 milestone에서 제외한다.

- [ ] **Step 5: 회고·티어·백업·동기화 이벤트를 연결한다**

- `Home.jsx`: 로그가 있는 연간 회고가 처음 viewport에 표시될 때 세션당 한 번 `recap_viewed`.
- `TierBoard.jsx`: 사용자가 작품을 처음 tier row에 배치한 성공 시 `tier_entry_added`.
- `ManualDataTools.jsx`: 파일 다운로드·모바일 공유·clipboard export 성공 시 `backup_exported`.
- `useSyncStatus.js`: 첫 성공 업로드 또는 다운로드 후 `sync_enabled`.
- `AuthCallbackClient.jsx`: 인증 session 설정 성공 후 `sign_in_completed`.

각 이벤트 중복 방지는 다음 형식으로 처리하고, first title/log milestone은 실제 count 경계가 중복을 막는다.

```js
sessionStorage.setItem(`moemoa:event:${name}:v1`, "1");
```

- [ ] **Step 6: E2E에서 사용자 콘텐츠가 분석 payload에 없는지 검증한다**

```ts
await page.addInitScript(() => {
  window.vaq = [];
});
// 작품 추가와 첫 로그 저장 후
const queue = await page.evaluate(() => window.vaq || []);
expect(JSON.stringify(queue)).not.toContain("Playwright UX flow log");
expect(JSON.stringify(queue)).not.toContain("Frieren");
```

- [ ] **Step 7: 테스트를 실행한다**

Run: `npm run test:unit`

Expected: PASS.

Run: `$env:PUBLIC_PRODUCT_ANALYTICS_ENABLED='1'; npm run test:e2e -- --project=chromium tests/library-userflow.spec.ts --workers=1`

Expected: activation events occur once and payload contains no title, ID, note, email, or character name.

- [ ] **Step 8: 행동 계측을 커밋한다**

```bash
git add src/domain/activationMilestones.js tests/unit/activationMilestones.test.mjs tests/unit/run-tests.mjs src/components/Library.jsx src/domain/search/quickActionActions.js src/components/Home.jsx src/components/TierBoard.jsx src/components/data/ManualDataTools.jsx src/hooks/useSyncStatus.js src/components/auth/AuthCallbackClient.jsx tests/library-userflow.spec.ts
git commit -m "feat: measure activation and retention product milestones"
```

---

### Task 3: 캠페인 유입을 session 단위로 연결

**Files:**
- Create: `src/services/acquisitionAttribution.js`
- Create: `tests/unit/acquisitionAttribution.test.mjs`
- Modify: `tests/unit/run-tests.mjs`
- Modify: `src/services/productAnalytics.js`
- Modify: `src/components/Home.jsx`
- Modify: `tests/index.spec.ts`

**Interfaces:**
- Consumes: URLSearchParams and a Storage-like object.
- Produces: `captureAcquisition(search, storage)`, `readAcquisition(storage)`, `withAcquisition(properties)`.

- [ ] **Step 1: UTM allowlist 테스트를 작성한다**

```js
// tests/unit/acquisitionAttribution.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseAcquisition } from "../../src/services/acquisitionAttribution.js";

test("only approved UTM values are retained", () => {
  assert.deepEqual(parseAcquisition("?utm_source=meta&utm_medium=paid_social&utm_campaign=ph_beta&utm_content=memory_a&email=x%40y.test"), {
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "ph_beta",
    utm_content: "memory_a",
  });
});
```

- [ ] **Step 2: parser와 sessionStorage adapter를 구현한다**

```js
// src/services/acquisitionAttribution.js
const KEY = "moemoa:acquisition:v1";
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

export function parseAcquisition(search = "") {
  const params = new URLSearchParams(search);
  return Object.fromEntries(KEYS.flatMap((key) => {
    const value = String(params.get(key) || "").trim().slice(0, 80);
    return value ? [[key, value]] : [];
  }));
}

export function captureAcquisition(search, storage = sessionStorage) {
  const parsed = parseAcquisition(search);
  if (Object.keys(parsed).length) storage.setItem(KEY, JSON.stringify(parsed));
  return parsed;
}

export function readAcquisition(storage = sessionStorage) {
  try { return JSON.parse(storage.getItem(KEY) || "{}"); } catch { return {}; }
}
```

- [ ] **Step 3: Home 첫 mount에서 landing view를 기록한다**

```js
useEffect(() => {
  const acquisition = captureAcquisition(window.location.search, window.sessionStorage);
  trackProductEvent("landing_view", { locale, surface: "home", ...acquisition });
}, []);
```

`trackProductEvent`은 기존 properties에 `readAcquisition()`을 합치는 `withAcquisition` helper를 사용하되 allowlist를 다시 통과시킨다.

- [ ] **Step 4: URL과 저장소에서 민감 파라미터가 남지 않는지 E2E로 검증한다**

Run: `npm run test:e2e -- --project=chromium tests/index.spec.ts`

Expected: `email`, `name`, arbitrary query keys are absent from session attribution; approved UTM four 개만 남는다.

- [ ] **Step 5: 단위 테스트를 실행하고 커밋한다**

Run: `npm run test:unit`

Expected: PASS.

```bash
git add src/services/acquisitionAttribution.js tests/unit/acquisitionAttribution.test.mjs tests/unit/run-tests.mjs src/services/productAnalytics.js src/components/Home.jsx tests/index.spec.ts
git commit -m "feat: attribute beta activation without persistent campaign cookies"
```

---

### Task 4: release build·preview·production smoke gate 추가

**Files:**
- Create: `scripts/smoke-release.mjs`
- Create: `docs/launch/GO_LIVE_CHECKLIST.md`
- Modify: `scripts/validate-release.mjs`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `PUBLIC_SITE_URL`, release channel, monetization mode.
- Produces: `npm run smoke:release`, Vercel `build:release` gate.

- [ ] **Step 1: 베타 수익화 차단을 validator에 추가한다**

`.env.example`에 다음 값을 추가한다.

```dotenv
PUBLIC_MONETIZATION_MODE=off
```

`validate-release.mjs`는 `closed-beta` 채널에서 이 값이 `off`가 아니면 `Beta releases must keep monetization off.`로 실패한다.

- [ ] **Step 2: 핵심 route smoke script를 만든다**

```js
// scripts/smoke-release.mjs
const origin = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!/^https:\/\//.test(origin)) throw new Error("PUBLIC_SITE_URL must be an https URL.");
const routes = ["/", "/library/", "/tier/", "/data/", "/privacy/", "/terms/", "/copyright/"];

for (const route of routes) {
  const response = await fetch(`${origin}${route}`, { redirect: "error" });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) throw new Error(`${route} did not return HTML`);
}
process.stdout.write(`Smoke passed for ${origin}.\n`);
```

- [ ] **Step 3: package와 Vercel build 명령을 연결한다**

```json
{
  "smoke:release": "node scripts/smoke-release.mjs"
}
```

`vercel.json`의 `buildCommand`를 `npm run build:release`로 바꾼다. preview와 production 모두 rights validator를 통과해야 한다.

- [ ] **Step 4: go-live checklist를 구체화한다**

체크리스트는 다음 순서로 만든다.

```text
1. AniList authorization evidence configured
2. Artwork mode matches written permission
3. Real legal contact email configured
4. Privacy / Terms / Copyright reviewed
5. Supabase production redirect URLs verified
6. Empty-state, quick-log cancel/save, JSON export/import manually checked
7. Product analytics enabled only after privacy review
8. Monetization mode confirmed off
9. Chromium E2E and build:release passed
10. Production smoke passed on HTTPS domain
```

- [ ] **Step 5: local private build와 production URL smoke를 검증한다**

Run: `npm run build:release`

Expected: PASS for private defaults.

Run after preview deployment:

```powershell
$previewUrl = (& npx vercel deploy --yes | Select-Object -Last 1).Trim()
$env:PUBLIC_SITE_URL = $previewUrl
npm run smoke:release
```

Expected: PASS for every listed route. Preview URL은 현재 셸에서만 사용하고 저장소에는 커밋하지 않는다.

- [ ] **Step 6: release gate를 커밋한다**

```bash
git add scripts/smoke-release.mjs docs/launch/GO_LIVE_CHECKLIST.md scripts/validate-release.mjs .env.example package.json vercel.json
git commit -m "build: gate SEA beta releases with rights and smoke checks"
```

---

### Task 5: 유료 광고 전 closed beta 운영

**Files:**
- Create: `docs/launch/SEA_CLOSED_BETA_RUNBOOK.md`
- Create: `docs/launch/SEA_BETA_SCORECARD.md`

**Interfaces:**
- Consumes: production smoke 결과와 Vercel event counts.
- Produces: 50~100명 closed beta 결과와 paid test 진입 결정.

- [ ] **Step 1: 초대·관찰 범위를 문서화한다**

closed beta는 필리핀·싱가포르의 영어 사용자 50~100명을 목표로 하며 경품과 유료 크리에이터 협업을 사용하지 않는다. 개인 네트워크와 self-promotion을 허용하는 애니 커뮤니티에서 서비스 목적·데이터 출처·베타 상태를 명확히 밝힌다.

- [ ] **Step 2: 사용자에게 요청할 한 가지 흐름을 고정한다**

```text
Open MOEMOA → add 3 anime → save 1 memory → return on another day
```

피드백 질문은 다음 네 개로 제한한다.

1. What did you expect before adding the first title?
2. Where did you hesitate or stop?
3. Would you return after watching another anime?
4. Was any data or sync wording unclear?

- [ ] **Step 3: scorecard 입력 형식을 만든다**

```markdown
| cohort | visitors | first title | third title | first log | D1 | D7 | errors | notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
```

정성 메모에는 사용자의 이메일·애니 제목·감상 문장을 복사하지 않고 행동 장애만 요약한다.

- [ ] **Step 4: paid test 진입 조건을 기록한다**

- blocker 등급 데이터 손실·중복 로그·로그인 루프가 0건이다.
- 첫 작품 추가부터 첫 로그 저장까지 모바일에서 완주 가능하다.
- 최소 30명의 활성화 사용자가 존재한다.
- 활성화 사용자의 D7 재방문이 측정 가능하다.
- AniList와 이미지 권리 release gate가 통과한다.

- [ ] **Step 5: closed beta 문서를 커밋한다**

```bash
git add docs/launch/SEA_CLOSED_BETA_RUNBOOK.md docs/launch/SEA_BETA_SCORECARD.md
git commit -m "docs: define the SEA closed beta gate"
```

---

### Task 6: 4주·600,000원 Meta 광고 실험 운영

**Files:**
- Create: `docs/launch/SEA_BETA_RUNBOOK.md`
- Modify: `docs/launch/SEA_BETA_SCORECARD.md`

**Interfaces:**
- Consumes: approved production URL, UTM event data, closed beta baseline.
- Produces: 국가·소재별 activated CAC와 D7/D30 판단.

- [ ] **Step 1: 예산과 캠페인 한도를 고정한다**

```text
Philippines: KRW 15,000/day × 28 days = KRW 420,000
Singapore: KRW 10,000/day × 12 scheduled days = KRW 120,000
Reserve: KRW 60,000, locked until the end of day 14
Total hard cap: KRW 600,000
```

싱가포르는 월·수·토처럼 주 3일만 집행해 일일 학습 예산을 지나치게 쪼개지 않는다. Meta 계정의 campaign spending limit도 600,000원에 맞춘다.

- [ ] **Step 2: 캠페인 구조와 UTM을 고정한다**

국가당 campaign 1개, ad set 1개, creative 3개를 사용한다. 연령은 18~34세, 영어 UI, 자동 placements로 시작한다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign=ph_beta_2026q3 or sg_beta_2026q3
utm_content=memory_a or feeling_b or quiet_journal_c
```

- [ ] **Step 3: 자체 UI 기반 소재 세 개를 만든다**

```text
A: “Your anime memories, not just a score.”
B: “Remember why an anime mattered to you.”
C: “A quiet personal anime journal.”
```

각 소재는 MOEMOA 로고, 빈 라이브러리→기록→회고 UI, 타이포그래피만 사용한다. 애니 포스터·캐릭터·공식 로고는 사용하지 않는다.

- [ ] **Step 4: 일별 점검과 변경 제한을 기록한다**

매일 확인:

- 국가·소재별 지출
- landing view
- first title
- third title
- first log
- activated CAC
- 오류·로그인 실패

동일 ad set의 타깃·소재·랜딩을 같은 날 두 개 이상 바꾸지 않는다. 첫 7일에는 기술 오류나 정책 위반이 아니면 소재를 제거하지 않는다.

- [ ] **Step 5: 7일·14일·28일 판단 규칙을 적용한다**

```text
Day 7:
  At least 100 landing views and zero first-title events → inspect landing/product mismatch.
  Clicks without first logs → inspect onboarding and quick-log before changing targeting.

Day 14:
  Compare activated CAC and D7 by country and creative.
  Allocate the KRW 60,000 reserve only if one combination has both lower CAC and non-zero D7.

Day 28:
  Strong signal: activated CAC ≤ KRW 3,000 and D7 ≥ 20%.
  Mixed signal: only one threshold met; fix the failing side and retest without country expansion.
  Stop/rework: D7 < 10% after at least 100 activated users, or repeated data-loss/auth blockers.
```

이 수치는 초기 운영 기준이다. 첫 100명 후 변경하면 이전 기준, 새 기준, 변경 이유, 적용 날짜를 scorecard에 함께 남긴다.

- [ ] **Step 6: 광고 중지 후 잔존 행동을 확인한다**

28일 종료 후 7일간 신규 유료 광고를 0원으로 두고 direct visit, returning users, logs per active user를 측정한다. 광고 중단과 함께 기록 행동도 사라지면 확장하지 않는다.

- [ ] **Step 7: 광고 운영 문서를 커밋한다**

```bash
git add docs/launch/SEA_BETA_RUNBOOK.md docs/launch/SEA_BETA_SCORECARD.md
git commit -m "docs: define the four-week SEA acquisition experiment"
```

---

### Task 7: 국가 확장과 수익화 진입 gate 기록

**Files:**
- Create: `docs/launch/POST_BETA_DECISION.md`
- Modify: `.env.example`
- Modify: `scripts/validate-release.mjs`

**Interfaces:**
- Consumes: 4주 paid 결과, 7일 광고 중지 결과, 두 개 이상의 D30 cohort.
- Produces: Philippines focus / Singapore focus / product rework / localization exploration 중 하나의 기록된 결정.

- [ ] **Step 1: 국가 확장 판단을 문서화한다**

```text
Philippines focus:
  PH activated CAC and D7 both beat SG after sample-size caveat.

Singapore focus:
  SG costs more but D30 and logs per active user produce clearly stronger retained usage.

Product rework:
  Both markets fail D7 or first-log completion.

Vietnam/Thailand exploration:
  At least one English market meets the strong signal and the product has no P0 blockers.
```

- [ ] **Step 2: 베타 이후에도 광고 수익화를 기본 off로 유지한다**

`validate-release.mjs`는 `PUBLIC_MONETIZATION_MODE`가 `off`가 아닌 경우 다음 환경값을 모두 요구하도록 확장한다.

```text
PUBLIC_MEDIA_RIGHTS_STATUS=approved
PUBLIC_ADS_APPROVED=1
PUBLIC_ORIGINAL_CONTENT_PV_READY=1
PUBLIC_RETENTION_GATE_READY=1
```

각 값은 다음 사실을 운영자가 확인한 뒤에만 설정한다.

- 이미지·API 상업 이용 서면 승인
- 광고 네트워크 사이트 승인
- 월 100,000 이상 광고 표시 가능 페이지뷰
- 최소 두 코호트의 안정적인 D30 리텐션

- [ ] **Step 3: 첫 내부 광고 실험의 제한을 기록한다**

광고는 별도 구현 계획을 다시 승인받아 추가한다. 첫 실험 범위는 사용자 10%, 연간 회고·장문 통계·공개 큐레이션 하단으로 제한한다. 퀵로그, 저장 직후, 검색 포스터 사이, 상세 모달, 로그인, 백업, 충돌 해결 화면은 영구 금지 위치로 기록한다.

기록 완료율이 대조군보다 5% 이상 낮아지면 배치를 중단한다.

- [ ] **Step 4: Supporter 수요를 결제 없이 측정한다**

안정된 사용자가 생긴 뒤 `Ad-free`, `Extra themes`, `Advanced yearly recap`, `Share card styles` 네 항목의 관심도 설문만 진행한다. 결제·가격 페이지는 데이터와 권리 gate가 통과하기 전에 구현하지 않는다.

- [ ] **Step 5: release validator와 문서를 검증한다**

Run: `$env:PUBLIC_MONETIZATION_MODE='display-ads'; npm run validate:release`

Expected: FAIL unless all four monetization evidence flags are `1` and media rights are approved.

Run: `$env:PUBLIC_MONETIZATION_MODE='off'; npm run validate:release`

Expected: PASS when the normal release conditions are satisfied.

- [ ] **Step 6: 후속 의사결정 gate를 커밋한다**

```bash
git add docs/launch/POST_BETA_DECISION.md .env.example scripts/validate-release.mjs
git commit -m "docs: gate localization and monetization after beta evidence"
```

## Completion Gate

이 계획은 다음 조건에서만 완료된다.

- 제품 분석 이벤트에 사용자 콘텐츠나 직접 식별자가 없다.
- 작품 3개 + 로그 1개의 활성화 퍼널을 국가·소재별로 계산할 수 있다.
- paid campaign 총 지출이 600,000원 hard cap 안에 있다.
- 공개 URL이 rights validator, build, production smoke를 모두 통과한다.
- closed beta의 P0 오류가 0건이며 paid test 진입 근거가 기록되어 있다.
- 4주 paid test와 7일 paid-off 관찰 결과가 scorecard에 남아 있다.
- 베트남·태국 확장과 내부 광고 수익화는 각각 별도 gate를 통과하기 전까지 시작하지 않는다.
