# 03. Title Hub + Dual View UI Spec

> **상태:** `CURRENT APPROVED UI DIRECTION — 2026-09-03`
>
> **적용 범위:** Home, 공통 navigation/search, My Titles, Title Hub, Memory Composer, Memory Archive, Memory Detail, Board 연결
>
> **상위 기준:** `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`

## 1. 목표

사용자가 다음 두 행동을 하나의 자연스러운 감상 경험으로 이해하게 한다.

```text
본 작품을 정리한다
+
그 작품에 관한 개인 기억을 모은다
```

하지만 데이터 의미는 합치지 않는다.

```text
작품 저장 상태: 작품당 0..1
Memory Card: 작품당 0..N
Board membership: Memory Card와 N:M
```

## 2. 화면별 역할

| 화면 | 중심 visual | 핵심 역할 |
| --- | --- | --- |
| Home | 최근 개인 Memory | 재발견과 다음 행동 |
| Memories | 개인 이미지·시스템 디자인·표지 기반 Memory | 모든 Complete Memory 탐색 |
| Titles — Poster View | 공식 대표 표지 | 빠른 작품 탐색과 상태 확인 |
| Titles — Memory View | 공식 표지 + 개인 Memory previews | 작품별 기억 앨범 탐색 |
| Title Hub | 공식 표지로 식별, Memory Gallery가 본문 | 한 작품의 상태와 모든 Memory 통합 |
| Boards | Memory visuals | 주제별 Memory 묶음 |

## 3. 사용자-facing 명칭

| 내부 또는 기존 표현 | 한국어 | 영어 |
| --- | --- | --- |
| Archive nav | 기억 | Memories |
| Archive page | 기억 아카이브 | Memory Archive |
| Library nav | 작품 | Titles |
| Library page | 내 작품 | My Titles |
| Create Memory Card | 기억 남기기 | Add Memory |
| Add to Library | 작품 저장 | Save Title |
| Library item/card | 작품 항목 | Title item |
| Unified title detail | 작품 상세 | Title Hub |
| Poster mode | 표지 보기 | Poster View |
| Memory mode | 기억 함께 보기 | Memory View |

`카드`라는 단어는 실제 Memory Card 결과물에만 사용한다. 작품 목록의 반복 단위는 `작품 항목`, `작품 타일`, `작품 앨범`으로 부른다.

## 4. Navigation

### 4.1 데스크톱

```text
MOEMOA
Home | Memories | Titles | Boards
[Search Titles] [ + Add Memory ] [Account / Settings]
```

우선순위:

1. Home
2. Memories
3. Titles
4. Boards — 실제 사용 가능할 때만
5. Add Memory — primary action
6. Account/Data/Tier 등 보조 기능

### 4.2 모바일

현재 상단 navigation 구조를 우선 유지한다.

```text
[MOEMOA]    [+ 기억]    [검색]    [메뉴]
```

메뉴:

```text
홈
기억
작품
보드
────────
계정 및 동기화
데이터 관리
도움말
```

320px 폭에서는 `+ 기억`을 짧게 표시하되 accessible name은 `기억 남기기`를 유지한다.

## 5. `내 작품 / My Titles`의 데이터 집합

```text
Saved Titles
UNION
Titles linked to at least one COMPLETE Memory Card
```

예:

| 작품 | 저장 | Memory | My Titles 전체 | 저장됨 filter | 기억 있음 filter |
| --- | --- | ---: | --- | --- | --- |
| 프리렌 | 예 | 5 | 표시 | 표시 | 표시 |
| 던전밥 | 예 | 0 | 표시 | 표시 | 미표시 |
| 봇치 더 록 | 아니오 | 2 | 표시 | 미표시 | 표시 |
| 검색만 한 작품 | 아니오 | 0 | 미표시 | 미표시 | 미표시 |

모든 작품 항목은 저장 여부와 Memory 수를 분리해 표시한다.

```text
저장됨 · 보는 중 · 기억 5개
미저장 · 기억 2개
저장됨 · 기억 없음
```

## 6. 공통 Filter / Sort / View control

### 6.1 상단 구성

```text
내 작품 42
작품별로 시청 상태와 남겨둔 기억을 모아보세요.

[전체] [저장됨] [기억 있음] [보는 중] [완료]
[최근 기억 ▾]                  [표지 보기 | 기억 함께 보기]
```

### 6.2 모드 전환 규칙

