# MOEMOA 사용자 결정 질문

> **문서 상태: `MIXED — FOUNDATION + REMOTE METADATA CONFIRMED / REMAINING DECISION QUEUE`**
> TECH/STORAGE와 2026-08-26 확정된 BACKEND/AUTH/SYNC/수정 LEGACY는 결정 이력이다. IMAGE-SYNC/Public/운영 선택지는 사용자 선택과 Decision Log 기록 전에는 확정이 아니다.

작성일: 2026-08-11  
목적: 구현자가 임의로 고정하면 안 되는 선택을 실제 개발 gate 순서로 정리한다.  
사용법: 각 항목의 선택 번호와 보충 조건을 Decision Log에 기록한 뒤 해당 단계로 넘어간다.

## 1. 지금 결정할 항목 요약

`TECH-01`, `STORAGE-LOCAL-01`은 2026-08-11, `BACKEND-01`, `AUTH-01`, `SYNC-01`과 수정된 `LEGACY-01`은 2026-08-26 사용자 승인으로 **CONFIRMED**됐다. 상세 기록은 `decisions/2026-08-11-foundation-decisions.md`와 `decisions/2026-08-26-unified-supabase-user-data.md`를 따른다.

Guest Owner ID와 owner-scoped local namespace는 local slice의 필수 불변조건이며, remote Guest row는 만들지 않는다. 로그인 시 idempotent promotion 뒤 `auth.users.id` 소유 remote row와 local account namespace로 전환한다.

| 상태/결정 시점 | ID | 질문 | 확정값 또는 잠정 권장 |
| --- | --- | --- | --- |
| `[CONFIRMED]` | TECH-01 | Android 구현 방식을 무엇으로 할까? | 2. Capacitor shell |
| `[CONFIRMED]` | STORAGE-LOCAL-01 | Android local image 원본을 어디에 둘까? | 1. 앱 전용 filesystem + DB metadata |
| `[CONFIRMED 2026-08-26]` | LEGACY-01 | 실제 사용자 0명인 legacy를 이전할까? | Production migration/compatibility table 없음 |
| `[CONFIRMED 2026-08-26]` | BACKEND-01 | backend 경계를 어디에 둘까? | 단일 Supabase + read RLS + validated mutation RPC |
| `[CONFIRMED 2026-08-26]` | AUTH-01 | 인증 공급자와 guest 승격을 어떻게 할까? | Google Auth + explicit idempotent promotion |
| `[CONFIRMED 2026-08-26]` | SYNC-01 | 충돌·삭제를 어떻게 처리할까? | entity version conflict + tombstone 우선 + sync sequence |

`IMAGE-SYNC-01`, `STORAGE-01`, `PRIVACY-01`은 user image cloud 작업 전에 결정해야 한다. Public 관련 결정은 private 사용성 검증 이후로 미룬다.

## 2. 확정 적용 규칙 — 선택 불필요

### CARD-01 문서 우선순위

이 항목은 열린 질문이 아니다. `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`가 source hierarchy상 우선하며, Complete Card는 `Anime 또는 PrivateTitle + VisualAsset`이다.

근거:

- 현재 확정 결정은 VisualAsset 1개를 Complete 조건으로 둔다 (`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:22-39`).
- 감사 전 존재한 `docs/product/MOEMOA_PRODUCT_BASELINE.md` 일부는 memory signal 중심으로 기술되어 있다.

적용: VisualAsset 없는 기존 기록은 Draft/LegacyMemorySignal로 유지하고 이전 baseline은 superseded로 표시한다. 사용자가 이 결정을 의도적으로 바꾸려는 경우에만 CARD-01 Decision Log를 먼저 수정하고 모든 flow/schema 문서를 함께 갱신한다.

## 3. G0/G1 — client·cloud 구현 전에 결정

### TECH-01 — Web/Android 기술 방식

상태: **CONFIRMED — 옵션 2, Astro/React + Capacitor shell**

질문: Android 이미지 수집을 어떤 방식으로 구현할까?

선택:

1. PWA/TWA. 가장 빠르고 기존 Web 재사용이 크지만 file/background lifecycle 제어가 약하다.
2. **Astro/React + Capacitor shell — 선택됨.** React UI를 재사용하면서 Share Intent/Photo Picker/filesystem만 native bridge로 처리한다.
3. Kotlin/Compose native. lifecycle 품질은 가장 높지만 Android UI를 새로 만들고 두 client를 유지한다.

확정 후 필요한 spike: 동일 이미지의 공유→앱 전용 복사→process kill→재실행 복구와 중복 intent 테스트.  
남은 차단 범위: Phase 2 ADR/ExecPlan 승인 전 Android project, dependency, App Link, release pipeline 구현 금지.

### BACKEND-01 — API·DB·object storage 경계

상태: **CONFIRMED — 2026-08-26, 옵션 1을 단일 Supabase/RPC 계약으로 구체화**

질문: 두 client가 Supabase에 직접 접근할까, application API를 둘까?

선택:

1. **단계형 — 권장.** private metadata는 Supabase direct + RLS로 시작하고 privileged 작업만 function으로 둔다. multi-entity commit, cloud image, Public/moderation 전에 thin API 전환 기준을 다시 평가한다.
2. Direct Supabase/RLS를 장기 고정. 운영은 단순하지만 sync/orchestration과 validation이 두 client에 분산될 수 있다.
3. 처음부터 thin application API. sync commit, validation, rate limit, audit는 유리하지만 local-first private beta 단계부터 운영 범위가 커진다.

확정 결과: 현재 catalog Supabase project를 Auth/user metadata까지 담당하는 단일 project로 사용한다. Catalog read client와 Auth/user session client는 역할을 분리하고, private read는 owner RLS, mutation은 version·operation·state를 검증하는 RPC를 사용한다. 별도 standalone API는 초기 범위에 두지 않는다.
남은 차단 범위: 승인된 ExecPlan 전 migration/env cutover 금지. User image cloud와 Public/moderation은 별도 gate다.

### AUTH-01 — 인증 공급자, guest→account 승격과 계정 전환

상태: **CONFIRMED — 2026-08-26, 공급자 1 + linking 1 + 명시적 승격**

질문 1: 첫 account beta의 인증 공급자를 어떻게 구성할까?

선택:

1. **기존 Supabase Auth + Google OAuth만 유지 — 재사용 기준 권장.** 현재 Web 구현을 가장 많이 활용한다 (`src/repositories/authRepo.js:40-52`). Android에서는 PKCE callback과 verified App Link, 취소/재시작 복구를 별도 검증한다.
2. Supabase Auth에서 Google + email OTP/magic link를 함께 제공. Google 계정이 없는 사용자 접근성은 좋아지지만 이메일 전달·abuse·support 범위가 늘어난다.
3. 다른 auth provider로 교체. 규정·비용·기존 계정 migration 요구가 확인될 때만 재검토한다.

질문 2: provider를 추가할 경우 동일 사용자의 계정을 어떻게 연결할까?

선택:

1. **첫 beta는 Google 한 개만 사용해 linking을 보류 — 권장.** 먼저 guest 승격과 Android callback을 안정화한다.
2. 로그인된 사용자가 설정에서 추가 provider를 명시적으로 연결. server가 검증한 identity만 연결하고 client가 제시한 동일 email만으로 자동 병합하지 않는다.
3. 동일 email이면 자동 병합. 계정 탈취/잘못된 병합 조건 검증 전에는 비권장.

질문 3: 비로그인 local data가 있을 때 로그인하면 어떻게 할까?

선택:

1. **요약 preview 후 “이 계정에 병합” 명시 동의 — 권장.** 병합 전 export/backup, idempotent operation, 실패 시 guest 보존.
2. 자동 병합 후 undo 기간. 흐름은 짧지만 잘못된 계정 로그인 때 위험이 크다.
3. guest workspace와 account workspace를 계속 분리하고 사용자가 나중에 import. 가장 안전하지만 UX가 복잡하다.

추가 질문:

- 로그아웃 시 이 기기의 계정 data를 유지할지, 제거 선택을 줄지?
- A→B 전환 시 A의 local cache를 잠금 보존할지 완전 제거할지?

