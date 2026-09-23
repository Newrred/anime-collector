# 01. 확정 결정과 미정 게이트

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

## 5. 아직 사용자가 결정해야 할 항목

Codex는 완료된 저장소 감사 증거를 바탕으로 옵션을 제안하되 선택하지 않는다.

| ID | 미정 항목 | 필요한 제안 |
| --- | --- | --- |
| IMAGE-SYNC-01 | Private 이미지 백업 | 수동 동의, 용량·포맷·보관·삭제 기준 |
| TITLE-STATE-SYNC-01 | 작품 저장 상태·평점·WatchLog remote sync | 신규 normalized entity, 승격·충돌·삭제·Web/Android 정합성 |
| AGE-01 | 공개 UGC 연령 | 18+ 베타 또는 미성년자 지원 시 추가 요건 |
| MODERATION-01 | 사전 심사 대 사후 심사 | 초기 베타 권장안과 운영량 추정 |
| SOURCE-01 | 출처별 사용 등급 | 직접 적재, 공식 검증, 대조 전용, 금지 |
| TAG-01 | MOEMOA 태그 체계 | core genre, catalog tag, memory tag 분리 |
| STORAGE-01 | 이미지 제한 | 포맷, 크기, 해상도, 파생본, 무료 용량 |
| PRIVACY-01 | 운영 주체·리전·보관 | 법적 주체, 데이터 위치, 수탁자, 삭제 기간 |
| BETA-01 | 베타 규모와 성공 기준 | 활성화, D7, 품질, UGC 처리 기준 |
| DEPLOY-01 | Web canonical production | Vercel/GitHub Pages 중 origin, OAuth, PWA scope 통일 |
| IMAGE-PUBLIC-01 | 유형별 Public rollout | 콘텐츠 유형, 저장 상태, 권리 증빙, moderation gate의 AND 조건 |
| GROWTH-01 | 첫 유료 유입 시점 | organic/private beta 이후 집행 조건 |
| GROWTH-02 | 첫 검증 국가 범위 | 필리핀 단일 또는 싱가포르 교차 검증 범위 |
| GROWTH-03 | 광고 최적화 이벤트 | 클릭·가입보다 첫 Complete Card 저장 중심 여부 |

`TECH-01`, `STORAGE-LOCAL-01`은 2026-08-11, `BACKEND-01`, `AUTH-01`, `SYNC-01`과 수정된 `LEGACY-01`은 2026-08-26 사용자 승인으로 확정 섹션에 반영됐다. `IMAGE-SYNC-01`, `TITLE-STATE-SYNC-01`, `DEPLOY-01`, `IMAGE-PUBLIC-01`, `GROWTH-01~03` 등 이 표에 남은 항목은 여전히 미정이며, 등록 자체가 결정을 확정하지 않는다. 세부 옵션과 잠정 권장안은 `reports/open-decision-questions.md`를 따른다.

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