- 같은 query와 작품 집합을 사용한다.
- mode만 바뀌며 데이터 write는 발생하지 않는다.
- filter, sort, 검색어를 유지한다.
- focus는 mode control 또는 의미상 같은 작품 항목으로 복원한다.
- 사용자의 마지막 선택을 local preference에 저장한다.
- 첫 선택 기본값:
  - Complete Memory가 하나 이상 있으면 `MEMORY`
  - 없으면 `POSTER`
- 첫 Memory 저장 직후 자동 전환하지 않는다.
- 저장 성공 후 한 번만 다음 안내를 제공할 수 있다.

```text
이제 작품별로 기억을 함께 볼 수 있어요.
[기억 함께 보기]
```

## 7. Poster View

### 7.1 목적

```text
어떤 작품을 저장했고, 현재 상태와 Memory 수가 무엇인지 빠르게 훑는다.
```

### 7.2 모바일

권장 grid:

- 320~359px: 2열
- 360~599px: 3열을 시도하되 실제 카드 본문 폭이 96px 미만이면 2열
- 600~899px: 4~5열

작품 타일:

```text
┌────────────┐
│            │
│ 공식 표지   │  2:3
│            │
└────────────┘
장송의 프리렌
보는 중 · 기억 5
```

표시 요소:

- 공식 대표 표지
- 최대 두 줄 작품명
- 시청 상태
- `기억 N` 또는 `기억 없음`
- 평점은 option이며 좁은 모바일에서는 숨길 수 있다.
- `미저장` 상태는 작은 neutral label로 표시한다.

금지:

- 개인 Memory preview 노출
- 작품 타일을 4:5 Memory Card처럼 렌더링
- 표지 위에 과도한 action overlay
- 전체 타일과 내부 버튼의 중첩 클릭 영역

### 7.3 데스크톱

- 900~1199px: 5~6열
- 1200px 이상: 6~8열
- 표지는 원본 2:3 ratio를 유지한다.
- 카드 간 gap은 Memory Archive보다 작게 두어 고밀도 탐색을 지원한다.
- hover 시 title/status를 가리는 확대를 사용하지 않는다.

### 7.4 Memory 0 상태

```text
[공식 표지]
던전밥
보는 중 · 기억 없음
```

타일을 열면 Title Hub에서 `첫 기억 남기기`를 보여준다. Poster View grid에서 모든 타일에 큰 CTA를 반복하지 않는다.

## 8. Memory View

### 8.1 목적

```text
공식 표지로 작품을 식별하면서, 그 작품에서 실제로 남긴 이미지를 함께 본다.
```

공식 표지는 작품 앨범의 cover이고, Memory previews는 앨범 내부의 사진이다.

### 8.2 모바일 기본 카드

```text
┌──────────────────────────────┐
│ ┌────────┐  장송의 프리렌    │
│ │ 공식   │  보는 중 · ★4.5  │
│ │ 표지   │  기억 5개         │
│ │  2:3   │                   │
│ └────────┘                   │
│                              │
│ [Memory 1] [Memory 2] [+3]   │
│ “눈 내리던 장면이 좋았다.”    │
└──────────────────────────────┘
```

390px 기준:

- 공식 표지 영역: 카드 콘텐츠 폭의 약 30~36%
- 작품 정보: 표지 오른쪽
- Memory preview strip 또는 mosaic: 전체 폭 하단
- preview 2~3개
- 나머지는 `+N`
- 최신 짧은 기억은 최대 두 줄

### 8.3 압축형 대안

폭이 충분하면 다음 mosaic를 사용할 수 있다.

```text
┌────────┐ ┌─────────┬─────────┐
│ 공식   │ │ Memory │ Memory  │
│ 표지   │ ├─────────┼─────────┤
│        │ │ Memory │   +2    │
└────────┘ └─────────┴─────────┘
장송의 프리렌
보는 중 · 기억 5개
```

단, DOM 읽기 순서는 작품 식별 → 상태 → Memory previews → cue를 따른다.

### 8.4 데스크톱

- 900~1199px: 1~2열
- 1200px 이상: 2~3열
- 작품 앨범 하나가 너무 작아지지 않도록 최소 콘텐츠 폭을 340px 이상으로 둔다.
- official cover와 mosaic의 시각 면적은 약 35:65를 기본으로 한다.

### 8.5 Preview 선택 우선순위

한 작품의 전체 Memory를 목록에서 모두 불러오지 않는다. 최근 또는 대표 preview 최대 3개만 사용한다.

