# MOEMOA Image-first Web UI Readiness Design

> **Status:** `CURRENT_APPROVED_DIRECTION — REFINED SPEC FOR REVIEW — IMPLEMENTATION NOT STARTED`
>
> **Approved:** 2026-08-24
>
> **Scope:** 첫 Private Vertical Slice의 Web UI Readiness Gate. Home, 공통 navigation/search, Memory Card 작성, Archive, Memory Card 상세, Library와 Memory 행동 구분의 시각·사용성 개선과 자동 검증 기준.

## 1. 목적

MOEMOA의 현재 기능 경계와 local-only 저장 모델을 유지하면서, 사용자가 서비스를 처음 봤을 때 다음을 즉시 이해하고 완료할 수 있는 공용 Web UI 기준을 만든다.

```text
애니 작품을 찾는다
→ 장면 또는 시스템 디자인을 선택한다
→ 짧은 기억을 남긴다
→ Memory Card를 저장한다
→ Home과 Archive에서 다시 본다
```

이번 설계는 단순한 색상 교체가 아니다. 이미지 우선 정보 계층, 핵심 행동의 우선순위, 반응형 화면 구조, 상태별 시각 표현, 접근성, 반복 가능한 screenshot 회귀 검증을 하나의 gate로 묶는다.

### 1.1 이번 범위의 완료 결과

이번 범위가 끝났을 때 사용자는 다음 결과를 얻는다.

- 빈 Home에서도 MOEMOA가 어떤 Memory Card를 만드는 서비스인지 시각적으로 이해한다.
- 모바일과 데스크톱에서 같은 순서로 카드를 만들되 각 화면 크기에 맞는 밀도로 사용한다.
- 저장된 Memory Card를 이미지 중심 Archive에서 빠르게 다시 찾는다.
- catalog 작품 추가와 개인 Memory Card 작성이 서로 다른 행동임을 구분한다.
- 한국어·영어와 dark·light theme에서 같은 기능 위계와 접근성을 유지한다.

### 1.2 명시적 비목표

- 로고, 브랜드명, 전체 색상 정체성을 새로 만드는 전면 branding 작업
- 추천 feed, social proof, 평점·랭킹·인기 지표 추가
- 외부 서비스의 화면, 아이콘, 문구, 이미지 asset을 복제하거나 저장소에 포함
- Board, sync, account, cloud image, Public UGC를 미리 구현
- 모든 legacy 화면을 같은 시점에 재설계
- 시각 회귀를 통과시키기 위한 임의의 pixel threshold 확대 또는 동적 영역 blanket mask

## 2. 상위 결정과 변경하지 않는 경계

다음 결정은 그대로 유지한다.

- MOEMOA는 일반 애니 트래커가 아니라 이미지 중심 개인 기억 아카이브다.
- Complete Memory Card는 `Anime 또는 PrivateTitle + VisualAsset 1개`를 만족해야 한다.
- Android는 이미지 수집과 빠른 작성의 주력 클라이언트이며, Web은 Archive와 향후 Board의 주력 화면이다.
- Web과 Android는 같은 React UI와 domain contract를 사용한다.
- Web UI Gate가 닫히기 전 Android UI 확장을 시작하지 않는다.
- Library, WatchLog, Tier는 legacy 경계를 유지한다. Memory Card나 Board로 자동 승격하지 않는다.
- 일반 Web에서 사용자 이미지를 서버에 업로드하거나 영구 저장하지 않는다.
- Production catalog 대표 표지는 검색·상세 presentation asset이며 사용자 Memory Card의 VisualAsset으로 복사하지 않는다.
- Public UGC, sync, private cloud, Board 구현은 이번 범위에 포함하지 않는다.
- 영어 기본과 한국어 선택을 모두 지원하며 상태에는 번역 문자열 대신 message key 또는 error code를 보존한다.

## 3. 현재 화면에서 확인한 문제

2026-08-24에 빈 상태 Home, Memory Card 작성, Archive를 390×844와 1440×900에서 실제 렌더링해 확인했다.

### 3.1 Home

- 데스크톱 빈 상태는 얕은 텍스트 패널 뒤에 넓은 빈 공간이 남아 이미지 서비스의 성격이 보이지 않는다.
- `Memory Card 만들기`와 `Library에 작품 추가`가 비슷한 시각 강도로 노출된다.
- 첫 사용자가 완성된 Memory Card의 형태를 예상할 시각 단서가 없다.