확정 결과: Google provider 하나만 사용하고 provider linking은 보류한다. Guest bundle은 backup/manifest/hash 준비 뒤 idempotent operation으로 `auth.users.id` owner에 승격하며 server 성공 뒤 local account namespace로 전환한다. Entity UUID를 유지하고 account 간 자동 병합을 금지한다. Android는 App Link/PKCE 실기기 검증을 통과해야 한다.
남은 차단 범위: 승인된 ExecPlan 전 account schema/promotion 구현과 env cutover 금지. Logout/account switch의 namespace 격리 E2E는 구현 gate다.

### STORAGE-LOCAL-01 — local image 저장 방식

상태: **CONFIRMED — 옵션 1, app-private filesystem + DB metadata**

질문: Android가 받은 이미지의 장기 원본을 어디에 둘까?

선택:

1. **앱 전용 filesystem + DB metadata — 권장.** source URI를 즉시 복사하고 checksum/size/MIME/state만 DB에 둔다.
2. SQLite/DB Blob. transaction은 단순하지만 대용량, backup, memory/DB 팽창 위험이 있다.
3. source URI reference 유지. 구현은 간단하지만 permission 만료와 원본 삭제 때문에 Complete Card 보장이 어렵다.

확정 결과: source URI를 장기 원본으로 유지하지 않고 app-private filesystem에 복사하며 DB에는 VisualAsset metadata를 둔다. 실제 API/directory/DB engine과 transaction 보상은 Phase 2 ADR/ExecPlan에서 구체화한다.  
남은 차단 범위: ExecPlan 승인 전 VisualAsset storage 구현·migration 금지.

### LEGACY-01 — Library/WatchLog/Tier 이전 의미

상태: **REVISED CONFIRMED — 2026-08-26, production migration 없음**

질문: 기존 사용 기록을 새 제품에서 어떤 의미로 보존할까?

선택:

1. **보수적 이전 — 2026-08-11 당시 선택.** Library는 legacy title state, WatchLog는 Draft seed/LegacyMemorySignal, Tier는 legacy read-only 보존. 사용자가 이미지 연결 후 Card를 Complete로 승격한다.
2. 적극적 이전. WatchLog마다 system design image를 자동 생성해 Complete Card로 만든다. Archive가 즉시 풍부해지지만 사용자가 만들지 않은 Card가 대량 생성될 수 있다.
3. 새 workspace로 시작하고 legacy는 별도 import 화면에서 선택. 가장 깔끔하지만 과거 기록 접근성이 떨어진다.

수정 근거: legacy Supabase의 실제 사용자가 0명이었고 사용자가 기존 구조의 production 호환이 필요 없다고 확인했다.
확정 결과: 신규 remote schema에 Library/WatchLog/Tier/snapshot compatibility table을 만들거나 old Auth/row를 이전하지 않는다. 자동 Card/Board 변환도 하지 않는다. 이 결정은 작업 트리나 개발자 local data의 즉시 destructive 삭제 승인이 아니다.
남은 차단 범위: legacy cloud sync 호출은 신규 adapter cutover 계획에서 격리하며 destructive code/data cleanup은 별도 승인한다.

## 4. G1 — metadata sync와 private backup 전

### SYNC-01 — 충돌과 삭제 정책

상태: **CONFIRMED — 2026-08-26, base version conflict + tombstone 우선**

질문: Web/Android에서 같은 entity를 수정했을 때 무엇을 우선할까?

#### Card 본문

1. 최신 `updatedAt` 우선 + 충돌본 자동 backup.
2. **base revision을 비교해 실제 동시 수정일 때 사용자 선택 — 권장.** 일반 변경은 자동, 충돌만 비교 UI.
3. field-level merge. 정교하지만 P0 복잡도가 높고 자유 텍스트 병합이 어렵다.

#### Board 순서

1. 마지막 저장 장치의 전체 순서가 승리.
2. **membership은 set merge, 동일 membership 순서 충돌은 마지막 reorder operation 우선 — 권장.**
3. CRDT sequence. 대규모 동시 편집에는 강하지만 개인용 초기 제품에는 과도하다.

#### 삭제 대 수정

1. 최신 timestamp 우선.
2. **삭제 tombstone 우선, retention 내 복구함 제공 — 권장.** 수정본은 conflict backup으로 보존.
3. 수정이 삭제를 되살림. 의도치 않은 부활 위험이 크다.