기본 우선순위:

1. 사용자 가져온 이미지·장면 이미지
2. 사용자 원본·팬아트 등 개인성이 높은 이미지
3. 시스템 디자인
4. 공식 표지 기반 Memory
5. `MISSING`은 정상 preview와 섞지 않고 상태 badge로 요약

공식 표지 기반 Memory는 Memory 수에는 포함한다. 다만 같은 표지가 작품 anchor와 중복되므로 다른 visual이 존재하면 preview slot에서 후순위로 둔다.

### 8.6 Memory 0 상태

```text
┌──────────────────────────────┐
│ [공식 표지]  던전밥          │
│              보는 중         │
│              기억 없음       │
│                              │
│ 이 작품에서 남길 순간이 있나요?
│ [첫 기억 남기기]             │
└──────────────────────────────┘
```

Memory 0 카드에서만 작고 명확한 CTA를 허용한다.

### 8.7 Memory만 있고 미저장인 상태

```text
[공식 표지] 봇치 더 록!
미저장 · 기억 3개
[Memory][Memory][Memory]
```

`작품 저장`은 secondary action이며 Memory View 카드 전체의 primary affordance는 Title Hub 열기다.

## 9. 공식 표지의 두 역할 구분

### 9.1 작품 anchor

- 항상 작품 식별에 사용
- Memory count에 포함하지 않음
- source label은 보통 생략 가능하나 상세에서는 `작품 표지`를 표시할 수 있음
- 클릭하면 Title Hub

### 9.2 표지 기반 Memory Card

- 사용자가 명시적으로 생성
- Memory count에 포함
- cue/date/emotion 등 개인 신호를 가짐
- Memory Detail로 이동
- Archive와 Board에 포함 가능
- badge: `공식 표지 / Official cover`

동일 이미지라도 DOM과 interaction target을 합치지 않는다.

## 10. PrivateTitle 표현

PrivateTitle에는 공식 표지를 가장한 이미지를 만들지 않는다.

Poster View:

```text
┌────────────┐
│ Private    │
│ Title      │
│ System tile│
└────────────┘
개인 작품명
기억 2개
```

Memory View:

- neutral PrivateTitle anchor
- 실제 Memory previews는 정상 표시
- `개인 작품명 / Private title` badge

## 11. Title Hub

### 11.1 핵심 구조

```text
작품 식별
→ 내 상태
→ 이 작품의 Memory Gallery
→ 작품 메타데이터와 관계작
```

### 11.2 모바일

```text
← 작품

┌───────┐  장송의 프리렌
│ 공식  │  2023 · TV · 28화
│ 표지  │  저장됨 · 보는 중
└───────┘  ★ 4.5

[기억 남기기]  [상태 변경]

────────────────────────

내 기억 5개
그 작품에서 남은 장면과 느낌입니다.

[Memory] [Memory]
[Memory] [Memory]

[이 작품의 기억 모두 보기]

────────────────────────

시청 기록
작품 정보
관계작
```

위계:

1. 작품 식별과 primary action
2. Memory Gallery
3. 시청 상태의 편집 세부
4. 카탈로그 상세·관계작

시청 상태는 상단에서 확인 가능해야 하지만 Memory Gallery보다 더 큰 visual block이 되지 않는다.

### 11.3 데스크톱

```text
┌─ 작품/상태 26~30% ─┬─ Memory 70~74% ──────────────┐
│ 공식 표지           │ 내 기억 7개                  │
│ 작품명              │ [ + 기억 남기기 ]           │
│ 상태·평점           │                              │
│ WatchLog 요약       │ [4:5] [4:5] [4:5]           │
│ 작품 저장/해제      │ [4:5] [4:5] [4:5]           │
└────────────────────┴──────────────────────────────┘
```

### 11.4 상태별 Empty/CTA

| 저장 | Memory | 표시 |
| --- | ---: | --- |
| 아니오 | 0 | `기억 남기기` primary, `작품 저장` secondary |
| 예 | 0 | 상태 요약 + `첫 기억 남기기` |
| 아니오 | 1+ | Memory Gallery + `작품 저장` secondary |
| 예 | 1+ | 상태 요약 + Memory Gallery + `기억 남기기` |

### 11.5 Cross-link

- Memory Detail의 작품명 또는 `이 작품 보기` → Title Hub
- My Titles의 작품 항목 → Title Hub
- 검색 결과 행 → Title Hub
- Home의 작품 요약 → Title Hub
- Board의 Memory Detail → Title Hub

