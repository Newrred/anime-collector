# 01. 확정 결정과 미정 게이트

> **문서 상태: `CANONICAL PRODUCT DECISIONS`**
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

상태: **확정**

완료 조건:

```text
Anime 또는 PrivateTitle
+ VisualAsset 1개
= Complete Memory Card
```

- 사용자 이미지를 강력 권장한다.
- 사용자가 이미지를 제공하지 못하면 서비스 디자인 카드를 생성한다.
- 작품 제목만 있으면 Draft다.
- 작품 장르 태그는 카탈로그에서 자동 연결한다.
- 감상, 감정, 날짜, 에피소드·장면, 재감상 의도는 선택 항목이다.
- 사용자 메모는 긴 리뷰가 아니라 짧은 기억 신호를 우선한다.

### BOARD-01 — Private Board P0

상태: **확정**

- Archive는 모든 완성 카드를 자동으로 포함한다.
- Board는 사용자가 선택해서 만든다.
- 카드가 3개 이상일 때 Board 생성 제안을 노출한다.
- 하나의 카드가 여러 Board에 들어갈 수 있다.
- Board에서 카드를 제거해도 원본 카드가 삭제되지 않는다.
- 공개 불가능 카드가 포함된 Board는 Public 전환할 수 없다.

### IMAGE-01 — 이미지 유형 전체를 데이터 모델에서 구분

상태: **확정**

지원 대상:

- 사용자 기기 이미지
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
storageScope
visibility
rightsBasis
creator/source
license/permission
moderationStatus
spoiler/content rating
```

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

상태: **확정 — 2026-08-26**

- Whole JSON snapshot 대신 Memory Card, VisualAsset metadata, Board, preference를 entity row로 동기화한다.
- 각 entity는 optimistic `version`, server timestamp, tombstone을 가진다.
- 같은 entity의 base version이 다르면 timestamp로 자동 덮어쓰지 않고 사용자 conflict resolution으로 보낸다.
- Delete tombstone은 stale update보다 우선하며 30일 보존한다.
- Operation ID와 request hash로 retry를 idempotent하게 만들고 server-generated `sync_seq`로 변경분을 pull한다.
- 사용자 이미지 file은 sync하지 않는다. `LOCAL_ONLY` metadata와 system-design spec만 Phase 1 대상이다.

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

### CATALOG-PROD-01 — 승인된 카탈로그와 대표 표지의 Production 표시

상태: **확정 — 2026-08-19**

- 사용자는 2026-08-19 AniList 기반 카탈로그 metadata와 작품별 대표 표지를 MOEMOA Production에서 저장·표시하는 허가를 받았다고 확인했다.
- 허가 증빙 원문은 사용자가 보관하며 저장소에는 승인 범위와 확인 시점만 기록한다.
- 승인 범위는 현재 검증된 Service Projection v2 3,998개와 그 작품별 대표 표지 1개를 Production Web의 검색·상세 화면에서 제공하는 용도다.
- raw payload, 추가 이미지, 애니 장면 캡처, 팬아트, 사용자 이미지, Public UGC 권한으로 확대하지 않는다.
- 대표 표지는 catalog presentation asset이며 Memory Card의 사용자 `VisualAsset`으로 복사하지 않는다.
- 공급자 조건이 변경되거나 허가가 철회되면 `PUBLIC_CATALOG_SUPABASE_*`를 제거하거나 Web consumer 커밋을 revert해 기존 fallback으로 즉시 전환한다.

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

## 5. 아직 사용자가 결정해야 할 항목

Codex는 완료된 저장소 감사 증거를 바탕으로 옵션을 제안하되 선택하지 않는다.

| ID | 미정 항목 | 필요한 제안 |
| --- | --- | --- |
| IMAGE-SYNC-01 | Private 이미지 백업 | 수동 동의, 용량·포맷·보관·삭제 기준 |
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

`TECH-01`, `STORAGE-LOCAL-01`은 2026-08-11, `BACKEND-01`, `AUTH-01`, `SYNC-01`과 수정된 `LEGACY-01`은 2026-08-26 사용자 승인으로 확정 섹션에 반영됐다. `IMAGE-SYNC-01`, `DEPLOY-01`, `IMAGE-PUBLIC-01`, `GROWTH-01~03` 등 이 표에 남은 항목은 여전히 미정이며, 등록 자체가 결정을 확정하지 않는다. 세부 옵션과 잠정 권장안은 `reports/open-decision-questions.md`를 따른다.

## 6. 결정 변경 규칙

- 확정 결정을 바꾸는 구현은 먼저 Decision Log를 수정한다.
- Codex는 `제안`과 `확정`을 분리해 표시한다.
- 사용자 승인 전에는 새로운 선택지를 코드에 영구 고정하지 않는다.
- 임시 선택은 feature flag, adapter, configuration으로 격리한다.
