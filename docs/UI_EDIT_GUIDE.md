# UI/CSS 편집 가이드 (실무용)

이 문서는 현재 프로젝트에서 디자인/레이아웃을 직접 수정할 때, 어디를 어떻게 바꿔야 하는지 빠르게 찾기 위한 가이드입니다.

## 1. 구조 한눈에 보기

화면 렌더링 흐름은 아래 순서입니다.

1. Astro 페이지 엔트리
2. `BaseLayout.astro` 공통 레이아웃
3. React 페이지 컴포넌트
4. `global.css` + 각 컴포넌트 inline style

엔트리 파일:

- `src/pages/index.astro` -> `src/components/Home.jsx`
- `src/pages/library.astro` -> `src/components/Library.jsx`
- `src/pages/tier.astro` -> `src/components/TierBoard.jsx`
- `src/pages/data.astro` -> `src/components/DataCenter.jsx`

공통 레이아웃:

- `src/layouts/BaseLayout.astro`
  - `<meta name="viewport"...>`: 모바일 스케일/안전영역
  - `.app-shell`, `.container.page-wrap`: 전체 폭/여백 규칙
  - 공통 nav(일부 페이지만), PWA script

## 2. 스타일 우선순위

현재 스타일 적용 우선순위:

1. 컴포넌트 `style={{ ... }}` inline style
2. `global.css` class
3. 브라우저 기본 스타일

## 3. 디자인 토큰 (전역)

파일:

- `src/styles/global.css` `:root` (상단)

주요 토큰:

- 색상: `--bg-*`, `--text-*`, `--accent`, `--border-*`
- 라운드: `--radius-*`
- 그림자: `--shadow-*`
- 간격: `--space-*`
- 레이아웃: `--page-max`, `--page-pad`, `--topbar-h`
- 폰트 크기: `--fs-*`

추천 수정 방식:

1. 색/간격/폰트는 먼저 토큰을 수정
2. 예외 케이스만 컴포넌트에서 개별 override

## 4. global.css 클래스 맵

파일:

- `src/styles/global.css`

핵심 레이아웃:

- `.app-shell`: 앱 전체 뼈대
- `.container`: 페이지 폭 규칙 (`dvw` 기반)
- `.page-wrap`: 상하 패딩
- `.pageHeader`, `.pageTitle`, `.pageLead`: 페이지 제목 영역
- `.nav`: sticky 상단 바

공통 UI:

- `.btn`, `.removeBtn`
- `.input`, `.select`, `.textarea`
- `.small`
- `.surface-card`

리스트/카드:

- `.grid`, `.card`, `.card .meta`

모달:

- `.modalBack`, `.modal`, `.modalBody`, `.modalCloseBtn`, `.modal .row`

검색 자동완성:

- `.suggestWrap`, `.suggestList`, `.suggestItem`, `.suggestThumb`, `.badge`

홈/데이터 전용:

- `.home-page`, `.home-grid`, `.home-row-2`, `.home-quick-panel`
- `.data-grid`, `.status-panel`, `.status-badge-row`, `.status-badge`

빠른 기록 시트:

- `.log-sheet`, `.log-sheet__header`, `.log-sheet__body`, `.log-sheet__footer`

반응형 브레이크포인트:

- `@media (max-width: 980px)`
- `@media (min-width: 901px)` (desktop scrollbar-gutter)
- `@media (max-width: 900px)` (모달/폼)
- `@media (max-width: 720px)` (모바일 패딩/네비 축소)

## 5. 페이지별 수정 포인트

### 5-1) 홈 (`src/components/Home.jsx`)

주요 블록:

- 상단 nav + 관리 드롭다운
- 페이지 헤더 (`기록 홈`)
- 퀵 상태 패널 (`surface-card home-quick-panel`)
- `YearRecapPanel`, `ResurfacingCards`, `CharacterInsightSheet` 포함

디자인 수정 시:

- 홈 전체 간격: `.home-page` 또는 루트 `gap`
- 상단 관리 버튼/패널: `Home.jsx` inline style
- 퀵 배지 모양: `.status-badge`

### 5-2) 보관함 (`src/components/Library.jsx`)

주요 블록:

1. `TopNavDataMenu`
2. 헤더/백업 메시지
3. 애니 검색 탭 (`AddAnime`)
4. 통계 대시보드
5. 라이브러리 필터/정렬 영역
6. 포스터 그리드
7. 상세 모달
8. 빠른 기록 시트

1차 클래스화 완료 영역(`global.css`의 `library-*`):