### 3.2 Memory Card 작성

- 안내문, privacy 패널, 이미지 패널, 입력 패널이 모두 비슷한 테두리와 배경을 사용해 우선순위가 약하다.
- 모바일에서는 이미지 영역과 설명을 지나야 작품·감상·저장에 도달해 핵심 흐름이 길게 느껴진다.
- 데스크톱의 넓은 폭을 활용하지 못하고 긴 단일 열 form으로 표시된다.
- 사용자 이미지가 없는 일반 Web에서도 빈 이미지 영역이 지나치게 크고 시스템 디자인 대안이 눈에 잘 띄지 않는다.

### 3.3 Archive

- 빈 상태에서 header action과 empty-state action이 중복된다.
- 카드가 저장됐을 때 적용되는 16:10 가로형 grid는 이미지 수집·포토카드 인상을 충분히 전달하지 못한다.
- Archive와 향후 Board가 같은 Memory Card 표현을 공유할 기준이 부족하다.

### 3.4 공통 시각 체계

- 화면마다 padding, radius, 색상 fallback을 개별 정의해 공통 token과 실제 스타일 사이의 편차가 있다.
- 테두리로 영역을 구분하는 비중이 높고 표면 명암·여백·크기 차이가 약하다.
- 모바일 검색 trigger의 문구가 짧은 폭에서 잘려 검색 행동이 불명확해질 수 있다.
- 기능 테스트는 존재하지만 상태별 승인 screenshot baseline은 없다.

## 4. 참고 서비스에서 채택할 원리

참고 서비스의 시각 표현을 복제하지 않고 각 서비스가 해결한 정보 구조만 사용한다.

| 참고 | 채택할 원리 | 채택하지 않을 것 |
| --- | --- | --- |
| AniList | 표지·제목·연도·형식을 빠르게 구분하는 검색 결과 | 정보 밀도가 높은 tracker dashboard, 점수 중심 화면 |
| Letterboxd | 일정한 시각 단위의 poster grid, 기록과 목록의 명확한 구분 | 평가·인기·사회적 반응 중심 구조 |
| Pinterest | 이미지가 먼저 보이는 collection, Pin에서 Board로 확장되는 구조 | 무제한 masonry feed, 추천·쇼핑 중심 구조 |

MOEMOA의 조합은 다음과 같다.

```text
카탈로그 검색: AniList 수준의 빠른 식별
개인 기록: Letterboxd 수준의 정돈된 반복 단위
Archive/Board: Pinterest 수준의 이미지 우선순위
제품 정체성: 사용자 개인 장면과 짧은 기억이 중심
```

참고는 공개된 제품 구조와 공식 설명을 관찰하는 데 한정한다. 구현자는 외부 screenshot을 source asset, test fixture, mock data로 복사하지 않는다.

## 5. 선택한 시각 방향

선택안은 **Cinematic Memory Gallery**다.

- 어두운 현재 브랜드 기반은 유지한다.
- 사용자 이미지와 시스템 디자인이 가장 강한 시각 요소다.
- 한 의사결정 영역에서 강한 primary action은 하나만 둔다. 서로 독립된 section은 각자의 primary action을 가질 수 있지만 같은 viewport에서 경쟁하지 않게 위계를 낮춘다.
- 카드, 패널, 입력 영역을 같은 외형으로 만들지 않는다.
- Archive는 예측 가능한 editorial grid를 사용한다. 불규칙 masonry는 첫 gate에서 사용하지 않는다.
- 애니 catalog 표지와 사용자 Memory visual은 source label과 구성으로 구분한다.
- 장식적 motion보다 읽기 순서, 터치 영역, 상태 변화, 이미지 비율을 우선한다.

### 5.1 시각 위계

```text
1. 사용자 Memory 이미지 또는 시스템 디자인
2. Memory Card 제목과 짧은 기억
3. 현재 사용자가 해야 하는 primary action
4. 날짜·작품 provenance·저장 상태
5. 설정·관리·legacy 보조 행동
```

## 6. 공통 디자인 시스템

### 6.1 표면

공통 token을 사용해 세 단계로 구분한다.

