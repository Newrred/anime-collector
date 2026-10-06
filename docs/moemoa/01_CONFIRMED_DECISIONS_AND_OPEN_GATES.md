# 01. 확정 결정과 미정 게이트

> 2026-10-07: `WATCH-RECORD-FLOW-01` — 기존 감상 기록을 이미지 저장과 같은 작품에서 이어 쓰되 공통 진입에서 목적을 구분한다. 아래 결정/기존 interface-rebuild29차와 [실행 보고](reports/2026-10-05-v84-web-application.md#29차--감상-기록과-장면-저장-동선-복원-2026-10-07) 참조. 감상 저장은 Memory 자동 생성/이미지 요구/원격 WatchLog 이관 승인이 아니다. 카탈로그 미연결 제공처 항목은 개인 감상 용도의 legacy identity로 유지하고 verified catalog로 승격하지 않는다.

> 2026-10-05: 사용자 “실 서비스 디자인 적용 작업 진행해줘”로 V8.4의 Web presentation 적용 승인. 아래 `V84-WEB-APPLICATION-01` 참조.

> 2026-10-05: 사용자 “카드별 태그로 진행 (추천)” 승인. `CARD-CLASSIFICATION-01`: Memory별 캐릭터 참조·커스텀 태그를 작품 장르·기존 WatchLog와 분리해 명시 저장한다. 동일 작품의 모든 이미지에 자동 적용하지 않는다. 비공개 metadata이며 공개 snapshot에 자동 포함하지 않는다. 로컬 저장/검증 및 동기화 migration 후보 준비 승인, 운영 DB 적용·배포·Public 활성화는 별도 D06. 원격 지원 전에는 이 기기 보관임을 표시하고 기존 원격 응답으로 로컬 분류를 지우지 않는다. TAG-01의 전체 taxonomy는 이 제한된 카드 분류 승인으로 모두 확정하지 않는다.

> 2026-10-06 마감: 카드 분류의 로컬 저장·실제 Archive 분류·백업 복원, 실제 작품 캐릭터 표시를 검증했다. 원격 migration 후보는 격리 PostgreSQL에서 검증했으며 hosted/운영 적용·새 동기화 flag 활성화는 미실행이다. [22차 결과](reports/2026-10-05-v84-web-application.md#22차-후속--카드별-분류와-기억-상세).

> 2026-10-06 상세 정리 후속: 기존 V84/CARD-CLASSIFICATION 결정 안에서 읽기·명시 수정·관리 탭과 별도 캐릭터 선택창을 적용했다. 이번 unit416/고유 Chromium66/build19 PASS, 실제 catalog 표지/30명 표시 확인. 제품/공개 정책·DB·flags·배포 변경 없음. [23차 결과](reports/2026-10-05-v84-web-application.md#23차-후속--상세-읽기수정관리-분리-2026-10-06).22차/과거 PASS와 구분한다.

> **문서 상태: `CANONICAL PRODUCT DECISIONS`**
> **최종 갱신:** `2026-09-23 — PUBLIC-LAUNCH-V2-01 출시 범위 승인`
> 제품 범위와 gate에 관한 최상위 기준이다. `미정` 표에 등록된 항목과 보고서의 권장안은 사용자 승인 전 확정 결정이 아니다.

## 1. 사용법

- `확정`: Codex가 구현 기준으로 사용한다.
- `작업 기준`: 아직 최종 사업 결정은 아니지만 기존 방향서의 기본값으로 유지한다.
- `게이트 미통과`: 구현 기반은 만들 수 있지만 기능 활성화나 대규모 실행은 금지한다.
- `미정`: Codex가 옵션과 근거를 제안하되 임의로 확정하지 않는다.

## 2. 확정 결정

### PLATFORM-01 — Web + Android

상태: **확정**

- Android는 이미지 수집, Share Target, Photo Picker, 빠른 카드 작성의 주력 클라이언트다.
- Web은 Archive, Board, 공개 페이지, 계정·데이터 관리, 관리자 기능의 공통 기반이다.
- 동일 백엔드, 인증 체계, 내부 ID, 도메인 모델을 사용한다.
- 두 플랫폼을 별개의 제품이나 별도 카탈로그로 만들지 않는다.
- 완료된 저장소 감사 증거와 사용자 승인으로 Capacitor client 방향을 선택했다. 구체 버전·plugin·bridge·빌드 구조는 Phase 2 ADR/ExecPlan에서 확정한다.

### TECH-01 — Astro/React + Capacitor Android shell

상태: **확정 — 2026-08-11**

- 기존 Astro/React UI와 JS/TS domain contract를 공통 기반으로 재사용한다.
- Android는 Capacitor shell을 사용한다.
- Share Intent, Photo Picker, app-private filesystem, App Link는 native bridge/plugin 경계로 격리한다.
- Capacitor/plugin 버전, Android 최소 버전, bridge API, release 구조는 Phase 2 ADR/ExecPlan에서 구체화한다.
- dependency 설치와 scaffold 전에 공유→복사→process death→복구 spike를 계획한다.
- 상세 결정 기록: `decisions/2026-08-11-foundation-decisions.md`
- 기술 경계: `adr/0001-capacitor-client-and-local-media-boundary.md`
- 2026-08-16 실행 순서 보완: 이미 구축한 Android native/local 기반은 유지하되, 공용 Memory UI는 Web 모바일·데스크톱에서 먼저 사용성 gate를 통과한 뒤 Android에 적용한다. 이는 Web production의 LOCAL_ONLY 이미지 저장이나 Web 전체 선출시를 승인하지 않는다.
- UI 순서 결정: `decisions/2026-08-16-web-first-shared-ui-readiness.md`
- UI 설계 기준: `../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`

### CARD-01 — 이미지 우선 Memory Card

상태: **확정 / 2026-09-03 보완 확정**

완료 조건:

```text
Anime 또는 PrivateTitle
+ VisualAsset 1개
= Complete Memory Card
```

지원하는 Visual source:

- 사용자 기기 이미지 또는 사용자가 가져온 이미지 — **강력 권장**
- 사용자가 명시적으로 선택한 승인된 작품 대표 표지
- 시스템 디자인 또는 텍스트 중심 디자인

추가 규칙:

- 작품 제목만 있으면 Draft다.
- 작품 장르 태그는 카탈로그에서 자동 연결한다.
- 감상, 감정, 날짜, 에피소드·장면, 재감상 의도는 기본적으로 선택 항목이다.
- 단, 작품 대표 표지를 VisualAsset으로 사용하는 경우에는 `감상·감정·날짜·에피소드·장면·재감상 의도` 중 최소 하나를 개인 기억 신호로 입력해야 Complete가 된다.
- 사용자 메모는 긴 리뷰가 아니라 짧은 기억 신호를 우선한다.
- 작품을 저장하는 행동은 Memory Card를 자동 생성하지 않는다.
- Memory Card를 생성하는 행동은 작품 저장 상태를 자동 생성하지 않는다.
### BOARD-01 — Private Board P0

상태: **확정**

- Archive는 모든 완성 카드를 자동으로 포함한다.
- Board는 사용자가 선택해서 만든다.
- 카드가 3개 이상일 때 Board 생성 제안을 노출한다.
- 하나의 카드가 여러 Board에 들어갈 수 있다.
- Board에서 카드를 제거해도 원본 카드가 삭제되지 않는다.
- 공개 불가능 카드가 포함된 Board는 Public 전환할 수 없다.

### IMAGE-01 — 이미지 유형 전체를 데이터 모델에서 구분

상태: **확정 / 2026-09-03 보완 확정**

지원 대상:

- 사용자 기기 이미지
- 승인된 작품 대표 표지 reference
- 시스템 디자인 카드
- 텍스트 중심 디자인 카드
- 애니 장면 캡처
- 사용자 원본 사진·그림
- 사용자가 직접 만든 팬아트
- 타인 팬아트
- 라이선스 이미지

각 이미지에는 최소한 다음을 기록한다.

```text
imageType
sourceKind
storageScope 또는 동등한 저장 출처 구분
visibility 또는 동등한 사용자 기록 공개 상태
rightsBasis
creator/source
license/permission
moderationStatus
spoiler/content rating
```

작품 대표 표지는 `imageType = CATALOG_COVER`, `rightsBasis = EXPLICIT_PERMISSION` 또는 동등한 명시적 값으로 구분한다. 사용자 소유 카드의 privacy와 카탈로그 원본 파일의 접근 범위는 별개 속성으로 취급한다.
### IMAGE-02 — 유형별 Public 제어

상태: **정책 확정 / 활성화 게이트 별도**

- Android 외부 공유는 P0 범위다.
- MOEMOA 서비스 내 Public은 유형별 기능 플래그로 제어한다.
- 시스템 디자인, 사용자 원본, 명시적 허가·라이선스 이미지를 우선 후보로 둔다.
- 일반 UGC 운영 게이트와 이미지 유형별 권리 게이트를 분리한다.

### STORAGE-LOCAL-01 — app-private filesystem + DB metadata

상태: **확정 — 2026-08-11**

- Android가 받은 이미지 원본은 app-private filesystem의 승인된 경로에 복사해 장기 보존한다.
- DB에는 ownerId, localRef, checksum, MIME, byte size, dimensions, lifecycle state 등 VisualAsset metadata를 둔다.
- source URI를 Complete Card의 canonical 장기 원본으로 사용하지 않는다.
- 파일 복사와 DB commit의 실패 보상, orphan 탐지, export/delete 일관성을 검증한다.
- `LOCAL_ONLY` 저장은 cloud backup이나 Public 게시 동의를 의미하지 않는다.
- 상세 결정 기록: `decisions/2026-08-11-foundation-decisions.md`
- 기술 경계: `adr/0001-capacitor-client-and-local-media-boundary.md`

### ACCOUNT-01 — 로컬 우선 + 선택 로그인

상태: **확정**

- 로그인 없이 Private 카드, Archive, Board를 사용할 수 있다.
- 첫 카드 저장 후 로그인을 권장한다.
- 로그인은 백업, Web 동기화, 다기기, Public 기능에 필요하다.
- 로그인 시 기존 로컬 데이터를 계정에 안전하게 승격한다.
- 카드 메타데이터 동기화와 이미지 클라우드 백업 동의를 분리한다.

### BACKEND-01 — 단일 Supabase project + 역할 분리 client/RPC

상태: **확정 — 2026-08-26**

- 현재 catalog Supabase project를 Auth와 신규 사용자 metadata까지 담당하는 단일 project로 확장한다.
- Catalog read-only client와 Auth/user session client는 같은 project를 가리키되 runtime 역할과 설정을 분리한다.
- Catalog는 기존 anon read-only RLS/RPC를 유지한다.
- Private user row는 owner RLS로 읽고 mutation은 version·operation·상태 전이를 검증하는 RPC로 제한한다.
- 초기에는 별도 standalone backend를 두지 않으며 privileged 관리 작업은 service-role 전용 로컬/운영 도구로 격리한다.
- 상세 설계: `../superpowers/specs/2026-08-26-unified-supabase-user-data-design.md`

### AUTH-01 — Supabase Google Auth + local Guest 명시적 승격

상태: **확정 — 2026-08-26**

- 첫 account provider는 기존 Supabase Auth + Google OAuth 하나만 사용한다.
- Remote private row owner는 `auth.users.id`이며 별도 remote Workspace/Guest row를 만들지 않는다.
- 로그인 전 Guest Owner와 entity는 local-only로 유지한다.
- 로그인 시 local bundle preview/backup 가능 상태에서 idempotent promotion operation을 실행하고 성공 뒤 account namespace로 전환한다.
- Entity UUID를 유지하고 account 간 자동 병합을 금지한다.
- Legacy Supabase Auth 사용자가 0명이므로 account/UUID/session migration을 하지 않는다.

### SYNC-01 — normalized entity sync + explicit conflict

상태: **확정 — 2026-08-26 / 2026-09-03 보완**

- Whole JSON snapshot 대신 Memory Card, VisualAsset metadata, Board, preference를 entity row로 동기화한다.
- 각 entity는 optimistic `version`, server timestamp, tombstone을 가진다.
- 같은 entity의 base version이 다르면 timestamp로 자동 덮어쓰지 않고 사용자 conflict resolution으로 보낸다.
- Delete tombstone은 stale update보다 우선하며 30일 보존한다.
- Operation ID와 request hash로 retry를 idempotent하게 만들고 server-generated `sync_seq`로 변경분을 pull한다.
- 사용자 이미지 file은 sync하지 않는다. `LOCAL_ONLY` metadata와 system-design spec만 Phase 1 대상이다.
- 작품 대표 표지 기반 Memory는 이미지 bytes를 사용자 데이터로 복제하지 않고 `catalogCoverId` 또는 동등한 안정적 reference metadata만 동기화할 수 있다.
- 작품 저장 상태, 평점, WatchLog의 신규 remote sync는 `TITLE-STATE-SYNC-01`이 결정되기 전 자동으로 범위에 추가하지 않는다.
### CATALOG-01 — 제한된 자체 카탈로그

상태: **확정**

- 다가오는 분기와 최근 2~3년 주요 작품부터 구축한다.
- 없는 작품은 PrivateTitle로 즉시 생성한다.
- 반복 요청되는 PrivateTitle은 공용 승격 후보가 된다.
- 기존 혼합 출처 데이터는 `legacy_unverified`로 격리한다.
- 초기 범위가 제품 출시를 막지 않도록 한다.

### CATALOG-02 — 필요한 사실 필드의 자체 정규화

상태: **확정**

수집·정규화 대상:

- 제목 계열
- 방영·형식·화수·상태
- 제작사와 역할
- 공식 사이트
- 원작 유형
- 작품 관계
- 장르·태그 후보
- 캐릭터와 성우 관계

MOEMOA는 자체 내부 ID, 관계 타입, 중복 판별, 검증 상태를 운영한다.

### CATALOG-PROD-01 — 승인된 카탈로그와 대표 표지의 Production 및 VisualAsset 사용

상태: **확정 — 2026-08-19 / 사용 범위 확대 확정 — 2026-09-03**

- 사용자는 2026-09-03 작품별 대표 표지를 MOEMOA에서 자유롭게 사용할 수 있는 승인을 받았다고 확인했다.
- 허가 증빙 원문은 사용자가 보관하며 저장소에는 승인 범위와 확인 시점, 출처 식별 정보만 기록한다.
- 대표 표지는 Production의 검색, 작품 목록, 작품 상세, 작품별 기억 묶음에서 표시할 수 있다.
- 사용자가 명시적으로 선택하면 대표 표지를 Memory Card의 `VisualAsset`으로 사용할 수 있다.
- 작품 저장 또는 검색 결과 노출만으로 표지 기반 Memory Card를 자동 생성하지 않는다.
- 카드마다 대표 표지 bytes를 복제하지 않고 `catalogCoverId` 또는 동등한 immutable reference로 재사용하는 것을 기본으로 한다.
- 표지 기반 Memory Visual은 `CATALOG_COVER`와 `EXPLICIT_PERMISSION`을 기록하고, 카드의 개인 감상·날짜·Board membership과 카탈로그 원본 자산을 분리한다.
- 대표 표지 기반 Memory Card는 Complete가 되기 위해 개인 기억 신호를 최소 하나 가져야 한다.
- 대표 표지를 VisualAsset으로 사용할 수 있다는 결정은 애니 장면 캡처, 팬아트, 사용자 이미지, 다른 추가 이미지의 사용 권한을 자동 확대하지 않는다.
- Public Card/Board 활성화는 대표 표지 사용 승인과 별개로 `UGC-GATE-01`, `IMAGE-PUBLIC-01`을 따른다.
- 공급자 조건이나 허가가 변경되면 새 표지 선택을 끌 수 있는 기능 플래그와 기존 reference의 `MISSING/REPLACE` 복구 경로를 유지한다.

### ANILIFE-PROD-01 — 별도 출처 승인을 전제로 한 Production 게시

상태: **무제한 사용·재배포 허가 사용자 확인 / 내부 필드 검토 대기 — 2026-09-03**

- 사용자는 AniLife 데이터의 Production 게시를 별도 승인을 받은 뒤 진행하는 절차에 동의했다. 이 결정 자체를 AniLife 권리자의 승인으로 간주하지 않는다.
- 사용자는 2026-09-03 14:07 KST에 AniLife 재배포 허가를 받았다고 확인했고, 이어 작품 정보와 표지, 영구 저장, 상업적 Production 표시, 재배포, 리사이즈·가공을 포함해 제한이 없다고 확인했다. 증빙 원문은 사용자가 보관하며 저장소에는 이 진술과 확인 시각만 기록한다.
- Production 승인 기록에는 승인 주체, 대상 origin, 허용 필드, 저장·가공·표시·재배포·상업 이용 범위, 승인 시각, 만료·철회 조건, 증빙 위치 또는 해시, 내부 확인자를 포함한다.
- 권리 범위는 AniLife 작품 정보와 표지를 포함한다. 각 값과 이미지는 작품 식별·스키마·이미지 안전성·품질 검토를 통과한 뒤 Production 후보가 된다.
- 도메인이 바뀌어도 같은 승인 주체의 AniLife 출처임을 확인하기 전에는 새 origin에 권리 승인을 적용하지 않는다.
- 기존 `CATALOG-PROD-01`의 대표 표지 사용 결정은 승인된 대표 표지를 사용할 수 있다는 제품 결정이며, AniLife가 그 승인 출처라는 뜻은 아니다.
- 외부 권리 게이트는 사용자 확인으로 충족됐다. 현재 `FIELD_REVIEW_REQUIRED` claim과 표지는 내부 데이터·이미지 검토를 통과한 뒤 Production 게시 상태로 바꾼다.
- 철회·만료 시 신규 게시를 중지하고 해당 출처 필드·asset을 대체 또는 비노출할 수 있어야 하며, 감사 metadata는 보존한다.

### IA-01 — 작품 허브형 Library·Memory 통합

상태: **확정 — 2026-09-03**

- Library와 Memory Card의 write model은 독립적으로 유지한다.
- 사용자 경험은 공통 `Title Hub`에서 통합한다.
- 작품 상세는 작품 식별, 저장 여부, 시청 상태·평점·WatchLog, 관련 Memory Card 0..N을 함께 보여준다.
- 작품 목록과 Memory 상세, 검색 결과, Board의 Memory 상세에서 같은 Title Hub로 이동할 수 있어야 한다.
- 작품을 저장하지 않았어도 Memory Card가 있으면 Title Hub에서 해당 작품과 Memory를 열람할 수 있다.
- 작품 저장을 해제해도 Memory Card와 Board membership은 유지한다.
- Memory Card를 삭제해도 작품 저장 상태와 WatchLog는 유지한다.

### TITLE-COLLECTION-01 — `내 작품`의 포함 집합

상태: **확정 — 2026-09-03**

`내 작품 / My Titles`의 전체 목록은 다음 합집합으로 계산한다.

```text
명시적으로 저장한 작품
UNION
Complete Memory Card가 하나 이상 연결된 작품 또는 PrivateTitle
```

- `저장됨`, `미저장`, `기억 N개`는 서로 독립된 상태로 표시한다.
- Memory만 있는 작품을 Library에 저장된 것으로 표시하지 않는다.
- 저장만 있고 Memory가 없는 작품도 목록에 표시하고 첫 Memory 진입점을 제공한다.
- PrivateTitle은 가짜 공식 표지를 만들지 않고 별도의 PrivateTitle placeholder 또는 시스템 타일로 구분한다.
- 이 집합은 기본적으로 파생 projection이며, 별도의 중복 영구 entity로 저장하지 않는다.

### TITLE-VIEW-01 — `표지 보기`와 `기억 함께 보기`

상태: **확정 — 2026-09-03**

`내 작품 / My Titles`는 동일한 작품 집합, 필터, 정렬을 다음 두 표현으로 제공한다.

1. `표지 보기 / Poster View`
   - 승인된 공식 표지 중심의 고밀도 grid
   - 작품명, 저장·시청 상태, 평점 선택 표시, Memory 수를 압축 표시
   - 개인 Memory preview는 표시하지 않는다.
2. `기억 함께 보기 / Memory View`
   - 공식 표지를 작품 앨범의 anchor로 사용
   - 사용자 이미지·장면 이미지·시스템 디자인 등 관련 Memory preview 2~3개, `+N`, 최신 기억 신호를 함께 표시
   - 표지 기반 Memory는 Memory 수에는 포함하되, 같은 공식 표지가 anchor와 반복되지 않도록 다른 Memory가 있으면 preview 우선순위를 낮춘다.

추가 규칙:

- 보기 전환은 데이터를 생성·삭제·수정하지 않는다.
- 필터, 정렬, scroll/focus 문맥을 가능한 범위에서 유지한다.
- 사용자가 선택한 마지막 모드를 preference로 저장한다.
- 선택 기록이 없고 Memory가 하나 이상이면 Memory View, Memory가 없으면 Poster View를 기본값으로 한다.
- 첫 Memory 저장 직후 모드를 강제로 바꾸지 않고 Memory View 안내와 명시적 전환 action만 제공한다.

### LIBRARY-INTEGRATION-01 — 기존 Library 유지·축소·통합

상태: **확정 — 2026-09-03**

- 최종 선택은 `통합`이며 실행 방식은 `기능 축소형 통합`이다.
- 작품 저장 여부, 시청 상태, 평점, 재시청 횟수, WatchLog, 기존 local Library 데이터는 유지한다.
- 사용자-facing 독립 `Library` 메뉴와 `Library Card` 명칭은 제거하고 `작품 / Titles`, 작품 항목, Title Hub로 재구성한다.
- 기존 AniList ID 중심 local Library는 adapter 뒤에서 읽고, 신규 canonical TitleRef와 분리한다.
- 실제 운영 legacy 사용자가 0명이므로 legacy remote schema를 만들지 않는다.
- 개발 기기의 local Library 데이터는 export·rollback 근거 없이 destructive 삭제하거나 자동 변환하지 않는다.
- 기존 `/library/` direct route와 query는 전환 기간에 alias 또는 safe redirect로 유지한다.
- WatchLog와 긴 legacy memo는 Memory Card로 자동 변환하지 않는다.

### NAMING-01 — 사용자-facing 명칭

상태: **확정 — 2026-09-03**

| 역할 | 한국어 | 영어 |
| --- | --- | --- |
| 전체 개인 Memory | 기억 | Memories |
| 화면 제목 | 기억 아카이브 | Memory Archive |
| 작품 인덱스 | 작품 | Titles |
| 화면 제목 | 내 작품 | My Titles |
| Memory 생성 행동 | 기억 남기기 | Add Memory |
| 작품 저장 행동 | 작품 저장 | Save Title |
| 작품별 통합 상세 | 작품 상세 | Title Hub |
| 보기 모드 1 | 표지 보기 | Poster View |
| 보기 모드 2 | 기억 함께 보기 | Memory View |

`Library`, `Add to Library`, `Library Card`는 legacy·내부 호환 문맥 외에는 신규 사용자 copy로 사용하지 않는다.

### LEGACY-01 — Production legacy migration 없음

상태: **확정 — 2026-08-11 / 수정 확정 — 2026-08-26**

- 2026-08-11 보수적 보존안은 실제 사용자 legacy 데이터가 있을 가능성을 전제로 했다.
- 사용자는 2026-08-26 legacy Supabase 실제 사용자가 0명이었고 기존 구조 호환이 필요 없다고 확인했다.
- 신규 remote schema에 legacy Library/WatchLog/Tier/snapshot table을 만들지 않는다.
- Legacy Auth user, UUID, session, cloud row를 export/import하지 않는다.
- Legacy record를 신규 Card/Board로 자동 변환하지 않는다.
- 이 변경은 현재 작업 트리나 개발자 기기의 local data를 즉시 destructive 삭제하는 승인이 아니다.
- 상세 변경 기록: `decisions/2026-08-26-unified-supabase-user-data.md`

## 3. 작업 기준으로 유지할 항목

### PRODUCT-01 — 제품 포지셔닝

- 일반 애니 트래커를 대체하는 것이 아니라 이미지 중심 개인 기억 아카이브다.
- 작품 DB보다 Memory Card, Archive, Board가 우선이다.
- 단, `작품 / Titles`의 Poster View에서는 공식 표지를 작품 탐색의 중심으로 사용할 수 있다.
- Home, Memories, Board와 Title Hub의 Memory 본문에서는 사용자 개인 이미지와 기억 신호가 제품의 주 콘텐츠다.
- 공식 표지를 VisualAsset으로 사용할 수 있어도 작품 저장과 Memory 작성의 의미를 합치지 않는다.
### MARKET-01 — 초기 시장

- 영어 우선.
- 필리핀은 사용자 확보·메시지 검증.
- 싱가포르는 품질·지불 의향 교차 검증.
- 실제 집행 전 재확인한다.

### MONETIZATION-01 — 초기 무료·무광고

- 핵심 기록, Archive, 기본 Board, 내보내기·삭제는 무료 유지.
- 반복 사용 검증 전 제품 내 광고·구독을 핵심 개발 범위로 넣지 않는다.

## 4. 게이트 미통과 항목

### UGC-GATE-01 — 일반 공개 UGC 운영 게이트

상태: **미통과**

통과 조건:

- 최신 약관과 업로드 정책 동의
- 금지 콘텐츠 정의
- 게시 권한 확인
- 인앱 콘텐츠 신고
- 인앱 사용자 신고·차단
- 운영자 검토 큐
- 노출 제한·삭제
- 업로더 통지
- 이의제기·복구
- 반복 침해자 경고·정지
- 원본·파생본·CDN 삭제 전파
- 감사 로그
- 전역 Public·이미지 kill switch
- 담당자·SLA
- E2E 테스트

Codex는 기반을 구현할 수 있지만 이 게이트가 통과되지 않으면 Public 기능 기본값을 켜면 안 된다.

### SCREENSHOT-PUBLIC-GATE-01 — 애니 장면 캡처 Public

상태: **비활성화**

일반 UGC 시스템과 별도로 다음이 필요하다.

- 대상 국가 기준 법률·정책 검토
- 허용·금지 범위 명문화
- 권리자 요청 즉시 차단
- 광고·프로모션에서 사용 금지 여부 구분
- 운영 부담 승인

### THIRD-PARTY-FANART-GATE-01 — 타인 팬아트 재업로드

상태: **비활성화**

- 작가의 명시적 허가 또는 라이선스 증빙
- 원작 IP의 2차 창작 정책 검토
- 작가·원문 URL·허가 상태 기록
- 허가 철회 처리

### FULL-CATALOG-INGESTION-GATE-01

상태: **미통과**

다음 전에는 전체 대상 수집을 실행하지 않는다.

- Source Registry 승인
- raw staging과 provenance
- 대표 표본의 정규화·중복·충돌 검증
- 멱등성·재실행·롤백 테스트
- 요청 제한과 오류 복구
- 데이터 품질 대시보드

### REPRESENTATIVE-100-INGESTION-01

상태: **승인 (2026-08-18)**

- 기존 3,998개 목록에서 골든 10개를 포함한 결정적 표본 100개를 사용한다.
- 먼저 네트워크 없이 `sample100` target manifest를 생성·검증한 뒤 AniList + Wikidata 수집을 실행한다.
- AniLife는 public origin 복구와 수동 exact binding 전에는 100개 실행 출처에 포함하지 않는다.
- 원본·표지·canonical·보고서는 `D:\hong\Web\Anime\MOEMOA_CATALOG_LAB_TEST`의 TEST_ONLY workspace에만 저장한다.
- 100개 실행 승인은 3,998개 전체 수집, Git/Vercel/APK 포함, production 게시를 승인하지 않는다.

### SAMPLE100-SEMANTIC-HARDENING-01

상태: **승인·구현 (2026-08-18)**

- canonical 원본 증거는 유지하고 검색·표시용 `ServiceProjection`을 별도로 파생한다.
- 기존 목록의 유일한 한국어 `ko` 제목을 대표 제목으로 유지한다. 외부 한국어 후보는 높은 문자열 유사도면 검색 별칭으로 자동 허용하고, 낮은 신뢰도면 증거만 보존한 채 조용히 격리한다.
- 불완전한 legacy 제목은 강한 형태 이상 또는 명시된 known anomaly일 때 비한국어 제목으로 자동 fallback한다.
- 공식 링크는 복수 후보를 보존하고 HTTPS·작품명 도메인·비스트리밍·작품 전용 경로 우선순위로 대표 링크를 자동 파생한다.
- 낮은 신뢰도 후보·자동 링크 선택·fallback은 warning 통계이며 수동 검토 큐에 올리지 않는다. 수동 검토는 작품 식별 충돌, 필수 필드 생성 실패, 구조·무결성 오류로 제한한다.
- 서비스 완성도는 REQUIRED/RECOMMENDED/OPTIONAL로 나누며 선택 항목 누락만으로 게시 차단하지 않는다.
- `catalog:rebuild`는 저장된 SourceRecord와 CoverRecord만 사용하고 네트워크를 호출하지 않는다.
- 이 구현도 TEST_ONLY이며 3,998개 전체 수집 또는 production 승격을 승인하지 않는다.

### FULL3998-BATCH-CODE-01

상태: **코드 구현 승인 / 실제 전체 실행 미포함 (2026-08-18)**

- 검증된 `sample100` 파이프라인을 유지하며 기존 3,998개 목록을 최대 100개씩 순차 처리하는 `full3998` 코드 경로를 추가한다.
- source-target checkpoint를 재사용하고 batch 직후 aggregate progress를 저장한다. 완전히 재개된 batch는 추가 휴식을 생략하고 `SOURCE_PAUSED`가 나오면 다음 batch를 실행하지 않는다.
- AniList 요청 시작 간격은 매번 2.5~10초 범위에서 새로 선택하고, response rate-limit header나 `Retry-After`가 요구하는 더 느린 제한을 우선한다. 실제 작업이 있었던 batch 사이 휴식도 매번 120~200초 범위에서 새로 선택한다.
- 사용자는 2026-08-17 약 20:00 KST에 AniList로부터 로컬 테스트 저장 허가를 받았다고 진술했다. 증빙 원문은 사용자 보관이며 저장소에는 최소 permission metadata만 기록한다.
- 이 허가는 로컬 TEST_ONLY 저장에만 적용한다. production 승격, Git/Vercel/APK 포함, 재배포, 상업 이용 권한으로 확대하지 않는다.
- 2026-08-18 작업은 코드와 mock 검증까지만 승인하며 실제 3,998개 네트워크 실행은 포함하지 않는다. 따라서 `FULL-CATALOG-INGESTION-GATE-01` 상태는 이번 코드 구현만으로 자동 통과하지 않는다.
- ExecPlan: `plans/2026-08-18-full3998-batched-local-ingestion.md`

### ANILIST-PROD-01

상태: **승인·구현·증분 보강 실행 완료 (2026-09-03)**

- 사용자는 AniList 자료의 Production 저장·표시·배포 승인을 받았다고 2026-09-03 재확인했다. 증빙 원문은 사용자가 보관하고 저장소에는 최소 permission metadata만 기록한다.
- AniList 필드와 표지는 `PERMISSIONED` 권리 상태로 저장하되, 작품 identity와 field review를 통과한 값만 Production 후보가 된다.
- `increment-2026-09` 226건은 MOEMOA ID와 `ANILIFE:<id>` target key를 유지한다. AniList ID는 제목·연도·형식·고유 표지 근거로 정확히 연결된 작품에만 선택적으로 추가한다.
- 기존 AniLife의 단일값·표지는 덮어쓰지 않고 AniList는 빈 단일 필드와 추가 가능한 collection 필드를 보강한다. 중복 ID, 기존 3,998건과의 중복, 근거 부족은 자동 반영하지 않는다.
- 실제 운영 DB upload·release 활성화·Web/Android 배포는 이 수집 실행과 별도다.
- 세부 결정: `decisions/2026-09-03-anilist-production-permission.md`
- ExecPlan: `plans/2026-09-03-anilist-increment-enrichment.md`

### SOURCE-INDEPENDENT-CATALOG-01 (2026-09-07 승인)

AniList ID는 선택적 내부 확인 정보이며 사용자용 외부 이동을 제공하지 않는다. MOEMOA UUID만으로 검색·상세·저장·Memory 연결을 지원한다. 승인된 AniLife 표지를 지원하되 개별 데이터 검증은 유지한다. [결정](decisions/2026-09-07-source-independent-catalog.md), [구현 결과](reports/2026-09-07-source-independent-catalog.md).

## Decision Log — AGE12-ADULT-AREA-01 (2026-09-26)

> 2026-09-27 `GENERAL-PUBLIC-POSTMODERATION-01`이 이 결정의 **첫 출시 성인 영역 포함·성인 인증 요구**를 대체한다. 아래는 당시 승인 이력이다. 12세 이용 목표·보호자 동의 잔여·국가·일정 미정은 유지한다.

- status: CONFIRMED_PRODUCT_SCOPE / IMPLEMENTATION_AND_POLICY_PENDING.
- approved by: 사용자 “12세·성인 영역까지 포함하고 출시 일정 조정”. 첫 Web-only 후보는 만12세부터의 이용 및 성인 전용 영역을 포함하도록 목표를 변경한다. 9/27 출시 기한보다 필요한 준비·검증을 우선하며 새 출시일은 미확정이다. Android 후속 원칙 유지.
- moderation intent: 사용자는 폭넓은 이미지 허용과 신고·운영자 주기 검토/차단을 원한다. 이는 불법 콘텐츠 허용, 캡처·타인 팬아트 권리 gate 자동 통과, 미분류 이미지 즉시 공개의 승인이 아니다. 구체 허용표와 검토 전 노출 기준은 D04 미완료다.
- launch requirements: 12~13세 법정대리인 동의·확인·철회, 서버가 검증한 성인 자격, 국가별 나이 기준, 분류/재분류와 신고·차단·이의, 썸네일/원본 파생본/미니홈/공유/캐시를 포함한 접근통제가 필요하다. 자기신고 체크박스만으로 성인 인증을 완료 처리하지 않는다. 한국의 청소년 보호 기준을 단순 만18세로 고정하지 않는다.
- unresolved: 국가별 적용 범위, 인증 공급자 및 개인 운영자 가입 가능 여부/비용, 개인정보 최소수집·보존, 허용 콘텐츠와 사전/사후 검토 경계. 유료 계약·신분증 수집·운영 migration/Public 활성화는 승인하지 않았다.
- execution: 기존 W06/W08/W14/W15/W19/W20 및 D03/D04/D06에 흡수. 새 계획 트리/진행판 없음. 기존 PASS는 해당 당시 일반 공개 계약의 증거로 보존하며 새 연령 경계의 PASS로 재사용하지 않는다.
- references checked: [개인정보위 아동 개인정보 동의 안내](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=10496), [청소년 보호법 시행령 제17조](https://law.go.kr/LSW/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=121025). 개별 서비스의 법률 검토 완료를 뜻하지 않는다.

## 지역 범위 보완 (2026-09-26, D04)

- **최신 확정 — RELEASE-REGIONS-01:** 사용자가 추천을 확인하고 “국가는 그렇게 확정하자” 승인. 첫 Web-only 출시 대상 국가는 **한국(KR)·필리핀(PH)·태국(TH)**으로 확정한다. 아래 우선 검토 대상 표기는 승인 전 조사 이력이다. 국가별 연령/보호자 동의·성인 인증·콘텐츠 제공 범위·언어 대응 검토는 계속 필요하며 국가 확정만으로 Public 또는 성인 콘텐츠 운영을 활성화하지 않는다. 별도 국가별 백엔드를 만드는 결정은 아니다.

지역 범위 보완 (2026-09-26, D04): 사용자는 “한국 + 동남아 중 서브컬쳐가 좀 인기가 있어지고 있는 국가들 한두곳 추가”를 요청했다. 한국+동남아1~2개국 방향은 확정이며, 조사 기반 우선 검토 대상은 필리핀, 다음 태국이다. 특정 두 국가를 사용자가 직접 지명한 것으로 기록하지 않는다. 필리핀은 애니 관심·행사 확대와 영어 공용어 기반을 [JETRO 2026-06-25](https://www.jetro.go.jp/biz/areareports/2026/9b27c0d3855a9da9.html)에서 확인했다. 태국은 애니메이션·게임·캐릭터/IP 교류 기반을 [AJC TCM 2026 안내](https://www.asean.or.jp/event-info/20260701/)에서 확인했으며 소비자 성장률 순위의 근거로 확대하지 않는다. 필리핀 우선순위는 언어 대응 부담을 고려한 권고다. 국가별 보호자 동의·성인 인증·허용 콘텐츠와 태국어 지원은 D04 잔여이며 이 선정은 해당 국가의 성인 콘텐츠 제공 허용 또는 운영 활성화 판정이 아니다.

## Decision Log — TEST-ON-DEMAND-01 (2026-09-26)



- status: CONFIRMED_OPERATING_DIRECTION. 사용자 “테스트는 쓸 때만 켜기” 선택.
- direction: 기존 조직 구성에서 운영 Pro 견적을 준비하고 테스트 프로젝트는 검증 시에만 가동하는 비용 절감 방향. 실제 일시중지·요금제 변경·결제는 아직 실행하지 않았다. D03 최종 비용 및 D06 적용 범위 유지.
- backup: 사용자 Google 계열 저장소5TB 보유 진술. Google Drive/Google One인지 Cloud Storage인지 미확인으로 D05에 보관한다. 백업 업로드·키 보관 장소 확정으로 간주하지 않는다.



## Decision Log — ADULT-CONTENT-SCOPE-01 (2026-09-26 사용자 확정)

> 2026-09-27 `GENERAL-PUBLIC-POSTMODERATION-01`에 따라 첫 출시에서는 보류한다. 아래 범위는 향후 재검토 자료이며 현재 공개 허용이 아니다.

- 사용자 선택: **“비노골적인 성인 취향 일러스트부터”**. 첫 Web-only 성인 영역의 콘텐츠 목표 범위를 이 선택으로 좁힌다. 노골적인 성행위 묘사 또는 누드까지 허용한 것으로 확대하지 않는다. 이전 “일단 전부 허용” 의향보다 이 구체 결정이 우선한다.
- 성인 영역은 검증된 성인 자격과 국가별 제공 조건을 충족한 이용자에게만 제공하는 목표를 유지한다. 단순 나이 체크·로그인만으로 자격을 인정하지 않는다. 한국·필리핀·태국 대상과 12세부터의 일반 이용 목표도 유지한다.
- 세부 경계(노출 수준·성적 맥락·연령이 모호한 캐릭터·분류 보류·재검토/이의)는 D04의 구체 허용표로 정리해야 한다. 이 문구 자체가 국가별 적법성 확인 또는 캡처/타인 팬아트 권리 승인이 아니다.
- 기존 W06/W08/W14/W19/W20에서 분류·검토·인증·모든 공개 전달면의 접근 경계를 구현/검증한다. 운영 활성화·배포는 D06 유지.

## 5. 아직 사용자가 결정해야 할 항목

Codex는 완료된 저장소 감사 증거를 바탕으로 옵션을 제안하되 선택하지 않는다.

| ID | 미정 항목 | 필요한 제안 |
| --- | --- | --- |
| IMAGE-SYNC-01 | 최적화 사본 연동 확정 / 원본 백업 별도 | FREE-PRIVATE-IMAGE-SYNC-01에 따라 무료 최적화 사본 연동은 첫 Web 범위. 원본 백업 상품은 후속·미확정. 최종 용량/보관·삭제·복구 운영값은 D03/D05 잔여 |
| TITLE-STATE-SYNC-01 | 작품 저장 상태·평점·WatchLog remote sync | 신규 normalized entity, 승격·충돌·삭제·Web/Android 정합성 |
| AGE-01 | 12세 이용 목표 유지 / 성인 인증·성인 공개 보류 | 보호자 동의·국가별 아동 개인정보 조건은 별도 미완료. 이번 후보는 일반 공개·사후 검토이며 성인 공급자 계약/검증을 필수 작업에서 제외 |
| MODERATION-01 | 사전 심사 대 사후 심사 | 초기 베타 권장안과 운영량 추정 |
| SOURCE-01 | 출처별 사용 등급 | 직접 적재, 공식 검증, 대조 전용, 금지 |
| TAG-01 | MOEMOA 태그 체계 | core genre, catalog tag, memory tag 분리 |
| STORAGE-01 | 이미지 제한 | 포맷, 크기, 해상도, 파생본, 무료 용량 |
| PRIVACY-01 | 운영 주체·리전·보관 | 법적 주체, 데이터 위치, 수탁자, 삭제 기간 |
| BETA-01 | 베타 규모와 성공 기준 | 활성화, D7, 품질, UGC 처리 기준 |
| DEPLOY-01 | Git 기반 Vercel 배포 확정 / 후보 검증 잔여 | 2026-09-09 Git 운영배포 결정과 WEB-SMOKE-DEPLOY-01을 따른다. Vercel/Pages 재선택 항목 아님. 동일 후보 origin/OAuth/PWA·rollback 검증과 D06 승인 잔여 |
| IMAGE-PUBLIC-01 | 유형별 Public rollout | 콘텐츠 유형, 저장 상태, 권리 증빙, moderation gate의 AND 조건 |
| GROWTH-01 | 첫 유료 유입 시점 | organic/private beta 이후 집행 조건 |
| GROWTH-02 | KR/PH/TH 확정 / 국가별 방법 잔여 | RELEASE-REGIONS-01: 한국·필리핀·태국. 과거 PH/SG 제안은 대체됨. 국가별 인증·동의·콘텐츠·언어 운영 방법 D04 잔여 |
| GROWTH-03 | 광고 최적화 이벤트 | 클릭·가입보다 첫 Complete Card 저장 중심 여부 |

`TECH-01`, `STORAGE-LOCAL-01`은 2026-08-11, `BACKEND-01`, `AUTH-01`, `SYNC-01`과 수정된 `LEGACY-01`은 2026-08-26 사용자 승인으로 확정 섹션에 반영됐다. IMAGE-SYNC-01/DEPLOY-01/GROWTH-02는 위와 같이 최신 결정으로 확정된 범위와 남은 운영 조건을 분리한다. 그 외 미정 항목은 등록 자체로 확정하지 않는다. `reports/open-decision-questions.md`의 과거 옵션보다 최신 Decision Log가 우선한다.

## 6. 결정 변경 규칙

- 확정 결정을 바꾸는 구현은 먼저 Decision Log를 수정한다.
- Codex는 `제안`과 `확정`을 분리해 표시한다.
- 사용자 승인 전에는 새로운 선택지를 코드에 영구 고정하지 않는다.
- 임시 선택은 feature flag, adapter, configuration으로 격리한다.


## 7. Decision Log — PUBLIC-LAUNCH-V2-01 (2026-09-23)

- status: CONFIRMED — 출시 목표/격리 개발 범위 승인, 운영 활성 승인 아님.
- context: 9/22 마감의 Private-only 전제와 Pro V2의 정식 출시 목표가 다름. 사용자에게 차이를 설명한 뒤 “작업 시작해줘” 승인.
- options: Private-only 중간 상태로 종료 / 계정·공개 보드·공개 미니홈·팔로우·최소 운영까지 첫 정식 출시로 완성.
- chosen option: 후자. 개인 기록과 Web+Android 대상 유지. 공개할 이미지의 명시 선택·전달용 사본 준비만 포함하며 private 이미지 자동 백업은 제외.
- reason: 실제 사용자가 작성→선택 공개→방문→팔로우 재방문→철회할 수 있는 연결된 서비스를 출시한다.
- consequences: 공개 신고/차단/조치/이의/감사/kill switch, 서버 한도, 카탈로그 후보 갱신/승인 게시/복구를 출시 게이트로 유지. Guest-only는 중간 검증 상태. DM/댓글/추천 피드/갤러리 전면 재설계 제외.
- preserved: 표지 명시 선택과 개인 신호, 작품 저장/기억 생성 독립, Board N:M, 로컬 원본과 내부 ID, 이미지 유형별 권리 게이트, Git 기반 배포.
- files/modules affected: [ExecPlan](release-v2/01_RELEASE_EXECUTION_PLAN.md), [단일 진행판](release-v2/03_RELEASE_WORKBOARD.md), 계정·Public·운영 코드군. 첫 실행 M0는 앱 수정 없이 기준점/문서만 반영.
- migration impact: 이번 결정 자체는 없음. 실제 DB 적용/운영 Public/배포/파괴적 변경은 정확한 후보와 별도 승인 대상.
- approved by/date: 사용자, 2026-09-23, V2 범위 확인 후 작업 시작 지시.
- review date/trigger: 범위·권리·비용·플랫폼 변경 또는 M5 출시 후보 승인. 외부 값은 진행판 D01~D06에서 관리.

## Decision Log — RELEASE-CHANNEL-WEB-FIRST-01 (2026-09-25)

- status: CONFIRMED.
- context: 공통 Web/Android 기반은 유지하되 첫 출시 후보 채널을 명확히 정할 필요.
- options: Web+Android 동시 출시 / Web 먼저 출시 후 개선해 Android 출시.
- chosen option: 첫 출시 후보 Web-only. Android는 후속 출시.
- reason: 사용자가 Web을 먼저 마무리·출시하고 다듬은 뒤 Android 앱을 출시하는 순서를 확정.
- consequences: 첫 후보에서 Android 검사는 승인 근거를 연결한 NOT_APPLICABLE로 기록하며 PASS로 채우지 않는다. Web 검사 및 D03~D06은 그대로 필요. 기존 Android 코드·데이터 모델·후속 실기기 게이트 보존.
- files/modules affected: 기존 release-v2 D02/W20, scripts/check-release-candidate.mjs, 해당 단위검사.
- migration impact: 없음. 운영 migration/Public/배포 승인이 아니다.
- approved by/date: 사용자, 2026-09-25, “첫 출시 후보는 web-only로 확정하고. 남은 마무리 작업 및 검증 이어가자”.
- review date/trigger: 첫 Web 후보 D06 승인 또는 후속 Android 출시 준비.

## Decision Log — FREE-PRIVATE-IMAGE-SYNC-01 (2026-09-25)
- status: CONFIRMED — 사용자 첨부 차이 설명 후 “ㅇㅋ” 승인.
- chosen option: 첫 Web 출시의 무료 PC/모바일 Web 비공개 최적화 이미지 연동을 추가한다. 원본 전체 백업/결제/광고/Android 네이티브는 후속.
- budget: MOEMOA 추가 운영비 월50,000원 목표. 기존 Vercel 기본료·도메인·홍보비 제외; MOEMOA 초과료·세금·백업 포함. 이전 DB25달러 단독 계획과 충돌하는 부분을 대체.
- candidates: 무료 총50,000,000bytes, 큰 최적화 사본 최대1,000,000bytes. 품질/측정/D03 최종 운영값 승인 전 후보 유지. 썸네일/전송/전역한도 등은 첨부 후보 또는 미정이며 확정 서비스 약속 아님.
- consequences: 이미지 비공개 연동을 위해 공개를 요구하지 않음. 원본 hash·localRef 보존, 서버 representation 별도hash/version. 과거 사진 자동업로드 금지, 명시적 저장 범위 선택. private/public 역할·삭제/동의 경계 보존.
- affected: 기존 W06/W08/W15/W17/W19/W20, C02/C04/C09/C10/C11/C12. 단일진행판 유지.
- migration/approval: 로컬 구현·검사 승인. 운영migration/유료변경/Public/배포/원본삭제 포괄승인 아님. D06 유지.
- review trigger: 품질/비용 검증, D03~D05 운영값, 최종 Web RC.

## Decision Log — PRIVATE-REPRESENTATION-PUBLIC-RIGHTS-01 (2026-09-26)
- status: CONFIRMED. 사용자가 공개 권한 기준 검토 대화를 연결하고 진행 승인.
- decision: 기존 원본 공개 입력/hash 검사를 유지하면서 정확한 private representation ID/hash/sourceVersion에 trusted rights evidence를 결속한 공개 준비 경로를 추가한다. 비공개 동기화 동의, 공개 이미지 사용 동의, 최종 preview 게시 동의는 분리한다.
- constraints: 브라우저 자기 선언/비공개 저장은 trusted 승인 근거가 아니다. 기존 source 권리 gate도 유지하며 사본 근거가 추가로 일치해야 한다. 캡처/타인 팬아트 gate 완화 없음. 원본 checksum/localRef 수정 없음.
- scope: 기존 W08/D04 구현·로컬 검증 승인. 실제 권리 레코드 승인·원격 migration·운영 Public·배포는 별도 D01/D04/D06. UI에는 DB 식별자/해시를 노출하지 않는다.

## Decision Log — WEB-SMOKE-DEPLOY-01 (2026-09-26)
- status: CONFIRMED — 사용자가 현재 작업을 배포해 폰·다른 사람에게 링크로 간이 테스트하도록 요청.
- scope: 검증한 Web 코드를 master에 commit/push하고 Vercel Git 운영 배포를 확인한다. 기존 계정·기록과 Web 로컬 이미지 선택을 제공하며 원본 bytes는 해당 브라우저에 보관한다.
- limits: 정식 출시 전체 승인과 구분. private 이미지 동기화·Public UI/API 활성화, 운영 DB migration, 유료 변경은 이번 간이 배포에 포함하지 않는다. Android 제외. D01/D03~D06 정식 출시 잔여 유지.
- rollback: 코드 commit revert 후 Git 연동 재배포. 사용자 기록·원본·기존 DB 삭제 없음.

## Decision Log — GENERAL-PUBLIC-POSTMODERATION-01 (2026-09-27)

- status: CONFIRMED_PRODUCT_SCOPE / IMPLEMENTATION_PENDING.
- context: 개인 운영자가 감당할 첫 출시 범위를 단순화하고 성인 인증 도입·계약으로 이어진 범위 확대를 중단한다.
- options: 성인 영역/인증까지 첫 출시 / 일반 공개만 제공하고 성인 영역·인증 보류.
- chosen option: 후자. 사용자가 명시적으로 선택한 비공개 업로드에는 공개용 권리 확인·공개 동의를 요구하지 않는다. 공개는 성인용·불법·권리침해 콘텐츠 금지와 게시 권한을 간단히 확인하고, 정확한 미리보기에 동의한 일반 콘텐츠를 게시한다. 관리자의 모든 게시물 사전승인을 필수로 삼지 않고 기존 신고·차단·관리자 사후 검토/삭제·이의·감사로 관리한다.
- reason: 일반 이미지 공유를 우선 완성하고 한 명의 운영자가 현재 확인 가능한 범위로 시작한다. 성인 인증은 방문자 자격 확인이며 이미지 자동 분류를 대체하지 않는다. 자동 분류·검토 보조는 운영량 증가 시 별도 검토하고 지금 도입하지 않는다.
- supersedes: AGE12-ADULT-AREA-01의 첫 출시 성인 영역/인증 부분, ADULT-CONTENT-SCOPE-01의 첫 출시 적용, release-v2 C04의 모든 일반 이미지에 대한 사전 분류 필수 조건. 과거 소스·실행 로그·검증 근거는 삭제하거나 PASS로 재해석하지 않는다.
- preserved: Web-only, KR/PH/TH, 기존12세 목표 및 별도 보호자 동의 잔여, owner/RLS·명시적 업로드·용량 제한·원본/사본 구분·reviewHash/정책 결속·철회/차단·kill switch. 비공개라는 이유로 불법 콘텐츠 허용을 뜻하지 않는다. 체크는 법적 면책이나 관리자의 검토 완료 증거가 아니며 캡처·타인 팬아트 별도 권리 gate도 자동 통과시키지 않는다.
- implementation gap: 현재 정식 후보의 content review SQL은 정확한 GENERAL 사전 검토 없이는 조회 null, 공개 이미지 준비에는 별도 trusted 권리 근거가 필요하다. 따라서 문구만 바꾸어 일반 이미지가 즉시 게시된다고 보고하지 않는다. 기존 W08/W09/W11/W14에서 간단한 확인의 증거/이미지 결속과 사후 차단을 함께 정리한다. 일반 자기 확인을 모든 이미지의 trusted 승인 레코드로 위조하지 않는다.
- files/modules affected: 기존 release-v2 00/01/02/03, 이미지 UGC 명세, 공개 확인·게시/조회·운영 검토 경로. 새 계획 트리/진행판 없음.
- 구현 구체화(2026-09-27): 본인 창작임을 명시 선택한 일반 이미지는 정확한 원본 hash/버전 및 선택한 사본 ID/hash에 `SELF_DECLARED`를 결속한다. 기존 `TRUSTED`와 분리하며 승인시각/관리자 GENERAL을 생성하지 않는다. 이는 위 단순 공개 확인 결정의 적용이고 모든 이미지의 별도 trusted 승인을 요구했던 과거 구현을 이 범위에서 대체한다. 캡처·타인 팬아트 및 외부 허락 근거의 별도 gate, 철회/소유자/정책 검사는 유지한다. 로컬 구현·검증 결과는 단일03/evidence를 따르며 원격 활성 승인은 아니다.
- migration impact: 이 결정 반영은 문서만 변경. 후속 DB 후보는 추가 migration 및 로컬 검증으로 준비하고 운영/public flags 변경·유료 계약·배포는 D06의 정확한 승인 전 실행하지 않는다.
- approved by/date: 사용자, 2026-09-27, “성인 인증은 보류”와 후속 “맞음, 일반 이미지 공개만 허용”.
- review date/trigger: 사후 검토 흐름 검증, D04 보호자/권리·운영 정책 마감, D06 Web 후보 또는 향후 성인 영역 재도입.

## Decision Log — FILM-ARCHIVE-DIRECTION-01 (2026-10-03)

- status: CONFIRMED_DIRECTION / DESIGN_REVIEW_PENDING. 컨셉과 선행 설계 진행 승인이지 새 시안·수치·서비스 적용의 일괄 승인이 아니다.
- context: 사용자는 C 시안을 선택한 뒤 작품 하나를 하나의 필름, 저장한 이미지와 시청 기록을 그 안의 내용으로 보는 개인 필름집 컨셉을 제안했다. 메인 외 화면도 통일되도록 먼저 계획하고 진행하라고 승인했다.
- options: 메인만 필름 장식 / 전체 화면을 강한 필름 형태로 변경 / 공통 디자인 언어를 공유하고 화면 역할에 따라 표현 강도를 조절.
- chosen option: 세 번째. 작품 표지를 전체 아카이브 그리드로 보는 기능은 유지하고, 작품 안에서 좌우로 기억을 탐색하는 필름 표현을 구체화한다. 보드는 여러 작품의 Memory를 묶는 기존 N:M 의미를 유지한다.
- identity: 첨부 로고의 둥근 소문자 `moemoa` 글자 형태·두께·자간을 유지하는 방향. 왼쪽 심벌만 필름을 연상하도록 수정한다. 첨부는 래스터 시안이며 실제 폰트 파일/이름이 확인된 것은 아니다. 최종 심벌, 벡터 원본, 작은 크기 판독성은 검토 전이다.
- reason: 작품 전체를 한눈에 찾는 밀도와 개인 기록을 넘겨보는 감각을 함께 유지하고, 메인에만 적용한 테마가 다른 화면과 단절되는 것을 방지한다.
- preserved: 작품 저장·WatchLog·Complete Memory의 독립, Poster/Memory dual view와 사용자 마지막 선택, 기존 nav 명칭, Board membership, 로컬/계정/이미지/공개 경계. `필름`은 우선 읽기 표현이며 새 저장 엔터티나 자동 Memory 생성의 승인이 아니다.
- consequences: 현재는 1) 화면·상태/흐름 조사, 2) 화면별 컨셉 배분, 3) 로고·디자인·문구·모션 기준안까지 작성한다. 다음 연결형 프로토타입 검토 후 서비스 전면 적용으로 진행한다. 기존 미커밋 UI는 보존하되 승인된 디자인으로 간주하지 않는다. 기존 Astro/React 구조를 유지하며 언어/프레임워크 교체는 필요성 증거와 별도 기술 검토 없이 실행하지 않는다.
- files/modules affected: `plans/2026-10-03-interface-rebuild.md`, 후속 공통 shell/스타일과 Title/Memory/Board/작성/보조 화면. 이번 턴은 문서와 별도 로컬 검토 자료만 작성.
- migration impact: 없음. DB·동기화·공개 flags·운영 배포·private 이미지 업로드 변경 없음.
- approved by/date: 사용자, 2026-10-03, C 선택, 필름집 제안, 전체 화면 계획 필요성 제기 후 “그렇게 진행해줘”와 첨부 로고 심벌 수정 요청.
- review date/trigger: 로고 심벌 및 공통 가이드 검토 → PC/모바일 연결형 프로토타입 검토 → 전체 적용. WatchLog의 구체 통합 표현·정렬/회차 없는 기록 처리는 제안으로 남기며 기존 저장 모델을 바꾸지 않는다.
- 2026-10-03 후속 선택: 사용자 “로고는 2안이 더 나았음.” 로고 심벌의 발전 기준은 `이어지는 필름` 2안으로 확정한다. 최종 정제된 도형/벡터·최소 크기 승인과는 구분하며, 1안을 최종 채택한 것으로 기록하지 않는다.

## Decision Log — FILM-BOOKSHELF-PREVIEW-01 (2026-10-03)

- status: CONFIRMED_PROTOTYPE_SCOPE / PRODUCT_REPLACEMENT_PENDING.
- context: 사용자는 보드의 역할이 애매하다고 평가하고, 미니홈피처럼 꾸미는 개인 필름책장과 작품당 한 행의 가로 필름 탐색을 제안했다. 역할 구분 설명 후 “ㅇㅋ 그렇게 발전시켜보자”로 새 시안 진행을 승인했다.
- chosen option: 별도 로컬 시안에서 `내 책장(홈) / 작품 / 기억` 메뉴, 직접 고르고 꾸미는 책장, 유지되는 표지 그리드, `기억 함께 보기`의 고정 표지+독립 가로 필름 행, 더 정돈된 작품 상세 필름을 검토한다. 로고 2안 방향 유지.
- preserved: BOARD-01 및 기존 보드·공개 미니홈 참조/철회 계약은 아직 대체하지 않는다. 메뉴에서 보드가 없는 시안과 보드 기능/데이터의 영구 제거는 다르다. 전체 작품 집합과 책장 진열 선택을 분리하며, 진열/해제가 작품 저장·기억·시청 기록을 생성/삭제하지 않는다. 꾸미기와 공개 동의를 분리한다.
- scope: 가상 데이터 기반 프로토타입만. 기존 2차 시안을 보존하고 새 HTML/CSS/JS로 비교 가능하게 제공. 개인정보/사진 업로드, 서버, 저장소, 동기화, 실제 공개 전시는 제외.
- reason: 작품 전체를 찾는 목록과 개인 취향을 고르는 전시 공간의 목적을 분리하고, 작품별 기억을 목록에서도 바로 넘겨 볼 수 있게 한다.
- consequences: 최종 메뉴/보드 역할·실제 책장 저장 모델·공개 미니홈 연결은 새 시안 검토 후 결정한다. 기존 작품 목록의 preview 최대3개 계약을 실제 서비스에서 확대할 경우 추가 로딩/성능 설계와 검증이 필요하다.
- files/modules affected: `plans/2026-10-03-interface-rebuild.md`, 별도 검토 폴더의 `moemoa-film-bookshelf.html`, `film-bookshelf.css`, `film-bookshelf.js`.
- migration impact: 없음. 실서비스 변경/보드 이전/삭제/운영배포 승인 아님.
- approved by/date: 사용자, 2026-10-03, “ㅇㅋ 그렇게 발전시켜보자”.
- review date/trigger: 책장 꾸미기·작품 필름 행·상세 필름 PC/모바일 시안 확인 후 서비스 적용 범위 결정.

## Decision Log — NO-HERO-UI-01 (2026-10-05)

- status: CONFIRMED_DESIGN_CONSTRAINT / PROTOTYPE_IMPLEMENTATION_APPROVED.
- context: 사용자는 정돈된 홈이 개인 기록 공간보다 정적인 구식 템플릿처럼 보인다고 평가한 뒤, “hero 영역이 들어가 있다면 해당 섹션 전부 제거 후 리디자인 진행. hero영역은 절대 넣지 않기”라고 지시했다.
- options: 소개 영역 축소 / 소개·대표 이미지 영역을 제거하고 실제 컬렉션과 조작부터 시작.
- chosen option: 후자. 향후 MOEMOA 디자인에 hero를 넣지 않는다. 대형 소개 문구, 대표 이미지 배너, 별도 spotlight/환영 무대로 다시 포장하지 않는다. 짧은 페이지 제목·탐색·실제 기록·기능적 빈 상태는 유지할 수 있다.
- reason: 서비스 소개보다 개인 수집과 재열람·기록 행동을 우선한다.
- consequences: V7 격리 시안에서 홈의 shelf-intro/profile/bio/featured 구조 전체와 대형 빈 상태 예시 무대를 제거한다. 선반에서 사용자가 선택한 작품만 연결된 필름을 펼치며 최초 진입은 자동 spotlight 없이 시작한다. 기존 로고2안/표지 그리드/책장 진열/작품·Memory·WatchLog 독립성을 유지한다.
- files/modules affected: `plans/2026-10-03-interface-rebuild.md`, 별도 검토 폴더의 V7 HTML/CSS/JS. 기존 V6는 비교 근거로 보존한다.
- migration impact: 없음. 실제 서비스 적용·데이터/공개/배포 범위를 확대하지 않는다.
- approved by/date: 사용자, 2026-10-05, 위 명시 요청.
- review date/trigger: hero 없는 홈과 필름 펼침/기억 추가 흐름의 PC·모바일 시안 검토 후 실제 서비스 확장 승인.

## Decision Log — SHELF-ROW-PREVIEW-01 (2026-10-05)

- status: CONFIRMED_PROTOTYPE_SCOPE / SERVICE_APPLICATION_PENDING.
- approved by: 사용자 “진행해줘”. 책장 레이아웃 재검토에 대해 제안한 작은 선반 탭 + 연속 표지 그리드 + 선택 행 아래 필름 펼침을 별도 V8 시안으로 진행한다.
- chosen option: 표지 자체를 가로로 늘리지 않고 선택한 행 아래에 연결된 커버/필름 패널 하나를 연다. 옆 표지의 x좌표·폭은 유지한다. 초기 선택 없음, hero 없음.
- preserved: 책장은 선별 진열, 전체 탭은 선반 합집합이다. My Titles/Memory/WatchLog/Board 및 비공개·동기화 계약은 바꾸지 않는다. V7 비교 보존, 가상 RAM 데이터만 사용한다.
- migration impact: 없음. 운영 코드 교체·공개·배포 승인이 아니다. 다음 게이트는 PC/모바일 시안 확인과 실제 서비스 적용 범위다.
- execution: `plans/2026-10-03-interface-rebuild.md` 8차, 별도 `moemoa-film-grid.html`/`film-grid.css`/`film-grid.js`.

## Decision Log — V84-WEB-APPLICATION-01 (2026-10-05)
- approved by: 사용자 “시안에 전체적인 큰 틀의 디자인은 나온 것 같으니, 이제 실 서비스 디자인 적용 작업 진행해줘”.
- scope: V8.4의 공통 메뉴/핑크 주요행동, 내 책장 선반과 행 아래 필름, 작품 두 보기, 기억 검색·기록기반 분류/원본비율 목록, 이미지 상세 좌이미지/우정보를 실제 Web 코드에 적용한다.
- presentation: 새 기기의 기본 테마는 시안의 흰 배경으로 맞추고 기존 사용자의 저장된 밝음/어둠 선택은 보존한다. 주요 CTA는 하나만 유지한다.
- data boundary: 작품 저장·Memory·WatchLog·Board의 독립성 유지. 책장 선반은 소유자별 이 기기의 진열 설정으로 추가하며 원본·Board를 이동/삭제하지 않는다. 원격 책장 sync/schema/Public 연결은 추후 범위. 가상 시안 기록은 실제 제품으로 이전하지 않는다. 태그/캐릭터는 실제 WatchLog의 작품과 Memory의 source binding이 정확히 일치할 때만 분류한다.
- preserved: NO-HERO, 로고2안, 기능 flags/권리·개인정보·계정경계, 기존19 routes. Web-only 후보; Android release 작업 제외. 운영배포·master merge/push·DB migration 승인은 포함하지 않는다.
- execution: 기존 interface-rebuild ExecPlan20차. 저장 가능한 UI와 실제 browser 회귀·미감 캡처를 완료하고 로컬 서비스 링크 제공.

## Decision Log — CARD-CLASSIFICATION-01 (2026-10-05 승인)

- status: CONFIRMED_LOCAL_AND_SYNC_CANDIDATE_SCOPE.
- context: 같은 작품의 서로 다른 이미지에서 캐릭터와 개인 태그를 따로 선택해 모아볼 필요가 있다. 기존 WatchLog 분류는 작품의 감상 기록에 붙어 있다.
- options: 기존 작품 감상 분류 재사용 / Memory별 분류 추가.
- chosen option: 사용자 “카드별 태그로 진행 (추천)”에 따라 카드별 캐릭터 참조·커스텀 태그를 명시 저장한다. 장르·기존 감상 분류는 유지한다.
- reason: 같은 작품의 여러 이미지가 항상 같은 등장인물·태그를 가진 것으로 간주하지 않는다.
- consequences: version1 classification, 태그 최대20개/48자·캐릭터 최대12개(출처/ID/이름), 원본 이미지 자동 분석 없음. 현재 원격 지원 전에는 이 기기 보관임을 표시한다. 공개 snapshot에는 자동 포함하지 않는다.
- files/modules affected: Memory editor/update/IndexedDB/Archive/metadata backup, sync DTO/gateway, title characters reader. 기존 interface-rebuild 22차와 결과 보고 참조.
- migration impact: additive private JSON column 및 검증/RPC wrapper 후보만 준비·로컬 검증. 운영 적용·새 sync flag 활성화·Public·배포는 별도이며 승인되지 않았다.
- approved by/date: 사용자, 2026-10-05. 질문에 명시된 로컬 검증·동기화 준비 범위 승인.
- review date/trigger: 승인된 test 환경의 새 metadata save/pull/conflict/promotion 검증, 이후 D06의 정확한 운영 후보 검토. TAG-01 전체 체계는 별도 잔여다.

## Decision Log — LINE-IMAGE-COLLECTION-01 (2026-10-06)

- status: CONFIRMED_LOCAL_WEB_PRESENTATION_SCOPE.
- approved by: 사용자 “필름 컨셉으로 들어간 디자인들 전부 빼고(인터렉션은 유지) … 선적인 요소들”, 작품 탐색을 보기 옆으로 이동, 이미지 겹침·모션 요청. 이름 질문에는 “컬렉션 / Collection (추천)”을 선택했다.
- chosen option: 홈/내 책장 표시명을 컬렉션/Collection으로 바꾼다. 필름 구멍·띠·필름 아이콘과 관련 조작 문구를 없애고 얇은 구분선과 이미지 중심으로 정리한다. 작품의 장르·열 수는 헤더의 보기 옆 탐색 칸으로 옮긴다. 컬렉션/작품 표지는 읽기 쉬운 그리드와 가벼운 겹쳐보기를 선택할 수 있으며 hover/focus에서 표지를 펼친다. 자동 재생 없이 reduced-motion을 존중한다.
- preserved: 기존 사용자 선반 이름과 owner별 로컬 설정 저장 키, Title/Memory/WatchLog/Board 모델, 표지 선택→한 패널 펼침 및 작품 상세 이동은 유지한다. SHELF-ROW-PREVIEW-01의 행 아래 펼침은 이번에도 유지하며 옆 펼침으로 바꾸라는 명시 요청으로 해석하지 않는다. NO-HERO/핑크 주요 행동도 유지한다.
- supersedes: FILM/LOGO-2/V84-WEB-APPLICATION-01의 필름 표현만 이번 사용자 지시에 따라 대체한다. 과거 승인·실행 로그는 보존한다.
- migration impact: 없음. 로컬 presentation과 문구만 변경하며 원본 이미지/카드 데이터, DB/flags/운영배포/Android를 변경하지 않는다.
- execution/next gate: 기존 interface-rebuild ExecPlan25차에서 실제 src와 브라우저를 검증한다. 실제 사용자 화면 확인 후 추가 배치 조정; 운영 반영은 D06의 정확한 후보 승인 범위다.

## Decision Log — TITLE-MEMORY-STACK-01 (2026-10-07)

- approved by: 사용자 “애니 표지 뒤쪽으로 이미지들이 겹쳐보이는 듯한 느낌”. 기존 겹침 요청의 대상을 정정했다.
- chosen option: 서로 다른 작품 표지를 겹치는25차 해석을 대체한다. 컬렉션/작품 Poster View에서 각 작품의 실제 저장된 Memory preview(최대3개)를 그 작품 표지 뒤로 살짝 겹친다. 기본 그리드에 적용하고 잘못 해석한 별도 겹쳐보기 옵션을 제거한다. 실제 기억이 없는 작품은 표지만 표시하고 장식용 가짜 사진이나 Memory를 생성하지 않는다.
- preserved: 표지/작품명/기억 펼침의 기존 동작, 행 아래 한 패널, POSTER/MEMORY 데이터 의미, owner별 미디어 권한과 lazy private preview, NO-HERO/선·핑크/Collection 명칭. 원본이나 개인 태그·감상을 공개하지 않는다.
- execution: 기존 interface-rebuild26차. 로컬 src/합성 runtime 회귀/실제 표지 화면 확인이며 DB/Public/배포·Android 승인 범위는 확대하지 않는다. LINE-IMAGE-COLLECTION-01의 다른 결정과 과거25차 근거는 보존한다.

## Decision Log — COLLECTION-SIDE-FAN-01 (2026-10-07)

- approved by: 사용자 “클릭 시에는 겹친게 펼쳐지면 …”에 대한 선택 질문에서 “표지 옆으로 펼침 (추천)” 승인.
- chosen option: 컬렉션의 선택한 작품 묶음을 한 줄로 확장하고, 앞표지 옆에서 해당 Memory preview 최대3장을 펼친다. 다른 작품은 다음 줄로 밀리며 앞표지는 일반 타일과 같은 크기로 유지한다. 휴대폰은 표지 아래 가로 넘김. 다시 표지 선택/접기/Escape로 닫고 기억 이미지는 해당 카드 상세, 작품 이름은 동일 Title Hub로 이동한다.
- supersedes: SHELF-ROW-PREVIEW-01/25·26차의 별도 행 아래 패널 위치만 사용자 승인으로 교체한다. TITLE-MEMORY-STACK-01의 같은 작품 Memory 뒤 겹침과 기존 Collection 이름·선/핑크·데이터/owner 권한 계약은 유지한다. 작품 탭의 Title Hub 탐색 계약은 이번 컬렉션 클릭 위치 변경과 별개다.
- impact/next: 기존 interface-rebuild27차의 로컬 Web presentation. DB/migration/원본·업로드/flags/운영배포/Android 변경은 승인되지 않았다. 실제 src의 옆 펼침·모바일 넘김·키보드·동일 카드/작품 이동을 검증하고 사용자 배치 검토로 이어간다.

## Decision Log — SHELF-EDITOR-COVERS-01 (2026-10-07)

- approved by: 사용자 “선반 편집 부분 좀 정리 … 애니 표지가 같이 나오면 좋겠어”.
- chosen option: 실제 Collection 편집에서 활성 선반 한 개의 이름과 작품을 편집한다. 선택 작품은 실제 catalog 표지·제목·기억 개수로 표시하며 검색/선택됨 보기로 찾는다. 선반 목록에서 이동하고 추가/제거는 draft에만 반영한다.
- preserved/impact: 적용/취소·owner별 기존 선반 저장 키·기존 범위·Memory/Title identity·27차 펼침 유지. 없는 표지는 기존 fallback. 표지 선택이 Memory 생성이나 이미지 업로드/공개가 되지 않는다. 기존 interface-rebuild28차의 로컬 Web 표현 작업이며 DB/flags/운영배포 승인으로 확장하지 않는다.

## Decision Log — WATCH-RECORD-FLOW-01 (2026-10-07)

- approved by: 사용자 “기존의 감상 기록들(별점, 시청 상태, 정주행 횟수 등) … 사용자관점에서 플로우를 고민 후에 적용”.
- chosen option: 공통 기억 남기기에서 감상 기록/장면 저장의 목적을 구분하고, 감상 기록은 작품 선택 후 같은 Title Hub에서 작성·이력 확인한다. 별점/시청 상태/재시청·날짜/기존 메모와 WatchLog를 다시 연결한다. 일반 감상은 이미지 선택 없이 저장하며 이미지는 별도 명시 선택으로 이어간다.
- preserved: LIBRARY-INTEGRATION-01/TITLE-HUB-01의 기존 개인 기록 보존, Memory와 Title 상태/WatchLog의 독립, Complete Card의 작품+visual·표지의 개인 신호 조건, image-first Archive/Board. 기존 이름/이미지 composer direct route와 legacy edit 호환 유지. 작품 저장 해제나 Memory 삭제로 감상 이력을 지우지 않는다.
- execution/impact: 기존 interface-rebuild29차. 숫자 AniList가 없는 자체 catalog 로그에 optional canonical identity를 로컬로 보존하고 snapshot 호환/실패 재시도까지 검증한다. 신규 normalized remote schema/자동 원격 이관은 만들지 않는다. 운영 DB/flags/배포와 Android는 이번 승인에 포함하지 않는다.

## Decision Log — COLLECTION-TASTE-SPACE-01 (2026-10-07)

- **상태: 사용자 취소 (2026-10-07).** “이 요청 그냥 취소.. 롤백 해줘”에 따라 이번 위치 이전·새 취향 배치 승인을 철회했다. 기존 컬렉션 선반/표지 뒤 겹침·옆 펼침과 작품 두 보기를 유지한다. 감상 기록/태그 등29차까지의 작업은 계속 유효하다. 아래는 취소된 요청의 과거 기록이다.

- status/approval: CANCELLED — 원래 승인 요청은 사용자 “컬렉션에 적용된 저 느낌을 작품 탭의 표지보기 일 때로 옮기고 … 실험적인 여러 레이아웃들로 자신의 애니 취향을 시각적으로 나타낼 수 있는 공간 … 태그 선택 … 모바일 … 리소스 고려”였으나 이후 사용자 취소로 무효다.
- chosen option: 현재 표지 뒤 같은 작품 Memory 겹침/PC 옆·모바일 아래 펼침을 작품 Poster View로 옮긴다. 제목은 같은 Title Hub, 기억은 같은 상세로 이동한다. 컬렉션은 개인 취향 이미지 공간으로 분리하고 벽면/대각 겹침/원형 배치, 카드 태그·캐릭터 범위, 순서 재배치를 제공한다. 기존 공통 메뉴/폰트/핑크/테마는 유지하며 컬렉션에 channel의3~4열 정보 header를 강제하지 않는다.
- preserved: 기존 Title/Memory/WatchLog/Board와 owner 경계, 감상 기록 동선, 저장/해제 독립, 원본 bytes/카드 태그/선반 설정을 삭제하지 않는다. 이전 선반은 작품 탭의 범위와 편집으로 접근한다. 기존 COLLECTION-SIDE-FAN-01의 위치만 Poster View로 이전한다. 모바일은 한정된2열 이미지 모음으로 배치하고 복잡한 PC 입체 조작은 강제하지 않는다.
- local implementation: 기존 이미지/표지 참조와 bounded 미리보기 재사용, 카드 태그 조건에 작품 표지를 끼워 넣지 않음, owner별 로컬 배치 설정/적용·취소. 서버 이미지 복제/신규 UGC 자동 게시/공개 페이지 활성화 없음. 향후 미니홈은 기존 public snapshot/권리/철회 gate에 연결할 별도 잔여다. 개인 레이아웃이 private 자료를 공개하는 승인은 아니다.
- impact/gate: 기존 interface-rebuild30차. DB/migration/의존성/유료변경/운영배포/Android 승인0. 실제/합성 runtime·200장 loading budget·모바일·기존 작품 두 보기/감상과 선반 보존을 검증한다.

## Decision Log — WEB-DESIGN-RELEASE-CLOSEOUT-01 (2026-10-07)

- status/approval: 사용자 직접 “내 승인 없이 … 전부 작업 … 중요한 기능 … 검토 … 추가 작업 … 실 서비스 배포(db구조도 업데이트)” 승인. 현재 유효한 Web 변경의 누락 마감/검증 후 필요한 비파괴 DB 후보와 master Git 운영 배포를 진행한다. 반복 후보 확인 질문 없이 실행한다.
- preserved: 취소된 COLLECTION-TASTE-SPACE-01은 취소 유지. Android/성인 인증/유료 계약·권리 확대/private 자동 upload와 미검증 Public 활성화는 승인 범위가 아니다. 기존 개인정보/권리/RLS·owner·삭제/철회 fence 및 사용자 기록은 보존한다. TITLE-STATE-SYNC-01의 신규 전체 remote 모델 선택을 이 배포 지시로 임의 확정하지 않는다.
- execution: 기존 interface-rebuild31차/단일 release-v2 진행판. 실제 production SHA/DB 버전·migration hash/data release ID 및 검증/백업·복귀 경로를 기록하고 정상 검사 후 Git merge/push→Vercel Git SHA 확인. DB 새 classification 적용/실제 test HTTP12 및 운영 rollback-only RPC 계약은 완료했다. Web 검사/최종 Git 배포 결과는 기존31차 보고/배포 증거에 결속한다. Public 출시 전체 PASS로 확대하지 않는다.
