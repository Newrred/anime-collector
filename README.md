# anime-collector

> **문서 상태: `CURRENT_RUNTIME`**
> 이 README는 현재 저장소에서 실행되는 legacy Astro/React 애니 기록 Web/PWA를 설명한다. 앞으로 구현할 MOEMOA의 제품 결정·Android·Memory Card·Archive·Board 기준은 [MOEMOA 문서 인덱스](docs/moemoa/README.md)와 [확정 결정](docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md)을 따른다. 현재 코드에 존재하는 Tier/Public Profile/Showcase를 새 Board/Public Memory Card의 승인된 구현으로 간주하지 않는다.

브라우저만으로 동작하는 개인 애니 기록 서비스입니다.  
핵심 흐름은 `검색 -> 보관 -> 감상 기록 -> 회고 -> 티어 정리 -> 백업 -> 기기간 동기화`입니다.

## 개요

- `offline-first` 개인 기록 앱
- 주요 화면: `홈 / 보관함 / 티어 / 데이터 / 프로필`
- 저장 구조: 데이터별 원본이 명시된 `IndexedDB + localStorage + 레거시 마이그레이션`
- 상단 공통 메뉴에서 `라이트/다크`, `한/영`, `도움말`, `데이터 관리`, `계정/동기화`, `내 프로필` 제공
- self-host 폰트 사용
  - 한국어: `Noto Sans KR`
  - 영어: `Noto Sans`
- PWA 설치와 JSON 백업/복원 지원
- Google 로그인 + 클라우드 snapshot sync 구조 포함

## 베타 제품 기본값

- 새 사용자는 샘플 작품이나 감상 로그 없이 빈 보관함에서 시작합니다. 빈 상태에는 다음 작품을 추가하기 위한 primary CTA를 하나만 둡니다.
- 최초 언어는 영어이며, 사용자가 선택해 저장한 언어 설정은 다음 방문에도 유지됩니다.
- 감상 로그는 작성 화면을 열거나 닫는 것만으로 저장되지 않습니다. `Save`를 눌러야 로컬 기록에 반영됩니다.
- 클라우드 상태는 실제 설정·연결·확인 결과만 표시합니다. Supabase가 설정되지 않은 환경에서는 로컬 전용 상태를 명확히 안내합니다.

## 주요 기능

### 홈 (`/`)

- 오늘 다시 열어볼 만한 애니 중심의 홈 구성
- 최근 감상 기록 / 아직 기록이 없는 작품 / 캐릭터 회상 카드
- 캐릭터 인사이트 시트
- 연도별 리캡 텍스트 복사 / 공유 / 이미지 저장
- 티어보드로 바로 이어지는 진입 카드

### 보관함 (`/library/`)

- AniList + Wikidata 기반 작품 검색
- 작품 추가 시 초기 상태 지정
- 상태, 별점, 메모, 재시청 횟수 관리
- 감상 로그 추가 / 수정 / 삭제
- 캐릭터 고정, 관련 작품 탐색, 빠른 기록 시트
- 고급 필터, 정렬, 장르 칩, 카드 밀도 조절
- `정보 함께 / 포스터만` 보기 전환
- 상세 팝업에서 탭별 콘텐츠 스크롤 분리

### 티어 (`/tier/`)

- 드래그 앤 드롭 기반 티어보드
- 저장된 주제 전환
- 장르 주제 / 커스텀 주제 생성 및 저장
- 모든 주제에서 공통 애니 풀 사용
- 미분류 영역 검색 + 장르 드롭다운 지원
- 백업 JSON에 `tierTopics`까지 함께 저장

### 데이터 (`/data/`)

- 저장 엔진 상태와 사용량 확인
- quota / persistence 상태 확인 및 요청
- 백업 이력 요약
- Google 계정 연결 상태
- 클라우드 sync 상태 카드
- 충돌 시 로컬 유지 / 클라우드 가져오기 / JSON 백업 경로 제공
- 수동 백업 및 복원 섹션에서 JSON export/import 제공