## 12. 검색 결과

```text
┌──────┐  장송의 프리렌
│ 공식 │  2023 · TV · 28화
│ 표지 │  저장됨 · 기억 3개
└──────┘

[기억 남기기]    [작품 보기]
```

미저장일 때:

```text
미저장 · 기억 1개
[기억 남기기]    [작품 저장]
```

행동 위계:

1. `기억 남기기` — primary
2. `작품 저장` — secondary
3. 결과 행 또는 제목 — Title Hub

같은 행에 상태와 CTA가 과밀해지면 mobile에서는 행 선택 후 Title Hub에서 행동하도록 단순화할 수 있다. 단, 제품 전체에서 두 행동의 독립성은 유지한다.

## 13. Memory Composer

### 13.1 Visual source choice

```text
Visual 선택
[내 이미지]        추천
[공식 표지]
[시스템 디자인]
```

영어:

```text
Choose a visual
[My image]         Recommended
[Official cover]
[System design]
```

### 13.2 진입별 동작

#### Title Hub에서 진입

- titleRef가 이미 선택됨
- 공식 표지를 즉시 선택 가능
- 내 이미지 또는 시스템 디자인으로 변경 가능

#### Global Add Memory에서 진입

- `내 이미지`: 이미지 선택 후 작품 선택
- `시스템 디자인`: 디자인 선택 후 작품 선택
- `공식 표지`: 작품 검색 sheet를 먼저 열고 선택한 작품의 cover를 resolve

### 13.3 공식 표지 선택 상태

필수 UI:

- 2:3 원본을 과도하게 crop하지 않은 preview
- `공식 표지 / Official cover` source badge
- 작품명
- 개인 기억 신호 requirement
- 다른 Visual로 변경

Save block copy:

```text
공식 표지로 만든 기억에는 감상, 날짜, 감정 또는 장면 정보 중 하나를 남겨주세요.
```

### 13.4 Web과 Android 우선순위

- Android: `내 이미지`를 가장 강하게 권장
- Web: 공식 표지와 시스템 디자인을 빠른 시작점으로 제공 가능
- 플랫폼에 따라 선택 순서는 달라도 같은 domain contract를 사용

## 14. Memory Archive에서 표지 기반 카드 표시

Archive frame은 4:5 기반을 유지한다.

공식 표지는 보통 2:3이므로 다음을 적용한다.

- visual renderer는 `CATALOG_COVER`에서 기본 `contain`
- 남는 배경은 neutral surface 또는 cover에서 파생한 비식별적 색면
- grid에서 무조건 `object-fit: cover`로 주요 내용을 잘라내지 않음
- badge `공식 표지`
- title, 최대 두 줄 cue, date 표시

개인 이미지 Card는 기존 grid thumbnail 규칙을 유지한다.

## 15. 시각 구분 규칙

| 구분 | 작품 공식 표지 anchor | Memory visual |
| --- | --- | --- |
| 기본 비율 | 2:3 | 4:5 frame 또는 원본 contain |
| 반복 수 | 작품당 1개 | 작품당 0..N |
| 클릭 결과 | Title Hub | Memory Detail |
| 메타데이터 | 제목·연도·상태 | cue·날짜·source |
| Board 대상 | 아니오 | 예 |
| Memory 수 포함 | 아니오 | 예 |

색만으로 구분하지 않는다. ratio, 위치, 반복 구조, label, 클릭 결과를 함께 다르게 한다.

## 16. Component contract

### 16.1 작품 계열

```text
TitlePoster
TitleIdentity
TitlePosterTile
TitleAlbumCard
TitleStatusSummary
TitleMemoryPreviewStrip
TitleViewModeControl
TitleFilterBar
TitleHubHeader
```

### 16.2 Memory 계열

```text
MemoryVisual
MemoryCardPreview
MemoryGallery
MemorySourceBadge
AddMemoryAction
```

### 16.3 Display model

