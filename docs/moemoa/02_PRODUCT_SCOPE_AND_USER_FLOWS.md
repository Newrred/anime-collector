# 02. 제품 범위와 사용자 흐름

> **문서 상태:** `CURRENT PRODUCT SPEC`
>
> **최종 갱신:** `2026-09-03 — Title Hub / Poster View / Memory View / Catalog Cover VisualAsset`
>
> `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`의 확정 결정을 사용자 흐름과 상태 모델로 구체화한다. 현재 구현 사실은 repository와 테스트를 확인한다.

## 1. P0 목표

P0의 목표는 공개 SNS를 완성하는 것이 아니라 다음 핵심 루프를 안정적으로 만드는 것이다.

```text
작품 또는 이미지를 출발점으로 선택한다
→ 작품 저장 또는 Memory 작성을 독립적으로 수행한다
→ 내 이미지·공식 표지·시스템 디자인 중 Visual을 선택한다
→ 짧은 개인 기억 신호를 남긴다
→ Complete Memory Card가 Archive에 쌓인다
→ 작품별 Title Hub와 My Titles에서 다시 본다
→ 필요하면 여러 Board로 묶는다
→ 필요할 때 계정과 Web으로 확장한다
```

P0는 한 번에 구현하는 단일 phase가 아니다. local Card/Archive, 공식 표지 reference, Title Hub, My Titles dual view, Board/Web read path, account metadata sync 등이 여러 마일스톤으로 합쳐져 P0를 완성한다.

## 2. P0 포함

### 작품과 PrivateTitle

- 공용 작품 검색
- 검색 실패 시 PrivateTitle 생성
- 공용 작품과 PrivateTitle의 시각적 구분
- 작품 장르 자동 연결
- 공식 대표 표지 표시
- 저장 여부와 Memory 보유 여부의 독립 상태
- 작품 상세 `Title Hub`

### 작품 저장 상태

- 작품 저장·해제
- 시청 상태
- 평점
- 재시청 횟수
- WatchLog
- 기존 local Library data의 비파괴 읽기
- 신규 remote sync 여부는 `TITLE-STATE-SYNC-01` 전까지 미정

### Memory Card

- 한 작품에 여러 카드
- 사용자 이미지 강력 권장
- 승인된 공식 대표 표지를 사용자가 명시적으로 VisualAsset으로 선택 가능
- 시스템 디자인 카드 대체
- 짧은 감상·감정·날짜·장면·재감상 의도
- 스포일러
- Draft/Complete 상태
- 수정·삭제
- 표지 기반 카드에는 개인 기억 신호 최소 하나 필요

### Memory Archive

- 최근 카드
- 작품별 카드
- 날짜별 카드
- 장르·개인 태그 필터
- 같은 작품의 여러 카드
- 카드 상세와 수정
- 표지 기반 Memory와 사용자 이미지 Memory의 source label

### My Titles

- 저장한 작품과 Memory가 있는 작품의 합집합
- `표지 보기 / Poster View`
- `기억 함께 보기 / Memory View`
- `전체`, `저장됨`, `기억 있음`, `보는 중`, `완료` 필터
- 최근 업데이트, 최근 Memory, 제목 정렬
- 작품별 Memory 개수와 저장 상태 표시
- 작품 상세로 진입

### Title Hub

- 공식 표지를 통한 작품 식별
- 작품 저장 여부
- 시청 상태·평점·WatchLog
- 해당 작품의 Memory Card 0..N
- `기억 남기기`와 `작품 저장`의 독립 action
- Memory만 있는 작품, 저장만 있는 작품, 둘 다 있는 작품을 모두 처리

### Board

- Private Board 생성·수정·삭제
- N:M 카드 배치
- 순서 변경
- 카드 3개 이후 제안
- 작품이 아니라 Memory Card를 membership 대상으로 사용

### 계정·동기화

- 비로그인 로컬 사용
- 익명 소유자 ID
- 첫 카드 후 로그인 권장
- 로컬 데이터 계정 승격
- Memory Card와 VisualAsset metadata 동기화 상태 표시
- 공식 표지 기반 Memory는 catalog cover reference metadata 동기화 가능
- Web에서 카드·Archive·Board 확인

### 데이터 소유권

- JSON 내보내기
- 복원
- 카드·이미지·계정 삭제
- 동기화 실패와 로컬 저장 상태 구분
- legacy local Library export와 rollback 근거 유지

### 운영 기반