- `app background`: 페이지 전체 배경
- `content surface`: form, empty state, detail metadata
- `featured surface`: 최근 Memory와 시각적 hero

같은 화면에서 모든 section에 border를 두지 않는다. 인접 영역은 padding, background tone, section gap을 우선 사용하고 focus·선택·오류 상태에만 강한 border를 사용한다.

### 6.1.1 Layout token

- 공통 page container는 `min(100% - 2 × page padding, 1200px)`를 기본으로 한다.
- 읽기 중심 form과 detail text column은 680px를 넘기지 않는다.
- desktop composer와 featured Home만 1200px container를 사용한다.
- page padding은 320~479px에서 12px, 480~899px에서 20px, 900px 이상에서 28~32px 범위의 공통 token으로 관리한다.
- section gap은 compact 16px, default 24px, spacious 32px의 세 단계만 사용한다.
- 새로운 화면별 간격 값을 임의로 추가하기 전에 기존 token으로 표현 가능한지 확인한다.

### 6.2 색상

- 현재 dark theme를 유지한다.
- primary accent는 Memory Card 생성·저장처럼 현재 흐름을 전진시키는 행동에만 사용한다.
- Library 추가, 설정, 취소는 neutral 또는 subtle 스타일을 사용한다.
- success, warning, danger는 의미 전달 용도로만 사용하고 장식 색으로 사용하지 않는다.
- light theme에서도 동일한 대비 관계를 유지한다.
- 일반 크기 text는 배경과 4.5:1 이상, 24px 이상 또는 굵은 18.66px 이상 large text는 3:1 이상을 만족한다.
- focus indicator와 의미 있는 control 경계는 인접 색상과 3:1 이상 구분한다.

### 6.3 타이포그래피

- 페이지 제목은 모바일 30~36px 범위에서 두 줄을 허용하고 불필요한 대문자 장식을 줄인다.
- section 제목은 20~24px, body는 최소 15px, 보조 설명은 최소 13px을 유지한다.
- 한국어와 영어의 line-height를 동일 token으로 관리하되 한국어 조사·영어 단어 중간의 부자연스러운 줄바꿈을 막는다.
- 제목은 최대 두 줄, 카드 cue는 최대 두 줄로 제한하고 전체 내용은 상세에서 제공한다.

### 6.4 제어 요소

- MOEMOA의 모바일 primary·navigation·form control touch target은 최소 44×44 CSS px을 제품 기준으로 사용한다.
- inline text link를 제외한 모든 pointer target은 최소 24×24 CSS px 또는 WCAG 2.2 spacing 예외를 만족한다.
- primary button은 현재 영역에서 하나만 강한 색으로 표시한다.
- icon-only button은 accessible name과 tooltip/title을 가진다.
- disabled 상태는 색상뿐 아니라 opacity와 cursor, 필요 시 설명으로 구분한다.
- focus-visible outline은 모든 theme에서 배경과 3:1 이상 구분되도록 한다.

### 6.5 Motion

- hover lift와 image zoom은 120~180ms 범위의 작은 변화만 사용한다.
- 저장·삭제·화면 전환의 결과는 motion에만 의존하지 않는다.
- `prefers-reduced-motion: reduce`에서 transform과 transition을 제거한다.

### 6.6 이미지와 성능

- featured visual, grid thumbnail, detail visual은 고정 aspect-ratio frame을 먼저 확보해 image load에 따른 layout shift를 막는다.
- 첫 viewport의 featured image는 명시적인 크기를 갖고, 화면 밖 grid image는 lazy load한다.
- decorative background image만으로 title이나 action의 의미를 전달하지 않는다.
- 새 layout·animation·carousel dependency를 추가하지 않는다.
- test fixture image는 repository 안의 작고 결정적인 synthetic asset만 사용한다.

## 7. 공통 navigation과 검색

### 7.1 데스크톱

- 브랜드, Home, Archive, Library를 첫 navigation group으로 둔다.
- `Create memory card`를 primary action으로 둔다.
- 검색은 충분한 폭이 있을 때 inline field로 유지한다.
- legacy Tier와 데이터·설정은 기능을 삭제하지 않고 낮은 우선순위의 보조 navigation으로 표시한다.

### 7.2 모바일