### 프로필 (`/profile/`, `/u/?handle=...`)

- 로그인 시 자동 생성되는 기본 공개 프로필
- 닉네임 / handle / 한줄 소개 / 공개 여부 편집
- 공개 프로필 링크 복사 / 공유
- 팔로우 / 언팔로우
- 팔로워 / 팔로잉 목록을 통해 다른 프로필 이동

감사 주의: 위 공개 프로필·showcase·follow는 legacy 구현 경로다. 신고·차단·moderation·unpublish/delete·kill switch가 완성되지 않았으므로 신규 MOEMOA Public 기능의 기반으로 바로 활성화하지 않는다. 상세 근거는 `docs/moemoa/reports/repository-audit.md`를 따른다.

## 동기화 구조

현재 프로젝트는 완전한 record-level sync가 아니라 **split record table과 snapshot fallback이 섞인 legacy sync**를 사용합니다. Library/WatchLog/CharacterPin/Preferences 일부는 split table, Tier/Topic은 snapshot 경로를 사용합니다.

- 로컬 데이터가 기본 원본
- 변경 시 `sync.pending` 메타가 올라감
- 로그인 후 현재 스냅샷 전체를 업로드/다운로드
- 마지막 동기화 이후 로컬과 클라우드가 모두 바뀌면 자동 덮어쓰기 대신 충돌 선택 UI 표시
- 검색/미디어 캐시는 sync 대상에서 제외

감사 주의: Library/Tier의 일반 UI 쓰기 일부는 `sync.pending`을 표시하지 않는 경로가 있어 수동 sync 전까지 자동 업로드가 누락될 수 있다. 계정별 sync metadata와 달리 실제 local product data key도 account namespace로 분리되어 있지 않다. 신규 account/sync 작업은 `docs/moemoa/reports/implementation-gap-analysis.md`에서 위험과 선택지를 확인하되, 실제 모델과 순서는 승인된 ADR/ExecPlan으로 확정한다.

sync 관련 로컬 메타 키:

- `sync.deviceId`
- `sync.lastSyncedAt`
- `sync.lastSyncedHash`
- `sync.lastRemoteUpdatedAt`
- `sync.pending`
- `sync.lastError`
- `sync.lastLocalMutationAt`
- `sync.localRevision` (기기 로컬 스냅샷 변경마다 증가하는 단조 카운터)
- `sync.accounts:v1` (계정별 마지막 동기화 hash·시각·오류)

감상 로그는 `localStorage`의 전체 스냅샷을 원본으로 사용하고 IndexedDB를 재구축 가능한 조회 미러로 사용합니다. 따라서 IndexedDB 미러 갱신이 실패해도 성공한 로컬 저장을 이전 IndexedDB 행이 가리지 않습니다. 홈, JSON 백업, 클라우드 스냅샷은 모두 전체 로그를 먼저 승격하는 preferred 조회를 사용합니다. IDB-only 승격을 기다리는 동안 새 로컬 로그가 생기면 ID 기준으로 합치고 로컬 충돌 값을 우선하며, IDB 읽기 실패 시 백업·동기화는 빈 로그를 만들지 않고 실패를 상위로 전달합니다.

보관함과 티어는 초기 IndexedDB 복구가 끝난 뒤에만 미러 쓰기를 시작합니다. 레거시 이전이 중단되어 IndexedDB에 일부 데이터만 남은 경우에는 기존 IndexedDB 값을 우선하면서 localStorage의 고유 항목을 합쳐 양쪽 저장소를 복구한 다음 완료 마커를 기록합니다. 이전용 IDB 읽기 하나라도 실패하면 쓰기와 마커 기록을 시작하지 않으며, 같은 SPA의 다음 호출에서 다시 시도합니다.