- 패널/섹션: `library-panel`, `library-panel--stats`
- 상단 탭: `library-seg-wrap`, `library-seg-btn`
- 통계: `library-stats-*`, `library-rewatch-*`
- 필터/검색: `library-filter-*`, `library-search-*`, `library-view-mode`
- 칩/슬라이더: `library-chip-*`, `library-card-size-*`
- 카드 메타: `library-card-*`, `library-genres-row*`, `library-genre-chip`

### 5-3) 티어 (`src/components/TierBoard.jsx`)

주요 블록:

- `TopNavDataMenu`
- 헤더 + 초기화
- 감상 기록 필터 패널
- 티어 레인 + 미분류 레인

### 5-4) 데이터 관리 (`src/components/DataCenter.jsx`)

주요 블록:

- `status-panel` 카드
- 저장 엔진/보호 상태/용량 막대
- 작품/티어/로그/캐릭터 카운트 카드

## 6. 홈 서브컴포넌트 수정 지도

### 6-1) `src/components/home/YearRecapPanel.jsx`

- 연말 리캡 카드 전부 inline 스타일 기반
- 연도 선택 pills, Top 작품/Top 캐릭터 카드, 공유 버튼 포함

### 6-2) `src/components/home/ResurfacingCards.jsx`

- 일부는 `.surface-card`, `.home-row-2` 사용
- 내부 행/썸네일/텍스트는 inline 스타일
- 카드 그룹 구조를 바꾸기 가장 쉬운 파일

### 6-3) `src/components/home/CharacterInsightSheet.jsx`

- 바텀시트형 오버레이
- 거의 전체가 inline 스타일
- 폭/높이/스크롤/칩 레이아웃 수정은 이 파일에서 처리

## 7. 검색 UI 수정 지도

파일:

- `src/components/AddAnime.jsx`

주요 UI:

- 검색 입력
- "보관할 때 상태" select
- 자동완성 드롭다운
- 로딩 단계 텍스트 (`찾는 중...`)

관련 전역 클래스:

- `.suggestWrap`, `.suggestList`, `.suggestItem`, `.suggestThumb`, `.badge`
- `.input`, `.select`, `.btn`, `.small`

## 8. 상단 메뉴/데이터 메뉴 수정 지도

파일:

- `src/components/TopNavDataMenu.jsx`

구성:

- 좌측: 홈/보관함/티어 링크
- 우측: 관리 버튼
- 팝오버: 내보내기 / 불러오기 탭

주의:

- 메뉴 패널 폭은 `width: 360`, `maxWidth: min(94vw, 360px)`
- 모바일 폭 대응은 `maxWidth`가 핵심

## 9. 레이아웃 깨짐 방지 규칙 (중요)

1. 폭 계산은 가능하면 `dvw` 사용
2. 모바일에서 `min-width` 남발 금지
3. 행 내부 텍스트는 `minWidth: 0` + `ellipsis` 패턴 유지
4. 칩 리스트는 `overflowX: auto` 유지
5. 모달/시트 내부는 `overflow-x: hidden` 유지
6. sticky/nav 변경 시 `scrollbar-gutter`와 같이 확인

## 10. 자주 하는 수정

### 10-1) 전체 테마 색 변경

파일:

- `src/styles/global.css` `:root`

바꿀 토큰:

- `--bg-app`, `--bg-surface`, `--text-primary`, `--accent`, `--border-*`

### 10-2) 화면 최대폭 변경

파일:

- `src/styles/global.css`

바꿀 값:

- `--page-max`
- `.container` width 규칙
- 필요 시 `.log-sheet` max width

### 10-3) 버튼 스타일 통일

파일:

- `src/styles/global.css` `.btn`, `.removeBtn`
- inline 버튼 스타일이 있는 컴포넌트 정리

### 10-4) 모달 크기/스크롤 변경

파일:

- `src/styles/global.css` `.modal`, `.modalBody`, `.modalBack`
- `Library.jsx` 상세 영역 inline style (행 배치)

## 11. 파일별 역할 요약 (디자인 관점)

- `src/layouts/BaseLayout.astro`: 공통 shell/viewport/nav 틀
- `src/styles/global.css`: 디자인 시스템 + 공통 컴포넌트 스타일
- `src/components/Home.jsx`: 홈 메인 조합
- `src/components/Library.jsx`: 보관함 메인 UX 핵심
- `src/components/AddAnime.jsx`: 검색 UI/결과 리스트
- `src/components/TierBoard.jsx`: 티어 보드 레이아웃/DnD
- `src/components/TopNavDataMenu.jsx`: 상단 관리 메뉴
- `src/components/DataCenter.jsx`: 데이터 관리 패널
- `src/components/home/*.jsx`: 홈 하위 카드/시트 UI