- 브랜드, `+ Card`, 검색 trigger, menu의 네 영역을 한 줄에 유지한다.
- 검색 trigger는 좁은 폭에서 긴 placeholder 대신 검색 icon과 `Search`/`검색` accessible label을 사용한다.
- menu가 열려도 main content가 의도치 않게 스크롤되지 않게 한다.
- Android 적용 시 상단 safe area와 WebView keyboard를 별도 gate에서 검증한다.

### 7.3 검색 결과

- catalog 결과는 대표 표지, 대표 제목, 보조 제목, 연도·형식을 표시한다.
- `Create card`를 primary action, `Add to Library`를 secondary action으로 분리한다.
- Legacy 결과는 `Legacy data · unverified` label을 유지하되 action보다 강하게 보이지 않게 한다.
- catalog 상세로 이동해도 정확한 내부 `animeId`를 유지한다.

## 8. Home 설계

### 8.1 카드가 없는 상태

빈 Home은 단순 안내 상자가 아니라 완성 결과를 설명하는 onboarding hero다.

```text
모바일
브랜드 navigation
→ 시스템 디자인 예시가 포함된 Memory Card preview
→ 한 문장 가치 제안
→ Create memory card primary CTA
→ Add a title secondary text/button

데스크톱
왼쪽: 가치 제안과 primary CTA
오른쪽: service-generated Memory Card preview 2~3개
```

- preview는 외부 catalog 표지를 사용하지 않는다.
- deterministic system design과 예시 문구를 사용하되 실제 저장된 카드처럼 오인되지 않게 `Example`/`예시` label을 표시한다.
- 첫 viewport 안에서 primary CTA 전체가 보여야 한다.

### 8.2 카드가 있는 상태

- 가장 최근 Memory Card를 큰 featured card로 표시한다.
- 사용자의 실제 Memory visual, 제목, cue, 저장 날짜를 보여준다.
- featured card에서 상세와 Archive로 이동할 수 있다.
- 아래에는 최근 Memory grid와 전체 카드 수를 표시한다.
- legacy Library/WatchLog 요약은 Memory 영역 아래에서 분리된 section으로 유지한다.

## 9. Memory Card 작성 설계

### 9.1 데스크톱

1024px 이상에서는 두 열을 사용한다.

```text
┌─ visual workspace 55~60% ─┬─ memory form 40~45% ─┐
│ preview / empty design     │ title search          │
│ image action               │ selected title        │
│ system design action       │ short reflection      │
│                             │ privacy summary       │
│                             │ save action           │
└─────────────────────────────┴───────────────────────┘
```

- visual workspace는 form scroll 중에도 viewport 안에 유지할 수 있도록 제한된 sticky 동작을 사용한다.
- sticky는 화면 높이가 충분하고 keyboard가 없는 데스크톱에서만 적용한다.
- `1024×768`처럼 높이가 800px 이하인 화면에서는 sticky를 끄고 document flow를 사용한다.
- privacy 설명은 compact summary로 표시하고 필요한 상세만 펼친다.

### 9.2 모바일

다음 순서를 유지한다.

```text
visual 선택
→ 작품 선택
→ 짧은 기억
→ 권리 확인이 필요한 경우 확인
→ 저장
```

- 이미지 placeholder의 높이는 viewport를 독점하지 않게 조절한다.
- `Choose image`와 `Use system design`은 하나의 choice group으로 보인다.
- 저장 action은 조건이 충족되면 bottom safe area 위에서 접근 가능하되 content를 가리지 않는다.
- sticky save가 keyboard와 충돌하면 일반 document flow로 전환한다.

### 9.3 상태

- `EMPTY_VISUAL`: system design과 Android image intake를 모두 설명한다.
- `SYSTEM_DESIGN_SELECTED`: 실제 저장될 preview를 표시한다.
- `IMAGE_SELECTED`: bounded preview를 표시하고 교체·취소 행동을 제공한다.
- `TITLE_SEARCHING`: 결과 영역 안에 loading state를 표시한다.
- `TITLE_SELECTED`: 대표 제목과 source label을 표시한다.
- `PRIVATE_TITLE`: 공용 작품이 아니라는 점을 조용히 설명한다.
- `SAVE_BLOCKED`: 충족되지 않은 조건을 해당 control 가까이에 표시한다.
- `SAVING`: 중복 저장을 막고 primary action에 진행 상태를 표시한다.
- `SAVED`: Archive와 상세 재열람 action을 제공한다.
- `ERROR`: 원인 code에 대응하는 locale message와 재시도 또는 안전한 이탈 경로를 제공한다.
- `OFFLINE`: catalog 검색 실패와 local save 가능 여부를 분리해 설명하고 PrivateTitle 진행 경로를 유지한다.
- `CLEANUP_PENDING`: 새 Card 또는 새 visual 저장 성공과 background cleanup 재시도를 실패처럼 혼합하지 않는다.

