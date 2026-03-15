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
- 의미 기반 색상 토큰: `--color-*`
- 라운드: `--radius-*`
- 그림자: `--shadow-*`
- 간격: `--space-*`
- 레이아웃: `--page-max`, `--page-pad`, `--topbar-h`
- 폰트 원시 스케일: `--fs-*`, `--fw-*`
- 의미 기반 타이포 계층: `--type-*`

추천 수정 방식:

1. 색/간격/폰트는 먼저 토큰을 수정
2. 예외 케이스만 컴포넌트에서 개별 override

### 3-0. 문구/번역 구조

현재 한글/영문 UI 문구는 중앙 메시지 파일로 관리합니다.

기준 파일:

- `src/messages/ko.js`
- `src/messages/en.js`
- `src/domain/messages.js`

원칙:

1. 새 버튼/탭/로그 문구를 추가할 때는 컴포넌트 안에 `pickByLocale(...)`를 다시 만들지 않기
2. 먼저 `ko.js`, `en.js`에 같은 namespace로 문구를 추가하기
3. 컴포넌트에서는 `getMessageGroup(locale, "namespace")` 또는 `getMessages(locale)`로 읽기
4. 상태명/이벤트명/장르명 같은 공용 라벨은 `libraryLabels` 아래에서 관리하기

현재 주요 namespace:

- `topNavDataMenu`
- `home`
- `homeResurfacing`
- `homeTierEntryCard`
- `characterInsightSheet`
- `yearRecapPanel`
- `library`
- `addAnime`
- `libraryStatsPanel`
- `libraryFiltersPanel`
- `libraryQuickLogSheet`
- `libraryDetailModal`
- `tierBoard`
- `dataCenter`
- `libraryLabels`
- `uiText`
- `recapShare`

실무 팁:

- 특정 화면 버튼 문구를 바꿀 때: 해당 namespace만 수정
- 공통 상태/장르/이벤트 라벨을 바꿀 때: `libraryLabels`
- 상대 시간, 백업 상태, 공유 문구처럼 포맷 함수가 섞인 텍스트는 `uiText`, `recapShare`

### 3-1. 타이포 계층 규칙

현재 프로젝트는 원시 스케일 토큰(`--fs-*`, `--fw-*`) 위에 의미 기반 토큰(`--type-*`)을 한 겹 더 둡니다.

원칙:

1. 새 UI를 만들 때는 가능하면 `--fs-*`를 직접 쓰지 말고 `--type-*`를 먼저 사용
2. `--fs-*`, `--fw-*`는 디자인 시스템의 “기초 눈금”
3. `--type-*`는 실제 화면 의미에 맞는 “사용 계층”

계층별 의미:

- `display`: 가장 강한 헤드라인. 홈 hero, 큰 모달 제목, 핵심 메시지
- `title`: 페이지/섹션/카드 제목
- `body`: 일반 설명문, 본문, 리스트 본문
- `caption`: 메타 정보, 보조 설명, 날짜, 상태 보조 문구
- `label`: 버튼, 탭, 칩, 입력 라벨처럼 짧고 조작 중심인 텍스트

현재 semantic token 맵:

| 계층 | 토큰 | 기본 매핑 |
| --- | --- | --- |
| Display | `--type-display-size` | `--fs-display-md` |
| Display compact | `--type-display-compact-size` | `--fs-display-sm` |
| Display weight | `--type-display-weight` | `--fw-bold` |
| Title XL | `--type-title-xl-size` | `--fs-h1` |
| Title LG | `--type-title-lg-size` | `--fs-h2` |
| Title MD | `--type-title-md-size` | `--fs-h3` |
| Title SM | `--type-title-sm-size` | `--fs-lg` |
| Title weight | `--type-title-weight` | `--fw-bold` |
| Title compact weight | `--type-title-compact-weight` | `--fw-semibold` |
| Body LG | `--type-body-lg-size` | `--fs-lg` |
| Body | `--type-body-size` | `--fs-body` |
| Body SM | `--type-body-sm-size` | `--fs-sm` |
| Body weight | `--type-body-weight` | `--fw-regular` |
| Body strong | `--type-body-strong-weight` | `--fw-semibold` |
| Caption | `--type-caption-size` | `--fs-xs` |
| Caption compact | `--type-caption-compact-size` | `--fs-2xs` |
| Caption weight | `--type-caption-weight` | `--fw-regular` |
| Caption strong | `--type-caption-strong-weight` | `--fw-medium` |
| Label LG | `--type-label-lg-size` | `--fs-md` |
| Label | `--type-label-size` | `--fs-sm` |
| Label SM | `--type-label-sm-size` | `--fs-xs` |
| Label weight | `--type-label-weight` | `--fw-semibold` |
| Label strong | `--type-label-strong-weight` | `--fw-bold` |