동기화 중에는 각 원격 변경 단계 직전에 현재 계정을 다시 확인하고, 업로드 시작 뒤 새 로컬 수정이 생기면 이전 업로드가 `sync.pending`을 해제하지 않습니다. 클라우드 가져오기는 보관함·티어·감상 로그·캐릭터 고정의 localStorage 저장과 IndexedDB 트랜잭션을 순서대로 모두 기다린 뒤에만 완료 메타를 기록합니다. 대기 중 계정이 바뀌거나 어느 저장 단계라도 실패하면 이후 저장과 완료 메타를 중단합니다.

## UI 시스템

- 공통 타이포 계층: `display / title / body / caption / label`
- 공통 색상 계층: `interactive / status / overlay / media`
- 공통 spacing / size 토큰 사용
- 아이콘 버튼, segmented toggle, 카드, 패널 스타일 통일
- 전체 locale 전환 시 UI 문구와 애니 제목 표시 우선순위가 함께 전환됨

자세한 규칙은 `docs/UI_EDIT_GUIDE.md`에서 확인할 수 있습니다.

## 기술 스택

- Astro 5
- React 19
- Supabase JS
- Playwright
- AniList GraphQL
- Wikidata / WDQS
- IndexedDB + localStorage

## 환경변수

로컬/preview/production에서 아래 값을 사용합니다.

```bash
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
PUBLIC_SITE_URL=https://app.example.com
```

- `.env.example`은 현재 checkout에 없다. 위 key 목록을 참고하되 실제 값이나 secret을 문서·Git에 기록하지 않는다.
- `PUBLIC_SITE_URL`은 Astro `site` 값에 사용됩니다.
- Google OAuth와 Supabase Redirect URLs는 실제 preview / production origin과 함께 별도로 등록해야 합니다.

## 데이터 구조

주요 저장 데이터는 다음과 같습니다.

- `list`: 보관 중인 작품의 현재 상태 스냅샷
- `watchLogs`: 감상 이벤트 로그
- `characterPins`: 고정한 캐릭터 정보
- `tier`: 레거시 단일 티어 상태
- `tierTopics`: 주제형 티어보드 번들
- `mediaCache`: AniList 응답 캐시

백업 JSON과 클라우드 snapshot은 현재 compact wire format인 `version: 5`를 사용합니다.
사용자가 직접 읽기 쉬운 형식보다는 전송 크기와 중복 제거를 우선하며, import 시에는 예전 `version: 4` 백업도 계속 읽을 수 있습니다.

```json
{
  "v": 5,
  "e": "2026-03-15T00:00:00.000Z",
  "s": [],
  "l": [],
  "tt": [null, []],
  "w": [],
  "p": [],
  "pr": []
}
```

호환성 메모:

- 예전 `tier` 단일 상태도 읽을 수 있습니다.
- 검색/미디어 캐시는 백업과 sync 대상이 아닙니다.

## 프로젝트 구조

```text
src/
  components/
    auth/
    data/
    home/
    library/
    ui/
  data/
  domain/
  hooks/
  layouts/
  lib/
  messages/
  pages/
    auth/
  repositories/
  services/
  storage/
  styles/
docs/
  deploy/
tests/
  unit/
    legacyMigrationMerge.test.mjs
    onboardingState.test.mjs
    quickLogDraft.test.mjs
    syncAccountMeta.test.mjs
    syncMutationSafety.test.mjs
    syncOperationCoordinator.test.mjs
    syncPresentation.test.mjs
    uiPreferences.test.mjs
    watchLogSource.test.mjs
  authenticated-minihome.spec.ts
  index.spec.ts
  layout-desktop.spec.ts
  layout-mobile.spec.ts
  library-userflow.spec.ts
  page-design-system.spec.ts
  storage-hydration.spec.ts
```

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소:

```text
http://127.0.0.1:4321
```

빌드 / 프리뷰:

```bash
npm run build
npm run preview
```

## 테스트

단위 테스트:

```bash
npm run test:unit
```

Playwright E2E:

```bash
npm run test:e2e -- --project=chromium --workers=1
```

2026-08-11 감사에서는 Chromium 단일 worker가 36 통과·live-only 2 스킵이었다. 기본 병렬 실행은 cold-start/timeout으로 6건 실패했으므로 병렬 안정성이 해결되기 전에는 단일 worker를 기준으로 사용한다.