## 10. Archive 설계

### 10.1 Empty

- header와 empty surface 중 한 곳에만 primary create action을 둔다.
- system design으로 만든 예시 카드 silhouette를 배경 visual로 사용할 수 있다.
- `카드가 없습니다`보다 `첫 장면을 남겨보세요`처럼 사용자의 다음 행동을 설명한다.

### 10.2 Grid

- Memory Card preview는 4:5 기반의 일정한 visual frame을 사용한다.
- 원본은 자르거나 변경하지 않으며 grid thumbnail에서만 `object-fit: cover`를 사용한다.
- 상세에서는 전체 visual을 `contain`으로 제공한다.
- 320~359px는 1열, 360~767px는 2열, 768~1199px는 3열, 1200px 이상은 4열을 기본으로 한다.
- grid gap과 page padding을 제외한 카드 본문 폭이 148px 미만이면 자동으로 한 열 적은 layout을 선택한다.
- 각 카드에는 title, 최대 두 줄 cue, 저장 날짜, visual 상태만 표시한다.
- 카드 전체가 상세 link이며 내부 관리 action을 grid 위에 과도하게 겹치지 않는다.

### 10.3 향후 Board 호환

- Archive와 Board는 같은 presentational Memory Card component를 공유할 수 있어야 한다.
- Board membership, drag handle, 공개 상태는 이번 구현에 추가하지 않는다.
- Archive card component가 Board domain을 import하지 않는다.

## 11. Memory Card 상세 설계

- visual을 첫 번째 주요 content로 표시한다.
- title, cue, date, source는 visual 아래의 metadata group에 둔다.
- `Edit reflection`과 `Replace image`는 명확한 관리 action으로 제공한다.
- 삭제는 danger 영역 또는 overflow menu로 분리하고 accidental activation을 막는다.
- 삭제 확인에는 삭제 대상, 이미지 제거 범위, 되돌릴 수 없음을 명시하고 기본 focus를 cancel에 둔다.
- `MISSING` visual은 빈 이미지로 숨기지 않고 복구와 카드 삭제 진입점을 제공한다.
- desktop에서는 visual과 metadata를 두 열로 둘 수 있고, mobile에서는 한 열로 표시한다.

## 12. Library와 Memory 행동 분리

- `Create card`는 Memory composer로 이동하며 Library state를 변경하지 않는다.
- `Add to Library`는 현재 search/Library context에서 완료되고 Memory draft 또는 detail route를 만들지 않는다.
- 동일 작품이 두 영역에 존재해도 UI에서 `In Library`와 `Memory cards N`을 별도 상태로 표시한다.
- Library 상세 배경이 다른 action 뒤에 남거나 URL query로 재개되지 않게 현재 focus·URL cleanup 계약을 유지한다.

## 13. 반응형 기준

승인 viewport는 다음 네 개다.

| 이름 | 크기 | 목적 |
| --- | ---: | --- |
| compact mobile | 320×720 | 최소 지원 폭, 한국어·영어 줄바꿈, 터치 target |
| standard mobile | 390×844 | 주 모바일 설계 기준 |
| tablet | 768×1024 | grid 전환과 navigation 중간 상태 |
| desktop | 1440×900 | 넓은 화면의 정보 밀도와 두 열 composer |

추가 layout 검사는 360×800, 412×915, 1024×768, 1280×720에서도 horizontal overflow와 primary action 가시성을 확인한다.

Breakpoint는 viewport 이름이 아니라 content가 실제로 들어갈 최소 폭에서 결정한다. CSS와 test는 같은 breakpoint 상수를 직접 공유하지 않더라도 아래 전환 계약을 동일하게 표현해야 한다.