확정 결과: normalized entity row, optimistic version, operation ID/request hash, server `sync_seq`를 사용한다. Base version mismatch는 자동 덮어쓰지 않고 사용자 선택으로 보내며 delete tombstone은 stale update보다 우선하고 30일 보존한다.
남은 차단 범위: 승인된 ExecPlan 전 revision/tombstone/RPC schema와 conflict UI 구현 금지.

### IMAGE-SYNC-01 — private image cloud backup

질문: 로그인 사용자의 이미지를 언제 cloud에 올릴까?

선택:

1. **Card metadata sync와 별도로 “이미지도 백업” 명시 opt-in — 권장.** account/device setting + 각 asset 상태 표시.
2. 로그인과 동시에 자동 backup, 최초 동의 1회. 편리하지만 data/비용/권리 인식이 약해진다.
3. P0/P1에서는 image cloud backup 없음. 비용과 위험은 낮지만 Web/다기기에서 image가 비어 보인다.

권장 rollout: 3으로 local validation → 1로 제한 beta.  
추가 질문: opt-out 시 cloud copy만 지우고 local은 유지할지? 잠정 권장 `예`.  
미결정 시 기본값: `LOCAL_ONLY`.  
차단 범위: bucket, upload queue, quota, cross-device availability.

### STORAGE-01 — 이미지 제한과 파생본

질문: 첫 beta에서 어떤 파일을 수용할까?

선택:

1. **JPEG/PNG/WebP, 정적 이미지만; 입력 크기 제한; orientation 적용; metadata 제거; 표준 display/thumbnail 생성 — 권장.** 구체 수치는 spike 후 확정.
2. HEIC/GIF까지 포함. 사용자 편의는 높지만 decoder/animation/storage/test 범위가 커진다.
3. 모든 `image/*`. 보안·메모리·호환성 위험 때문에 비권장.

수치 결정을 위한 표본:

- SEA 중저가 Android 기기의 12~48MP 사진
- anime screenshot의 일반 해상도
- 100/500/2,000 Card archive scroll과 storage 사용량

잠정 시작값: 원본 20MB 이하, decode pixel 상한, display 장변 2,048px, thumbnail 512px. 이 수치는 제품 결정이 아니라 spike 가설이다.  
차단 범위: validation, quota, derivative version, upload cost.

### SOURCE-01 — catalog source 사용 등급

질문: source를 어떤 등급으로 사용할까?

권장 등급:

1. **Direct ingest 허용:** 명시적으로 저장/재배포 가능한 source만.
2. **검증/대조 전용:** ID mapping과 수동 검토에만 사용, field/image를 영구 복제하지 않음.
3. **Runtime lookup:** 화면 시점 외부 요청, cache/표시 조건 명시.
4. **금지:** 조건 불명확/위반 우려 source.

현재 AniList/AniLife/Wikidata의 정확한 등급은 최신 약관·라이선스 검토 전 `UNKNOWN`이다. `aliases.json`은 출처가 없어 `legacy_unverified`로만 사용한다.  
미결정 시 기본값: 공용 catalog 직접 적재 없음, PrivateTitle 허용.  
차단 범위: ingestion, provider image, admin source registry.

### TAG-01 — 태그 체계

질문: 작품 taxonomy와 개인 기억 태그를 어떻게 분리할까?

선택:

1. **3계층 분리 — 권장.** `coreGenre`(서비스 소유 안정 집합), `catalogTag`(source/provenance 포함), `memoryTag`(사용자 private 자유 선택).
2. provider tag를 하나의 공용 목록으로 사용. 빠르지만 source 변경과 의미 drift가 크다.
3. 초기에는 memoryTag만 사용하고 catalog taxonomy를 보류. Card 제품 검증에는 충분하지만 탐색 기능이 제한된다.

권장 rollout: 초기 3으로 시작하되 schema는 1을 수용.  
미결정 시 기본값: 자유 태그를 public/catalog field로 승격하지 않음.  
차단 범위: filter/search, catalog normalization, analytics property.

### DEPLOY-01 — canonical Web 배포