공통 클래스 연결:

- `body` -> `--type-body-size`, `--type-body-weight`
- `.pageTitle` -> `--type-title-xl-size`, `--type-title-weight`
- `.pageLead`, `.sectionLead` -> `--type-body-sm-size`, `--type-body-weight`
- `.sectionTitle` -> `--type-title-lg-size`, `--type-title-weight`
- `.btn` -> `--type-label-size`, `--type-label-weight`
- `.small` -> `--type-caption-size`, `--type-caption-weight`

실무 기준:

- 페이지 최상단 제목을 바꾸고 싶으면 `pageTitle`만 수정하지 말고 먼저 `Title XL`이 맞는지 확인
- 버튼 텍스트가 너무 크거나 작으면 `Label` 계층에서 조정
- 메타 정보 전반을 키우고 싶으면 `Caption` 계층에서 조정
- 카드 설명/도움말/빈 상태 문구는 `Body` 계층으로 맞추는 것을 우선

### 3-2. 색상 계층 규칙

색상도 타이포와 같은 방식으로 2단계로 봅니다.

1. 원시 팔레트:
   `--bg-*`, `--text-*`, `--accent*`, `--success`, `--warning`, `--danger`, `--border-*`, `--surface-*`
2. 의미 기반 색상:
   `--color-*`

원칙:

1. 새 UI에서는 가능하면 `--accent`나 `--bg-surface`를 직접 쓰기 전에, 이미 있는 `--color-*`가 맞는지 먼저 확인
2. hover, active, focus, overlay, 상태색은 `--color-*` 계층에서 관리
3. 원시 팔레트는 “기본 잉크/배경/포인트 색”, semantic token은 “실제 역할”이라고 보면 됨

현재 의미 기반 색상 예시:

| 역할 | 토큰 |
| --- | --- |
| 페이지 배경 글로우 | `--color-page-glow-primary`, `--color-page-glow-secondary` |
| 포커스 링 | `--color-focus-ring`, `--color-focus-outline` |
| 위험 버튼 텍스트 | `--color-danger-contrast` |
| 홈 hero 오버레이 | `--color-hero-overlay-*`, `--color-hero-accent-*`, `--color-hero-fallback-*` |
| 홈 hero 텍스트/칩 | `--color-hero-text-*`, `--color-hero-chip-*` |
| 라이브러리 상태 배지 | `--color-state-completed-*`, `--color-state-watching-*`, `--color-state-paused-*`, `--color-state-dropped-*` |
| 별점 활성색 | `--color-rating-active` |
| 강조 하이라이트 | `--color-highlight-gold-*`, `--color-highlight-info-*` |
| 오버레이/바텀시트 | `--color-overlay-scrim`, `--color-insight-panel-*`, `--color-insight-chip-*`, `--color-insight-card-border` |

적용 위치:

- 전체 앱 표면/hover/active/focus: `src/styles/global.css`
- 홈 hero 동적 배경: `src/components/Home.jsx`
- 캐릭터 인사이트 시트 overlay/panel/chip: `src/components/home/CharacterInsightSheet.jsx`
- 테마 메타 컬러, 리캡 공유 이미지 팔레트: `src/domain/colorSystem.js`

실무 기준:

- 버튼 hover가 너무 강하면 `btn`를 직접 고치기보다 먼저 `accent / accent-soft / focus / interactive` 계열 semantic token을 확인
- hero나 배지처럼 특정 영역의 독립된 색 문법이 필요하면 `--color-<section>-*` 형태로 의미를 드러내기
- JS 캔버스나 meta theme-color처럼 CSS를 직접 못 쓰는 부분은 `src/domain/colorSystem.js`에 모아서 관리

### 3-3. 색상 표: Interactive

상호작용 계열은 hover, active, focus, pressed, selected처럼 “사용자 조작에 반응하는 색”입니다.

