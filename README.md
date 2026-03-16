# anime-collector

브라우저만으로 동작하는 개인 애니 기록 서비스입니다.  
핵심 흐름은 `검색 -> 보관 -> 감상 기록 -> 회고 -> 티어 정리 -> 백업 -> 기기간 동기화`입니다.

## 개요

- `offline-first` 개인 기록 앱
- 주요 화면: `홈 / 보관함 / 티어 / 데이터 / 프로필`
- 저장 구조: `IndexedDB 우선 + localStorage 미러 + 레거시 마이그레이션`
- 상단 공통 메뉴에서 `라이트/다크`, `한/영`, `도움말`, `데이터 관리`, `계정/동기화`, `내 프로필` 제공
- self-host 폰트 사용
  - 한국어: `Noto Sans KR`
  - 영어: `Noto Sans`
- PWA 설치와 JSON 백업/복원 지원
- Google 로그인 + 클라우드 snapshot sync 구조 포함

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

## 동기화 구조

현재 프로젝트는 `record-level sync`가 아니라 `snapshot sync`를 사용합니다.

- 로컬 데이터가 기본 원본
- 변경 시 `sync.pending` 메타가 올라감
- 로그인 후 현재 스냅샷 전체를 업로드/다운로드
- 마지막 동기화 이후 로컬과 클라우드가 모두 바뀌면 자동 덮어쓰기 대신 충돌 선택 UI 표시
- 검색/미디어 캐시는 sync 대상에서 제외

sync 관련 로컬 메타 키:

- `sync.deviceId`
- `sync.lastSyncedAt`
- `sync.lastSyncedHash`
- `sync.lastRemoteUpdatedAt`
- `sync.pending`
- `sync.lastError`
- `sync.lastLocalMutationAt`

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

- 템플릿 파일: `.env.example`
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
  library.spec.ts
  home-data.spec.ts
  tier.spec.ts
  live-search.spec.ts
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
npm run test:e2e
```

실시간 외부 검색 확인:

```bash
npm run test:e2e:live
```

주요 스펙:

- `tests/library.spec.ts`: 보관함 레이아웃, 필터, 상세 팝업, 로그, 데이터 메뉴
- `tests/home-data.spec.ts`: 홈 / 데이터 렌더와 공통 UI 안정성
- `tests/tier.spec.ts`: 티어보드 주제 전환, 드래그, 레이아웃
- `tests/live-search.spec.ts`: 외부 API 기반 실검색 확인

## 배포

지금 단계의 권장 흐름은 `Vercel + Supabase`로 먼저 사설 테스트를 돌리고,
기능이 안정되면 그 뒤에 custom domain까지 붙이는 방식입니다.
GitHub 저장소는 유지하고, 실제 서비스 호스팅만 GitHub Pages에서 옮기는 구조를 전제로 합니다.

현재 저장소에서 이미 준비된 것:

- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL` 환경변수 구조
- `/auth/callback/` 경로
- `docs/deploy/supabase-user-snapshots.sql`
- `docs/deploy/supabase-social.sql`
- `docs/deploy/OWNER_DEPLOY_GUIDE.md`

운영자가 직접 해야 하는 것:

- Supabase 프로젝트 생성
- Google OAuth 앱 생성
- Vercel 프로젝트 연결
- preview / production 환경변수 등록
- preview / production origin / redirect URL 등록
- custom domain 연결
- GitHub Pages workflow 비활성화 또는 삭제 여부 결정

## 참고 문서

- UI 수정 가이드: `docs/UI_EDIT_GUIDE.md`
- 운영 전환 가이드: `docs/deploy/OWNER_DEPLOY_GUIDE.md`
- Vercel 테스트 가이드: `docs/deploy/VERCEL_SETUP.md`
- Supabase SQL: `docs/deploy/supabase-user-snapshots.sql`