질문: Vercel과 GitHub Pages 중 어느 origin을 canonical로 할까?

근거:

- `vercel.json`이 존재하고 사용자는 Vercel이 `master`와 연결된 것으로 확인했다.
- tracked GitHub Pages workflow도 `master` push에 반응한다 (`.github/workflows/astro.yml:5-13`).

선택:

1. **Vercel canonical — 권장.** GitHub Pages deploy workflow는 disable/manual 또는 preview 전용으로 전환.
2. GitHub Pages canonical. Vercel project를 해제하고 OAuth/PWA origin을 Pages로 통일.
3. 둘 다 운영. canonical/OAuth/SW scope drift 때문에 비권장.

미결정 시 기본값: deployment 설정을 수정하지 않고 release 중단.  
차단 범위: OAuth callback, App Link, canonical/SEO, service worker scope, production analytics.

## 5. G2 — 운영·Public 전환 전

### PRIVACY-01 — 운영 주체, region, 보관과 삭제

질문: 누가 어떤 region에서 얼마나 보관하고 언제 지울까?

#### 1. 출시 전 반드시 채울 사실

아래는 선택지가 아니라 실제 계약·계정 상태를 확인해 값으로 기록해야 한다.

- 법적 운영 주체의 이름/사업자 형태/소재 국가/연락처: `UNKNOWN`
- Supabase project region과 processor 역할: `UNKNOWN`
- Vercel hosting/log region과 processor 역할: `UNKNOWN`
- analytics/error monitoring provider, 수집 항목, region: Vercel page analytics 외 `UNKNOWN`
- object storage와 backup/PITR provider/region: `UNKNOWN`
- 대상 국가별 cross-border transfer 고지와 필요한 동의: `UNKNOWN`

이 값이 채워지지 않으면 cloud image/Public 실사용 launch를 진행하지 않는다. 실제 확인된 provider/region을 문서화하는 것이며 Codex가 임의 region을 선택하지 않는다.

#### 2. 데이터 보관·삭제 정책

선택:

1. **최소 보관표 — 권장.** active account metadata/image는 사용자가 보유하는 동안만, 삭제 tombstone·보안 audit·운영 log·backup은 목적별 정확한 기간을 launch 전에 명시한다. account delete 접수 즉시 접근을 차단하고 row/object/cache 삭제와 backup 자연 만료 시점을 각각 고지한다.
2. 운영 편의를 위한 장기 보관. 항목별 법적 근거, 기간, 사용자 고지와 비용을 별도로 승인해야 한다.
3. cloud 저장을 보류하고 local-only dogfood만 운영. 운영 주체/region/retention을 아직 확정할 수 없을 때의 안전한 기본값이다.

추가로 반드시 숫자로 확정할 값:

- account delete 처리 목표 시간과 완료 통지 방식
- soft-delete/tombstone 보관 일수
- application/security log 보관 일수
- moderation/audit log 보관 일수
- object 삭제 propagation 목표 시간
- backup에서 최종 소거 또는 자연 만료되는 최대 기간

정확한 일수는 법률·보안·복구 필요와 provider 기능을 확인한 뒤 정한다. `18+` 여부는 PRIVACY-01이 아니라 아래 AGE-01에서 결정한다.

미결정 시 기본값: 3, local-only dogfood 외 cloud 실사용자 launch 금지.  
차단 범위: cloud image, analytics, account delete, Public.

### AGE-01 — Public UGC 연령 범위

질문: Public 기능을 누구에게 열까?

선택:

1. **18+ allowlist beta — 권장.** 운영량과 정책을 먼저 검증.
2. 국가별 성년 기준 적용. 정확하지만 지역별 UX/검증이 복잡.
3. 미성년자 지원. 보호자 동의, 기본 privacy, 신고/안전 설계를 추가로 확정해야 함.

미결정 시 기본값: Public off.  
차단 범위: signup/terms, age assurance, moderation, marketing audience.

### MODERATION-01 — 심사 방식과 운영 용량

질문: 제한적 Public을 어떤 심사 모델로 열까?

선택:

1. **allowlist + 첫 게시/고위험 이미지 사전 심사, 이후 신고 기반 — 권장.** 초기 물량을 통제할 수 있다.
2. 전면 사전 심사. 안전하지만 지연과 운영비가 크다.
3. 전면 사후 심사. 빠르지만 screenshot/fanart 초기 서비스에는 위험이 높다.

필수 선행:

- content/user report와 block
- queue, role, audit log
- takedown, appeal, strike/suspension
- public/image kill switch
- 처리 SLA와 당번
- 금지 콘텐츠 정의와 최신 정책 동의

운영량은 다음 네 값을 beta 시작 전에 숫자로 채운다.

```text
예상 신규 Public 제출/일
예상 신고/일
평균 처리 분/건
운영자 가용 시간/일

일 처리 용량 = 운영자 가용 분 / 평균 처리 분
```

1인 운영의 **계획 가설**은 allowlist 30~100명, 신규 Public 제출 최대 20건/일, 평균 3~5분/건, 운영 60~120분/일이다. 이는 관측값이 아니며 첫 주 실제 처리시간과 신고율로 즉시 교체한다. 이 범위를 넘으면 초대/게시 한도를 낮추거나 추가 운영자를 확보한다.

권장 자동 중단 기준:

- 미처리 queue가 하루 처리 용량을 초과
- 가장 오래된 고위험 건이 24시간을 초과
- 신고/제출 비율이 사전 설정 임계치를 연속 2일 초과
- takedown/권리 요청을 SLA 안에 처리할 운영자가 없음

중단 시 새 Public 게시와 해당 image type을 kill switch로 막고 기존 private 기능은 유지한다. 실제 SLA와 임계치는 AGE-01, BETA-01, 운영자 가용시간을 확정한 뒤 Decision Log에 기록한다.

미결정 시 기본값: Public off.  
차단 범위: 공개 Card/Board, follow graph, creator/image promotions.

### IMAGE-PUBLIC-01 — 이미지 유형별 공개 허용

질문: generic UGC gate 통과 후 어떤 이미지부터 공개할까?

선택:

1. **system/text design + 사용자 원본 비팬워크부터 — 권장.** `SYSTEM_DESIGN`, `TEXT_DESIGN`, `USER_ORIGINAL`은 각각 독립 콘텐츠 유형 flag이며 사용자 원본은 원본 확인 동의를 기록한다.
2. 사용자 직접 제작 fanart와 명시 permission/open-license가 있는 기타 media를 추가. `USER_CREATED_FANART` 같은 콘텐츠 유형과 `EXPLICIT_PERMISSION`/`OPEN_LICENSE` rights basis를 별도 축으로 기록하고 creator/source/license 증빙을 요구한다.
3. anime screenshot + third-party fanart를 추가. `ANIME_SCREENSHOT`, `THIRD_PARTY_FANART`는 서로 독립 콘텐츠 유형 gate이며 지역별 법률·정책 검토, 원작자/창작자 권리 처리, 빠른 takedown가 모두 선행되어야 한다.

모든 image type은 새로 추가될 때 default off다. Photo Picker/Share Target은 `intakeSource`, `LOCAL_ONLY`는 `storageScope`이며 콘텐츠 유형이나 rights basis가 아니다. Public 전환은 image type flag, remote availability/storage scope, visibility 동의, rights basis/license 증빙, moderation status, generic UGC gate를 모두 통과해야 한다. Public Board는 포함된 모든 Card/VisualAsset이 이 조건에 적격일 때만 전환할 수 있으며 하나라도 부적격이면 Board 전체를 거부한다.  
권장 rollout: 1 → 별도 법률/운영 검토 후 2 → 유형별로 3.  
미결정 시 기본값: 모든 user image public off; private 보관만 허용.  
차단 범위: publish eligibility, moderation form, promotion/ads 사용.

### BETA-01 — 규모와 성공 기준

질문: 첫 실사용 검증을 얼마나 작게 시작하고 무엇을 성공으로 볼까?

선택:

1. **30~100명 private/local-first beta — 권장.** 국가 1~2개, 2~4주, Public off.
2. 200~500명 multi-country closed beta. localization/device 다양성은 좋지만 support와 데이터 해석이 어려움.
3. 공개 launch. 현재 operational gap 때문에 비권장.

첫 beta의 권장 핵심 지표:

- 첫 세션 Card 완성률
- 이미지 선택 시작→Card 저장 성공률
- 한 사용자의 7일 내 두 번째/세 번째 Card 작성률
- D1/D7 returning creator 비율
- Archive 회상 재방문률
- crash-free session과 image intake 실패율
- export/delete 성공률
- support issue 유형과 해결 시간

수치 target은 prototype baseline 없이 임의 확정하지 않는다. 1주차 관측값으로 기준선을 만들고 2주차 개선 목표를 정한다.  
미결정 시 기본값: 내부 dogfood 10명 이하.  
차단 범위: launch checklist, analytics dashboard, support capacity, 광고 집행.

## 6. 광고·홍보를 시작하기 전 추가 결정

과거 논의의 동남아 Instagram/Meta 광고는 제품 beta 단계와 분리해서 결정한다. 광고 단가가 저렴하더라도 Card 작성/재방문이 검증되지 않으면 저렴한 install만 늘고 학습이 왜곡된다.

### GROWTH-01 — 첫 유료 유입 시점

선택:

1. **30~100명 organic/커뮤니티 closed beta 후 — 권장.** onboarding과 Card completion baseline을 먼저 만든다.
2. prototype부터 소액 광고. creative/message test에는 유용하지만 retention 판단에는 부적합.
3. 일반 공개와 동시에 확대. 현재 단계에서는 비권장.

### GROWTH-02 — 첫 국가

선택:

1. **필리핀 또는 영어 사용성이 높은 단일 시장부터 — 잠정 권장.** English-first UX와 support 학습이 쉬움.
2. 필리핀+싱가포르 2개 시장. 구매력/기기 환경 비교는 가능하나 표본이 갈림.
3. 태국·베트남까지 동시. localization과 메시지 검증을 먼저 해야 함.

국가 선택은 최신 광고 CPM/CPC, Android 기기 분포, 결제/개인정보 요건, 현지화 인터뷰를 launch 직전에 다시 조사해야 한다. 기존에 들은 “동남아 광고가 상대적으로 저렴하다”는 말만으로 예산을 확정하지 않는다.

### GROWTH-03 — 광고 최적화 event

선택:

1. install/landing view
2. signup
3. **첫 Complete Card 저장 — 장기 권장.** 제품 가치와 가장 가깝다.

local-first에서는 광고 platform에 사용자 note/image/title을 보내지 않고 opaque event만 보낸다. 충분한 conversion volume 전에는 landing→Card funnel을 자체 privacy-safe analytics로 측정한다.

## 7. 권장 결정 순서

```text
1. [완료] TECH-01 + STORAGE-LOCAL-01
2. [완료] LEGACY-01, 2026-08-26 실제 사용자 0명 조건으로 production migration 없음으로 수정
   └─ local-only vertical slice 시작
3. [완료] BACKEND-01 + AUTH-01 + SYNC-01
4. IMAGE-SYNC-01 + STORAGE-01 + PRIVACY-01
5. SOURCE-01 + TAG-01
6. DEPLOY-01 + BETA-01
   └─ private beta
7. AGE-01 + MODERATION-01 + IMAGE-PUBLIC-01
   └─ gate 통과 시에만 제한적 Public
8. GROWTH-01~03
```

## 8. 첫 승인 회의용 최소 답변 양식

2026-08-11 기록된 기반 답변은 다음과 같다.

```text
TECH-01: 2, Astro/React + Capacitor shell; spike는 ExecPlan에 포함
STORAGE-LOCAL-01: 1
LEGACY-01: 실제 사용자 0명; production migration/compatibility 없음
BACKEND-01: 단일 Supabase project + read RLS + validated mutation RPC
AUTH-01: Supabase Google Auth + linking 보류 + 명시적 idempotent Guest 승격
SYNC-01: normalized entity version conflict + tombstone 우선 + sync sequence
DEPLOY-01: 1인지 production 확인 후 결정
```

나머지 항목은 `보류` 상태다. 보류된 기능은 adapter/feature flag 뒤에 두고 image cloud/Public 동작을 켜지 않는다. 확정된 remote metadata 설계도 승인된 ExecPlan 전에는 code/schema 구현 승인이 아니다.