제품 기본 회귀는 AniList와 Wikidata 응답을 고정 fixture로 제어하므로 네트워크 상태와 무관하게 완료됩니다. 실제 외부 검색 확인은 별도 live 게이트에서만 실행합니다.

```bash
npm run test:e2e:live
```

배포 전에는 다음 세 명령을 모두 실행합니다.

```bash
npm run test:unit
npm run test:e2e -- --project=chromium --workers=1
npm run build
```

주요 스펙:

- `tests/index.spec.ts`: 영어 기본 셸, 신규 사용자 온보딩, 동기화 표시 계약
- `tests/library-userflow.spec.ts`: 검색·6개 작품 추가·퀵로그·홈 회고의 fixture 및 live 흐름
- `tests/storage-hydration.spec.ts`: IndexedDB-only 보관함·티어·감상 로그 복구, 중단된 이전 병합·실패 재시도, 독립 Home 진입, 백업 전체 로그 승격
- `tests/layout-desktop.spec.ts`, `tests/layout-mobile.spec.ts`: 주요 경로 반응형 회귀
- `tests/page-design-system.spec.ts`: 공통 카드·간격·타이포 시스템 회귀
- `tests/authenticated-minihome.spec.ts`: 로그인 사용자 미니홈 흐름
- `tests/unit/*.test.mjs`: 온보딩, 퀵로그 초안, UI 설정, 중단 이전 병합, 실제 업로드·다운로드 동기화 내구성, 감상 로그 동시 승격·오류 전파

## 배포

> **상태: `DEPLOY-01` 미정**

현재 저장소에는 `vercel.json`과 `master` push 시 GitHub Pages 배포를 시도하는 `.github/workflows/astro.yml`이 함께 있다. 사용자는 Vercel이 `master`에 연결된 것으로 보고했지만, repository evidence만으로 실제 canonical production origin과 GitHub Pages 활성 상태를 확정할 수 없다.

따라서 Vercel 이전, custom domain, OAuth redirect, PWA scope, canonical URL, GitHub Pages workflow 변경을 현재 권장안이나 완료 작업으로 간주하지 않는다. 먼저 `DEPLOY-01`에서 canonical origin과 preview/production 구분을 확인·승인한다.

현재 저장소에서 이미 준비된 것:

- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL` 환경변수 구조
- `/auth/callback/` 경로
- `docs/deploy/supabase-user-snapshots.sql`
- `docs/deploy/supabase-social.sql`

현재 확인이 필요한 외부 상태와 후속 작업 후보:

- 실제 Supabase project/table/RLS/region/backup 상태
- Google OAuth app과 현재 허용 redirect URL
- Vercel project의 실제 production/preview 연결 상태
- GitHub Pages의 실제 활성·사용 상태
- 선택한 canonical host의 환경변수와 origin/redirect 등록
- custom domain 필요 여부
- GitHub Pages workflow 유지·비활성화 여부

마지막 네 항목은 `DEPLOY-01` 승인 뒤에만 변경한다.

## 참고 문서

- 현행 MOEMOA 문서 지도: `docs/moemoa/README.md`
- 확정 결정과 열린 gate: `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- 현재 저장소 감사: `docs/moemoa/reports/repository-audit.md`
- 구현 Gap과 권장 migration 단계(미승인 분석안): `docs/moemoa/reports/implementation-gap-analysis.md`
- 과거 제품 방향 초안: `docs/product/2026-08-06-product-direction-decision-draft.md` (`SUPERSEDED`)
- UI 수정 가이드: `docs/UI_EDIT_GUIDE.md`
- Supabase SQL: `docs/deploy/supabase-user-snapshots.sql`
- Supabase split sync SQL: `docs/deploy/supabase-split-sync.sql`
- Supabase social/showcase SQL: `docs/deploy/supabase-social.sql`, `docs/deploy/supabase-showcase.sql`