```ts
type TitleCollectionViewMode = "POSTER" | "MEMORY";

type TitleAlbumProjection = {
  titleRef: TitleRef;
  displayTitle: string;
  subtitle?: string;
  isPrivateTitle: boolean;
  officialCover: null | {
    catalogCoverId: string;
    src: string;
    width?: number;
    height?: number;
  };
  tracking: null | {
    isSaved: boolean;
    watchStatus?: string | null;
    rating?: number | null;
  };
  memoryCount: number;
  previewMemories: Array<{
    cardId: string;
    sourceKind: "USER_IMAGE" | "CATALOG_COVER" | "SYSTEM_DESIGN" | "MISSING";
    visual: MemoryVisualModel;
    cue?: string;
    updatedAt: string;
  }>;
  latestMemoryAt?: string | null;
};
```

Presentational component는 repository, sync, navigation을 직접 import하지 않는다. screen container가 projection을 만들고 render component에 전달한다.

## 17. 성능 규칙

- My Titles 목록에서는 작품당 preview 최대 3개만 조회한다.
- 전체 Memory는 Title Hub 진입 후 pagination 또는 lazy query한다.
- 첫 viewport의 official covers는 명시적 size를 가진다.
- 화면 밖 official cover와 Memory preview는 lazy load한다.
- mode 전환 시 동일 data cache를 재사용한다.
- Memory View에서 큰 original bytes를 직접 decode하지 않고 preview derivative를 사용한다.
- `CATALOG_COVER` reference는 같은 URL/record를 캐시하고 카드마다 duplicate download key를 만들지 않는다.
- image load 전 aspect-ratio frame을 확보해 CLS를 방지한다.

## 18. 접근성

- mode control은 `radiogroup` 또는 적절한 segmented control semantic을 사용한다.
- 각 option은 `표지 보기`, `기억 함께 보기` accessible name을 가진다.
- grid/list 항목의 제목과 상태를 screen reader가 읽을 수 있어야 한다.
- image alt는 역할을 구분한다.
  - `장송의 프리렌 작품 표지`
  - `장송의 프리렌 메모리 카드 이미지`
- Memory mosaic의 decorative duplicate는 alt를 비우고 카드 링크에 의미를 제공한다.
- 모바일 주요 target은 최소 44×44 CSS px.
- 200% zoom과 320 CSS px reflow에서 기능 손실과 양방향 scroll이 없어야 한다.
- focus-visible과 keyboard order는 mode 전환 후에도 안정적이어야 한다.

## 19. 필수 fixture

- 저장됨 + Memory 0
- 미저장 + Memory 1
- 저장됨 + 사용자 이미지 Memory 여러 개
- 저장됨 + 공식 표지 기반 Memory만 있음
- 사용자 이미지 + 시스템 디자인 + 표지 기반 Memory 혼합
- PrivateTitle + Memory
- 공식 표지 없음
- Memory Visual `MISSING`
- 긴 한국어/영어 제목
- Poster View와 Memory View에서 동일 필터 결과
- 첫 선택 preference 없음
- 저장된 mode preference 있음

## 20. 승인 Screenshot

기존 golden을 무조건 대량 갱신하지 않는다. 다음 새 critical state만 추가한다.

| 화면 | 권장 golden |
| --- | --- |
| My Titles Poster View | 390 KO dark, 1440 EN light |
| My Titles Memory View | 390 EN dark, 1440 KO light |
| Title Hub | 390 KO dark `SAVED_WITH_MEMORY`, 1440 EN light `NOT_SAVED_WITH_MEMORY` |
| Composer | 390 KO light `CATALOG_COVER_SELECTED`, 1440 EN dark save-blocked without personal signal |
| Archive | 390 EN dark mixed source cards |

나머지 viewport와 locale/theme 조합은 DOM/layout assertion으로 검증한다.

## 21. 사람 검토 질문

1. 설명 없이 `표지 보기`와 `기억 함께 보기`의 차이를 말할 수 있는가?
2. 작품 표지 자체와 표지 기반 Memory Card의 차이를 말할 수 있는가?
3. Memory만 있는 작품이 `미저장`임을 이해하는가?
4. 작품 저장만으로 Memory가 생기지 않는다는 것을 이해하는가?
5. 같은 작품의 개인 이미지들을 10초 안에 찾을 수 있는가?
6. Poster View에서 원하는 작품을 빠르게 찾을 수 있는가?
7. Memory View가 단순 트래커가 아니라 작품별 개인 앨범처럼 느껴지는가?
8. Title Hub에서 상태 변경과 새 Memory 작성을 구분할 수 있는가?
9. 공식 표지 기반 Memory에 개인 신호를 왜 요구하는지 이해하는가?
10. Board에 작품 표지 anchor가 아니라 Memory Card가 들어간다는 것을 이해하는가?