| 범위 | Navigation | Composer | Archive |
| --- | --- | --- | --- |
| 320~359px | compact mobile | 1열 | 1열 |
| 360~767px | mobile | 1열 | 2열 |
| 768~1023px | tablet | 1열 또는 충분한 폭의 2열 | 3열 |
| 1024~1199px | desktop | 2열, 낮은 높이에서는 sticky 해제 | 3열 |
| 1200px 이상 | desktop | 2열 | 4열 |

## 14. 상태 fixture와 시각 회귀

### 14.1 고정 fixture

다음 fixture를 테스트 전용으로 결정적으로 생성한다.

- 빈 Home/Archive
- system design Memory Card 1개
- 사용자 이미지 Memory Card 1개
- 같은 작품의 Memory Card 여러 개
- 한국어 긴 제목과 영어 긴 제목
- 두 줄 cue와 빈 cue
- `MISSING` visual
- title search loading/empty/error/result
- save blocked/saving/saved/error
- initial loading/provider unavailable/offline
- cleanup pending/delete confirmation
- Library row와 Memory Card가 동시에 존재하는 작품

fixture는 production 코드의 hidden bypass를 만들지 않는다. 기존 DEV/test seam과 IndexedDB repository의 public contract를 사용한다. fixture builder는 test 경로에 두고 production component가 fixture 이름이나 test mode를 분기하지 않게 한다. 각 fixture는 clock, owner ID, card ID, asset ID, design seed를 고정하고 실제 사용자 note나 catalog raw payload를 포함하지 않는다.

### 14.2 Screenshot 규칙

- Playwright `toHaveScreenshot`을 사용하고 snapshot은 `tests/visual/<screen>.spec.ts-snapshots/` 아래에서 관리한다.
- `animations: "disabled"`, `caret: "hide"`, CSS pixel scale을 사용한다.
- Noto Sans/Noto Sans KR font loading 완료를 기다린다.
- clock, generated ID, random system design seed를 고정한다.
- network catalog 결과는 deterministic fixture를 사용한다.
- Astro dev toolbar가 snapshot에 포함되지 않게 test server 환경을 사용한다.
- full-page와 viewport screenshot을 구분한다.
- baseline 갱신은 의도된 설계 변경과 reviewer 확인 없이 수행하지 않는다.
- visual baseline은 고정된 repository Playwright Chromium과 bundled font 환경에서 생성한다. Firefox/WebKit은 기능·layout smoke 대상으로 사용하되 Chromium baseline과 pixel 비교하지 않는다.
- 기본 `maxDiffPixelRatio`는 `0.001` 이하로 둔다. 이를 넘겨야 하는 화면은 원인을 문서화하고 해당 영역만 최소 범위로 검토하며 전역 threshold를 높이지 않는다.
- 동적 영역 mask는 clock/OS cursor처럼 제품 의미가 없는 값에만 허용한다. Memory image, title, cue, error, loading, privacy 상태는 mask하지 않는다.
- snapshot 변경 commit은 before/after artifact와 변경 의도를 기록하고 reviewer가 image diff를 직접 확인한다.

### 14.2.1 승인 screenshot 18개

상태×viewport×locale×theme의 전체 조합을 snapshot으로 만들지 않는다. 아래 18개를 visual golden으로 고정하고 나머지 조합은 DOM/layout assertion으로 검증한다.

| 화면 | Golden 상태 |
| --- | --- |
| Navigation/search (2) | 320 EN dark compact search, 1440 KO light desktop search result |
| Home (4) | 390 EN dark empty, 1440 KO light empty, 390 KO dark active, 1440 EN dark active |
| Composer (4) | 320 EN dark empty, 390 KO light system design selected, 1440 EN dark title selected, 1440 KO dark save error |
| Archive (3) | 320 KO dark empty, 390 EN dark populated, 1440 KO light populated |
| Detail (3) | 390 EN dark READY, 320 KO dark MISSING, 1440 KO light READY |
| Library/Memory split (2) | 390 EN dark search actions, 1440 KO light added-to-Library status |

새 screen 또는 critical state가 추가될 때만 golden 수를 늘린다. copy 한 줄이나 모든 breakpoint를 각각 snapshot으로 복제하지 않는다.

### 14.3 자동 layout assertion

각 승인 viewport에서 다음을 검사한다.