| 역할 | 토큰 | 주 사용처 |
| --- | --- | --- |
| 기본 인터랙션 포인트 | `--accent` | 버튼, 활성 탭, 선택 칩 |
| 강한 인터랙션 포인트 | `--accent-strong` | active gradient 끝색, 강조 border |
| 약한 인터랙션 배경 | `--accent-soft` | soft highlight, active 배경 보조 |
| 인터랙션 대비 텍스트 | `--accent-contrast` | 활성 버튼/탭 내부 텍스트 |
| 포커스 링 | `--color-focus-ring` | 입력창 focus border |
| 강한 포커스 아웃라인 | `--color-focus-outline` | 패널 헤더/버튼 focus-visible |
| 인터랙션 보더 기준 | `--border-strong` | hover/active border 기본축 |
| 위험 액션 대비 텍스트 | `--color-danger-contrast` | `removeBtn` 텍스트 |

참고:

- hover/active 그라데이션은 주로 `linear-gradient(... var(--accent), var(--accent-strong))`
- subtle hover는 `accent-soft`와 `surface-*` 조합으로 처리

### 3-4. 색상 표: Status

상태 계열은 작품 상태, 성공/경고/위험, 점수/하이라이트처럼 의미가 고정된 피드백 색입니다.

| 역할 | 토큰 | 주 사용처 |
| --- | --- | --- |
| 완료 상태 | `--color-state-completed-*` | 보관함 완료 배지 |
| 감상 중 상태 | `--color-state-watching-*` | 보관함 감상 중 배지 |
| 보류 상태 | `--color-state-paused-*` | 보관함 보류 배지 |
| 중단 상태 | `--color-state-dropped-*` | 보관함 중단 배지 |
| 성공 원시색 | `--success` | 향후 성공 피드백 기준색 |
| 경고 원시색 | `--warning` | 향후 경고 피드백 기준색 |
| 위험 원시색 | `--danger` | 삭제/실패/경고성 액션 |
| 별점 활성색 | `--color-rating-active` | 별점 fill |
| 골드 하이라이트 | `--color-highlight-gold-*` | pin/primary 강조, special active state |
| 인포 하이라이트 | `--color-highlight-info-*` | quick log character toggle active |

### 3-5. 색상 표: Overlay

overlay 계열은 배경을 덮는 레이어, 모달, 시트, 팝오버처럼 떠 있는 UI에 쓰는 색입니다.

| 역할 | 토큰 | 주 사용처 |
| --- | --- | --- |
| 앱 공통 오버레이 | `--bg-overlay` | 모달 backdrop 기본축 |
| 강한 스크림 | `--color-overlay-scrim` | 바텀시트/인사이트 시트 backdrop |
| 팝오버/모달 표면 | `--bg-elevated` | modal/panel surface 원시색 |
| 인사이트 패널 경계 | `--color-insight-panel-border` | CharacterInsightSheet outer border |
| 인사이트 패널 표면 | `--color-insight-panel-bg` | CharacterInsightSheet panel background |
| 인사이트 칩 배경 | `--color-insight-chip-bg` | CharacterInsightSheet summary chip |
| 인사이트 칩 경계 | `--color-insight-chip-border` | CharacterInsightSheet tag chip |
| 인사이트 카드 경계 | `--color-insight-card-border` | CharacterInsightSheet inner cards |
| 닫기 버튼 표면 | `--close-btn-bg` | modal close button background |
| 닫기 버튼 텍스트 | `--close-btn-text` | modal close icon/text |

### 3-6. 색상 표: Media

media 계열은 이미지/hero/canvas처럼 콘텐츠 위에 덧입혀지는 색 문법입니다.

| 역할 | 토큰/상수 | 주 사용처 |
| --- | --- | --- |
| 페이지 글로우 1 | `--color-page-glow-primary` | 앱 전체 배경 radial glow |
| 페이지 글로우 2 | `--color-page-glow-secondary` | 앱 전체 배경 보조 glow |
| hero 어두운 오버레이 | `--color-hero-overlay-*` | 홈 hero 이미지 위 contrast layer |
| hero 포인트 워시 | `--color-hero-accent-*` | 홈 hero accent wash |
| hero fallback 그라데이션 | `--color-hero-fallback-*` | 이미지 없는 hero 배경 |
| hero 텍스트 색 | `--color-hero-text-*` | hero title/lead/eyebrow |
| hero 칩 색 | `--color-hero-chip-*` | hero 메타 배지 |
| 공유 이미지 메타 컬러 | `THEME_META_COLORS` | 브라우저 `theme-color`, boot script |
| 공유 이미지 팔레트 | `RECAP_SHARE_PALETTE` | 리캡 캔버스 gradient/title/body |

운영 팁:

- 이미지 위 텍스트 대비가 흔들리면 먼저 `media` 계층에서 조정
- 버튼/탭/입력 반응이 어색하면 `interactive`
- 의미가 있는 배지/점수/하이라이트는 `status`
- 떠 있는 레이어가 너무 무겁거나 약하면 `overlay`

### 3-7. 간격 계층 규칙

간격은 원시 토큰 `--space-*` 위에 의미 기반 spacing token을 한 겹 더 둡니다.

원칙:

1. 새 레이아웃을 만들 때는 `--space-*`를 바로 쓰기보다 `--layout-gap-*`, `--inset-*`를 먼저 보기
2. `--space-*`는 숫자 눈금, `--layout-gap-*`는 블록 사이 간격, `--inset-*`는 내부 패딩 의미
3. 같은 역할의 컴포넌트는 같은 inset token을 쓰는 쪽으로 맞추기

현재 spacing token 맵:

| 역할 | 토큰 | 기본 매핑 |
| --- | --- | --- |
| 촘촘한 간격 | `--layout-gap-tight` | `--space-2` |
| 작은 간격 | `--layout-gap-sm` | `--space-3` |
| 기본 간격 | `--layout-gap-md` | `--space-4` |
| 큰 간격 | `--layout-gap-lg` | `--space-5` |
| 섹션 간격 | `--layout-gap-xl` | `--space-6` |
| 컨트롤 패딩 Y | `--inset-control-y` | `9px` |
| 컨트롤 패딩 X | `--inset-control-x` | `13px` |
| 작은 컨트롤 패딩 | `--inset-control-sm-*` | `6px / 10px` |
| 칩 패딩 | `--inset-chip-*` | `4px / 12px` |
| 카드 패딩 | `--inset-card`, `--inset-card-compact` | `16px / 12px` |
| 패널 패딩 | `--inset-panel`, `--inset-panel-compact` | `24px / 16px` |
| 팝오버 패딩 | `--inset-popover` | `12px` |
| 모달 패딩 | `--inset-modal` | `16px` |
| 시트 패딩 | `--inset-sheet-x`, `--inset-sheet-y` | `20px / 16px` |

공통 클래스 연결:

- `.page-stack` -> `--layout-gap-xl`
- `.btn`, `.input`, `.select`, `.textarea` -> `--inset-control-*`
- `.pill-btn`, `.status-badge` -> `--inset-chip-*`
- `.surface-card` -> `--inset-panel`
- `.metric-card`, `.list-card`, `.library-stats-card` -> `--inset-card*`
- `.modalBody` -> `--inset-modal`
- `.log-sheet__header`, `.log-sheet__body`, `.log-sheet__footer` -> `--inset-sheet-*`

### 3-8. 크기 계층 규칙

크기는 버튼 높이, 아이콘 버튼, 팝오버 폭, 썸네일, 아바타처럼 반복되는 컴포넌트 치수를 의미 기반 token으로 관리합니다.

현재 size token 맵:

| 역할 | 토큰 | 기본값 |
| --- | --- | --- |
| 작은 컨트롤 높이 | `--size-control-sm` | `32px` |
| 기본 컨트롤 높이 | `--size-control-md` | `40px` |
| 큰 컨트롤 높이 | `--size-control-lg` | `44px` |
| 기본 아이콘 버튼 | `--size-icon-btn` | `40px` |
| 작은 아이콘 버튼 | `--size-icon-btn-sm` | `34px` |
| pill 최소 높이 | `--size-pill-min-h` | `32px` |
| segmented 버튼 최소 높이 | `--size-seg-min-h` | `38px` |
| 닫기 버튼 크기 | `--size-close-btn` | `34px` |
| 중간 팝오버 폭 | `--size-popover-md` | `360px` |
| 작은 팝오버 폭 | `--size-popover-sm` | `172px` |
| 카드 썸네일 | `--size-thumb-card-*` | `42x58` |
| 포스터 썸네일 | `--size-thumb-poster-*` | `40x56` |
| 작은 아바타 | `--size-avatar-sm` | `32px` |
| 중간 아바타 | `--size-avatar-md` | `40px` |

실무 기준:

- 버튼 높이를 바꾸고 싶으면 개별 버튼을 고치기보다 `size-control` 계층부터 확인
- 팝오버 폭이 거슬리면 `size-popover-*`
- 카드 썸네일이나 아바타 비례가 흔들리면 `size-thumb-*`, `size-avatar-*`
- 패널이 답답하거나 느슨하면 `inset-*`, 요소 간 붙거나 벌어지면 `layout-gap-*`

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