- 오류 추적
- 최소 분석 이벤트
- 기능 플래그
- 개인정보·약관·신고 경로
- catalog cover 사용 권한 metadata와 kill switch

## 3. P0에서 기반만 준비하고 기본 비활성화

- `PRIVATE_CLOUD` 사용자 이미지 백업
- Public 카드·Board
- 다른 사용자 카드의 원본 참조 저장
- 관리자 UGC 검토 큐
- 신고·차단·이의제기
- 작품 저장 상태·평점·WatchLog remote sync

이 기능들은 스키마와 플래그를 준비할 수 있지만 관련 gate 통과 전 활성화하지 않는다.

## 4. P0 제외

- 댓글, DM, 멘션, 채팅
- 무한 추천 피드
- 팔로워 수 경쟁
- 애니 캡처 무제한 Public
- 타인 팬아트 무허가 Public
- AI 감상 분석
- 광고·구독
- 전체 역사 카탈로그 완성
- iOS 동시 구현
- 스트리밍 앱 화면을 직접 캡처하는 기능
- 작품 저장 시 자동 Memory 생성
- Memory 생성 시 자동 작품 저장
- 기존 local Library data의 자동 삭제·자동 원격 이관

## 5. 핵심 사용자 흐름

### Flow A — Home에서 시작

```text
Home
→ 최근 Memory 또는 작품 상태 확인
→ `기억 남기기` 또는 `작품 검색`
→ 검색/작성/상세로 이동
```

수용 기준:

- Memory가 있는 Home에서는 최근 개인 Memory가 tracker 통계보다 먼저 보인다.
- 작품 상태 요약은 Memory 아래의 보조 section으로 표시한다.
- `기억 남기기`가 핵심 primary action이다.
- 작품 저장은 독립 secondary action이다.

### Flow B — 작품 검색 후 작품만 저장

```text
작품 검색
→ 검색 결과 또는 Title Hub
→ `작품 저장`
→ 저장 상태만 생성
→ 필요하면 시청 상태 설정
→ `내 작품`에서 다시 열람
```

수용 기준:

- Memory Draft 또는 Complete Card를 만들지 않는다.
- 공식 표지는 작품 식별용으로 표시되지만 Memory 수에 포함하지 않는다.
- 저장 완료 후 `기억 남기기`를 제안할 수 있으나 자동 이동·자동 생성하지 않는다.

### Flow C — 작품 검색 후 공식 표지로 Memory 만들기

```text
작품 검색 또는 Title Hub
→ `기억 남기기`
→ Visual source에서 `공식 표지` 선택
→ 대표 표지 preview 확인
→ 개인 기억 신호 최소 하나 입력
→ Complete Private Card 저장
→ Archive와 해당 Title Hub에서 재열람
```

개인 기억 신호 예:

- 짧은 감상
- 감정 태그
- 본 날짜
- 에피소드 또는 장면
- 재감상 의도

수용 기준:

- 표지 노출이나 작품 저장만으로 카드를 만들지 않는다.
- 카드가 `CATALOG_COVER` source임을 표시한다.
- catalog cover bytes를 카드마다 복제하지 않는다.
- 표지 기반 Card는 Memory 수에 포함되고 Board에 추가할 수 있다.

### Flow D — Android Share Target

```text
사용자가 갤러리/다른 앱에서 이미지 공유
→ MOEMOA 선택
→ 임시 Draft 화면
→ 이미지 미리보기와 변경
→ 작품 검색 또는 PrivateTitle
→ 자동 장르 확인
→ 선택적 기억 신호
→ LOCAL_ONLY 저장
→ Archive
→ 로그인/백업 권장
```

수용 기준:

- 공유받은 이미지를 바로 확정 저장하지 않는다.
- 사용자가 작품과 이미지를 검토한다.
- 취소하면 빈 카드가 남지 않는다.
- 네트워크가 없어도 저장 가능하다.
- 중복 탭으로 카드가 중복 생성되지 않는다.
- Memory 생성이 작품 저장 상태를 자동 변경하지 않는다.

### Flow E — Android Photo Picker

```text
앱에서 기억 남기기
→ 내 이미지 선택
→ Photo Picker
→ 승인된 local storage adapter에 내구성 있게 보존
→ 작품 선택
→ 선택적 기억 신호
→ 저장
```

작품이 먼저 선택된 Title Hub에서 진입하면 작품 참조를 유지하고 Photo Picker부터 진행할 수 있다.

### Flow F — Global Composer에서 공식 표지 선택