- document와 body horizontal overflow ≤ 0.5px
- visible text/button clipping 없음
- 모바일 primary·navigation·form touch target ≥ 44×44px
- 나머지 non-inline pointer target은 WCAG 2.2의 24×24px 또는 spacing 예외 충족
- 첫 Home viewport에 primary CTA 전체 노출
- composer 저장 action이 content를 가리지 않음
- Archive card width가 container를 넘지 않음
- title은 두 줄, cue는 두 줄 제한을 넘지 않음
- modal/sheet가 viewport와 safe area 안에 머묾
- 200% browser zoom과 320 CSS px reflow에서 기능 손실이나 양방향 scroll 없음
- font loading 전후 featured visual과 form의 큰 layout shift 없음

### 14.4 접근성 assertion

- 페이지마다 하나의 `main` landmark와 하나의 명확한 `h1`
- heading level이 건너뛰지 않음
- keyboard만으로 navigation, 검색, 작성, 저장, Archive 재열람 가능
- dialog focus trap과 close 뒤 trigger focus 복귀
- 모든 form error가 control과 programmatically 연결됨
- 저장·검색 완료처럼 비긴급 상태는 `role="status"`, 저장 실패처럼 즉시 알려야 하는 오류는 `role="alert"`를 사용
- icon-only action의 accessible name 존재
- focus-visible indicator가 모든 interactive element에 표시
- light/dark theme에서 주요 text와 control contrast 점검
- 일반 text 4.5:1, large text·focus/control boundary 3:1의 WCAG 2.2 AA 기준 충족
- `prefers-reduced-motion`에서 동작 의미가 유지됨

자동 접근성 검사는 semantic·keyboard·contrast 회귀를 찾는 보조 수단이며 사람의 읽기 순서와 시각 위계 검토를 대체하지 않는다.

## 15. 사람 검토 Gate

자동 테스트 뒤 사용자가 다음을 직접 확인한다.

1. 첫 화면에서 설명 없이 10초 안에 Memory Card 작성 진입점을 지목할 수 있다.
2. `Create card`와 `Add to Library`의 결과 차이를 설명할 수 있다.
3. 작품 검색→visual 선택→짧은 기억→저장→Home/Archive→상세 재열람을 중단 없이 완료한다.
4. 320×720, 390×844, 1440×900에서 잘림·겹침·과도한 빈 공간·읽기 어려운 대비가 없다고 승인한다.
5. 한국어와 영어에서 핵심 action의 의미와 위계가 동일하다고 승인한다.
6. 설명 없이 첫 Complete Card를 2분 이내 저장하고 저장 직후 Archive에서 찾는다.
7. 이미지가 필요한 이유와 system design 대안을 설명할 수 있다.
8. `PRIVATE · LOCAL ONLY`를 Public 게시나 cloud backup으로 오해하지 않는다.
9. 상세에서 note 수정, visual 교체, 카드 삭제의 결과 차이를 설명할 수 있다.

이 검토를 통과하지 못하면 Android UI 적용으로 이동하지 않는다.

## 16. 구현 단위와 순서

1. 현재 화면 before capture와 공통 visual token, responsive container, button·surface 규칙, screenshot harness.
2. 공통 navigation/search의 밀도와 모바일 표현.
3. Home empty/active image-first hierarchy.
4. Memory Card composer desktop split/mobile flow/states.
5. 공용 Memory Card preview와 Archive empty/grid.
6. Memory Card detail visual hierarchy와 management action.
7. Library/Memory action distinction visual polish.
8. locale·theme·viewport·state screenshot matrix와 keyboard/accessibility gate.
9. 사람 10초 발견성 및 전체 흐름 검토.
10. 문서 evidence 갱신 후 Android 적용 gate로 이동.

각 구현 단위는 failing behavior/layout test를 먼저 추가하고, 최소 변경으로 통과시킨 뒤 screenshot을 사람이 직접 확인한다.

### 16.1 컴포넌트와 CSS 경계