```text
기억 남기기
→ Visual source에서 `공식 표지` 선택
→ 작품이 아직 없으면 작품 검색 sheet 열기
→ 작품 선택
→ 공식 표지 preview 확정
→ 개인 기억 신호 입력
→ 저장
```

Visual-first 원칙은 `Visual source 선택`이 먼저라는 의미로 유지한다. 공식 표지는 작품이 정해져야 resolve할 수 있으므로 작품 선택을 조건부 prerequisite로 사용한다.

### Flow G — 시스템 디자인 카드

```text
기억 남기기
→ 시스템 디자인 선택
→ 작품 선택 또는 PrivateTitle
→ 제목·장르·패턴·타이포그래피 preview
→ 선택적 기억 신호
→ 카드 저장
```

이미지 중심 제품이지만 사용자 이미지 확보 실패가 기록 실패로 이어지지 않게 한다.

### Flow H — My Titles에서 다시 열람

```text
내 작품
→ Poster View 또는 Memory View 선택
→ 동일한 작품 집합을 다른 밀도로 탐색
→ 작품 선택
→ Title Hub
→ 상태 확인 또는 관련 Memory 열람
```

Poster View:

```text
공식 표지 grid
+ 작품명
+ 저장/시청 상태
+ 기억 N개
```

Memory View:

```text
공식 표지 anchor
+ 개인 Memory preview 2~3개
+ +N
+ 최신 기억 신호
```

수용 기준:

- 두 모드에서 작품 수와 필터 결과가 동일하다.
- 모드 전환은 데이터를 변경하지 않는다.
- 사용자의 마지막 모드를 저장한다.
- Memory만 있는 작품은 `미저장 · 기억 N개`로 표시한다.
- 저장만 있고 Memory가 없으면 `첫 기억 남기기`를 제공한다.

### Flow I — Title Hub

```text
검색 / 내 작품 / Memory 상세 / Board
→ 같은 작품의 Title Hub
→ 작품 식별
→ 저장·시청 상태 확인
→ 관련 Memory Gallery 확인
→ 상태 변경 또는 새 Memory 작성
```

상태별 처리:

| 저장 상태 | Memory | Title Hub |
| --- | ---: | --- |
| 미저장 | 0 | `작품 저장` + `기억 남기기` |
| 저장됨 | 0 | 상태 관리 + 첫 Memory 안내 |
| 미저장 | 1+ | Memory Gallery + `작품 저장` |
| 저장됨 | 1+ | 상태 관리 + Memory Gallery |

### Flow J — 첫 로그인과 로컬 승격

```text
로컬 카드 존재
→ 로그인 권장
→ 인증
→ 로컬 데이터를 계정에 연결할지 확인
→ Memory metadata 동기화
→ 사용자 이미지 백업은 별도 선택
→ Web에서 확인
```

공식 표지 기반 Memory는 catalog reference metadata만 동기화하며 cover bytes를 사용자 upload로 처리하지 않는다.

### Flow K — Board

```text
카드 3개 생성
→ Board 제안
→ 제목 입력
→ Memory Card 선택
→ 순서 지정
→ Private Board 저장
```

작품 대표 표지 자체는 Board membership 대상이 아니다. 대표 표지를 VisualAsset으로 가진 실제 Memory Card만 Board에 추가할 수 있다.

### Flow L — Public 게시 요청

```text
로그인
→ 카드 공개 요청
→ 이미지 유형·권리·출처 확인
→ 정책 동의
→ Quarantine/검토
→ 승인 또는 반려
→ Public URL
```

대표 표지 사용 승인이 있더라도 Private beta에서는 Public UI를 기본 비노출한다. 실제 Public 활성화는 UGC·이미지 gate를 따른다.

## 6. 상태 모델

### MemoryCard

| 상태 | 의미 |
| --- | --- |
| `DRAFT` | 작품, VisualAsset 또는 표지 기반 Card의 개인 기억 신호가 미완성 |
| `COMPLETE_PRIVATE` | 작품 + 유효한 VisualAsset + 필요한 개인 신호, 개인 Archive 저장 가능 |
| `PUBLISH_PENDING` | Public 요청, 검토 중 |
| `PUBLIC` | 공개 승인 |
| `RESTRICTED` | 신고·권리·안전 문제로 노출 제한 |
| `DELETED` | 사용자 삭제 또는 운영 삭제 |

### VisualAsset sourceKind

필수 의미 구분:

- `USER_IMAGE`
- `CATALOG_COVER`
- `SYSTEM_DESIGN`
- 필요 시 기존 상세 imageType 유지

`CATALOG_COVER`는 최소한 다음 reference를 가진다.

```text
catalogAnimeId 또는 internal title id
catalogCoverId
source/permission metadata
```

실제 enum·column 명칭은 현재 schema audit 뒤 결정하되 다음 의미는 반드시 보존한다.

```text
catalog-managed cover bytes
≠ private user card metadata
```

### VisualAsset storage semantics

- 사용자 이미지: `LOCAL_ONLY`, 이후 동의 시 `PRIVATE_CLOUD`
- 시스템 디자인: 재현 가능한 spec
- 공식 표지: catalog-managed/publicly served reference; user-owned private card row와 분리
- Public visibility는 Card/Board gate로 별도 제어

기존 `storageScope` enum이 catalog reference를 표현하지 못하면 `CATALOG_MANAGED` 또는 동등한 명시적 source/storage 분리를 제안하고, schema 변경 전 migration·rollback을 문서화한다.

### VisualAsset rightsBasis 예시

- `USER_ORIGINAL`
- `USER_CREATED_FANART`
- `EXPLICIT_PERMISSION`
- `OPEN_LICENSE`
- `ANIME_SCREENSHOT_PRIVATE_ONLY`
- `THIRD_PARTY_UNKNOWN`
- `SYSTEM_GENERATED`
- `UNKNOWN`

공식 표지 기반 Memory는 `EXPLICIT_PERMISSION` 또는 동등한 확정 코드로 기록한다.

### TitlePresence — 파생 상태

`TitlePresence`는 영구 저장하지 않는 read projection을 기본으로 한다.

```text
titleRef
+ optional UserTitleState
+ MemoryCard count
+ latest Memory previews
= TitleAlbumProjection
```

상태 조합:

- `SAVED_NO_MEMORY`
- `SAVED_WITH_MEMORY`
- `NOT_SAVED_WITH_MEMORY`
- catalog browse 상태인 `NOT_SAVED_NO_MEMORY`는 검색·상세에는 존재하지만 My Titles 전체 집합에는 포함하지 않는다.

### TitleCollectionViewMode

- `POSTER`
- `MEMORY`

Preference는 local-first로 저장하고, 향후 preference sync contract에 포함할 수 있다.

## 7. UX 원칙

- Private가 기본값이다.
- 저장 위치와 공개 상태를 문구로 명확히 표시한다.
- 로그인 유도는 첫 카드 전에 막지 않는다.
- 이미지 권한 거부가 서비스 사용 불가로 이어지지 않는다.
- 사용자가 입력한 메모 원문은 분석 이벤트에 보내지 않는다.
- Board는 첫 카드 작성 성공보다 앞에 나오지 않는다.
- 공개할 수 없는 이유를 이미지 유형과 권리 상태에 따라 설명한다.
- `작품 저장`과 `기억 남기기`는 같은 viewport에서 경쟁하지 않도록 primary/secondary 위계를 구분한다.
- Poster View는 탐색 밀도, Memory View는 개인 기억 재발견을 우선한다.
- 공식 표지는 작품 anchor이고, 개인 Memory preview는 사용자의 기록 본문이다.
- 공식 표지가 작품 anchor와 표지 기반 Memory preview로 중복될 때 개인 이미지·시스템 디자인 preview를 우선한다.
- 작품 상세 상단은 공식 표지로 식별하되 본문 면적은 관련 Memory Gallery가 우세하다.
- 공식 표지 기반 Memory도 단순 작품 저장과 구분되는 source label과 개인 기억 신호를 가진다.

## 8. 주요 분석 이벤트

```text
card_creation_started
visual_source_selected
image_selected
catalog_cover_selected
system_design_selected
anime_selected
private_title_created
save_title_completed
save_title_removed
first_memory_card_saved
second_memory_card_saved
third_memory_card_saved
archive_revisited
title_collection_opened
title_view_mode_changed
title_hub_opened
title_memory_opened
first_board_created
card_added_to_board
login_prompt_shown
sync_enabled
private_image_backup_enabled
publish_requested
publish_approved
publish_rejected
report_submitted
user_blocked
backup_exported
account_deletion_requested
```

이벤트 속성에는 자유 텍스트, 이미지 bytes, 개인 Board 제목을 포함하지 않는다. `title_view_mode_changed`에는 `from`, `to`, `surface` 정도만 허용한다.