- Home, Composer, Archive, Detail은 공용 presentational `MemoryCardPreview` contract를 사용하되 저장소·navigation을 component 안에서 직접 호출하지 않는다.
- screen container는 domain object를 display model로 변환하고 presentational component는 그 display model만 렌더링한다.
- 공용 token과 page container는 `global.css`에서 관리할 수 있지만 화면별 selector는 각 feature CSS에 둔다.
- 현재 `global.css`가 6,000줄 이상이므로 신규 Home/Memory screen rule을 계속 뒤에 누적하지 않는다. 구현 계획에서 기존 selector의 최소 이동 범위와 회귀 테스트를 명시한다.
- visual test fixture, screenshot helper, production component를 서로 다른 파일 경계로 둔다.
- DOM 순서는 모바일 읽기·keyboard 순서를 따르고 desktop 2열은 CSS layout만으로 표현한다.

### 16.2 구현 checkpoint

각 화면 단위는 다음 증거가 있어야 다음 화면으로 넘어간다.

```text
기존 화면 before capture
→ 실패하는 behavior/layout test
→ 최소 구현
→ focused functional test
→ 승인 viewport after screenshot
→ keyboard와 locale 확인
→ reviewer image diff 확인
```

한 화면의 시각 실패를 다른 화면의 대규모 CSS 변경으로 우회하지 않는다.

## 17. 데이터, 보안, 권리 영향

- DB schema와 IndexedDB store version을 변경하지 않는다.
- 사용자 이미지 bytes, note, 검색어를 analytics나 일반 log에 추가하지 않는다.
- Web production image upload를 추가하지 않는다.
- catalog 표지를 Memory VisualAsset으로 저장하지 않는다.
- system design example은 deterministic local rendering만 사용한다.
- screenshot fixture에는 실제 사용자 데이터, secret, absolute path, raw catalog payload를 포함하지 않는다.
- Public visibility와 sharing control을 추가하지 않는다.
- 외부 참고 서비스 screenshot, logo, poster를 source 또는 snapshot fixture로 저장하지 않는다.

## 18. Rollback

- domain, repository, native bridge contract를 변경하지 않고 presentational component와 CSS 중심으로 작업한다.
- 화면별 작업은 독립 commit으로 나눠 문제 발생 시 해당 화면만 revert할 수 있게 한다.
- screenshot baseline과 fixture를 같은 commit에 포함해 UI 변경의 의도를 추적한다.
- 새 navigation 행동은 기존 direct route와 URL 계약을 유지한다.
- Android 적용 전까지 기존 native image intake와 app-private storage 경계는 변경하지 않는다.

## 19. 완료 조건

다음이 모두 충족돼야 Web UI Readiness를 완료로 기록한다.

- 승인된 모든 화면과 상태가 이 설계의 위계를 따른다.
- 지정된 18개 golden screenshot이 reviewer에게 승인되고, 추가 viewport는 layout assertion을 통과한다.
- 전체 unit, Chromium E2E, layout, visual, keyboard/accessibility 검사가 실패 없이 완료된다.
- production build와 catalog guard가 통과한다.
- React Doctor changed-scope 점수가 구현 전 기준보다 하락하지 않는다.
- 사람 검토 Gate 아홉 항목이 승인된다.
- `first-private-vertical-slice.md`와 `private-slice-test-evidence.md`가 실제 결과로 갱신된다.
- Production 배포, Android 확장, Board, sync, cloud, Public이 이번 완료 선언에 포함되지 않았음을 확인한다.

## 20. 다음 Gate

이 설계의 Web UI Gate가 닫힌 뒤 같은 공용 UI를 Capacitor Android shell에 적용한다. Android에서는 safe area, software keyboard, back navigation, Photo Picker, Share Target, process death, app-private media와 물리 실기기 가독성을 별도로 검증한다. Android와 첫 slice 잔여 export·orphan scan·rollback rehearsal까지 마감한 뒤에만 Private Board + Web read path로 이동한다.

## 21. 참고 기준

- AniList: <https://anilist.co/>
- Letterboxd product description: <https://letterboxd.com/about/>
- Pinterest Board definition: <https://help.pinterest.com/en/article/create-a-board>
- WCAG 2.2: <https://www.w3.org/TR/wcag/>
- WCAG 2.2 contrast minimum: <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum>
- WCAG 2.2 target size minimum: <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- Playwright visual comparisons: <https://playwright.dev/docs/test-snapshots>
- Playwright page screenshot assertions: <https://playwright.dev/docs/api/class-pageassertions>

외부 참고 링크는 제품 구조와 검증 기준을 이해하기 위한 reference다. MOEMOA의 권리 승인 범위나 외부 asset 재사용 권한을 의미하지 않는다.
