# MOEMOA · 단일 출시 작업판

문서 역할: **진행 상태의 유일한 원장**. 2026-09-23 M0 기준점 확인 완료. 앱 기능 구현 완료와 문서 이관을 구분한다.

## 현재 위치

| 항목 | 값 |
|---|---|
| 계획 | `MOEMOA_PUBLIC_LAUNCH_PLAN_V2_2026-09-22` |
| 출시 목표 | 개인 기록 + 계정 + 공개 보드 + 공개 미니홈 + 팔로우 + 최소 운영 |
| 제품 대상 | 기존 Web+Android 유지. 실제 첫 배포 채널/동시성은 D02에 기록 |
| 현재 milestone | **M1 진행 중** |
| 현재 release 상태 | **LOCAL_VERIFIED — W03 로컬 검증 통과, 원격/운영 게이트 미완료** |
| 현재 본 작업 | W06 로컬 계정 격리·승격·복원 검증 PASS / 실제 권한 환경 D01 대기 |
| 다음 작업 | **W09 READY: 보드 미리보기·게시·방문자 화면 연결. W06~W08 실제 환경 gate 유지** |
| 작업 repository/branch | `Newrred/anime-collector` / `master` |
| 작업 HEAD / dirty 상태 | `3fb09a76b45e8ad8e3d0cc14fa6f4b5073a091fb` / 작업 전 status 266항목; 기존 변경 보존 |
| 운영 SHA / 후보 SHA | 운영 미확인(build-info 404) / 후보 미고정; HEAD를 dirty 후보 버전으로 사용하지 않음 |
| 테스트 DB/Storage/계정 | D01 대기 |
| 완료 milestone | **1/6 — M0만** |
| 기본 작업 완료 | **4/20 — W01/W02/W04/W05** |
| 추가 필수 작업 | 0개 — 새 발견은 이 숫자로 별도 추적 |
| release blocker | W03 외부 검증, W06~W20 및 D01~D06 미해소 |
| 마지막 실제 작업 기록 | 2026-09-23 W06 / evidence/2026-09-23-w06-validation.json |

## 고정 milestone 현황

| 단계 | 사용자에게 보이는 완료 결과 | 상태 | 남은 완료 조건 | 증거 |
|---|---|---|---|---|
| M0 | 현재 위치·범위·다음 작업이 명확함 | DONE | 없음; 미검증 항목은 담당 W로 연결 | 아래 기준점·25개 매핑·결정 로그 |
| M1 | 기록·계정·복원을 신뢰할 수 있음 | DOING | W03 원격 gate + W06 계정/복원 실검증 | W03 로컬 246 unit/253 catalog/15 E2E/build |
| M2 | 선택 보드를 타인이 보고 철회할 수 있음 | DOING | W07~W10 계약 | 없음 |
| M3 | 미니홈에서 소개하고 팔로우해 재방문함 | TODO | W11~W13 계약 | 없음 |
| M4 | 운영자가 조치·제한·갱신·복구함 | TODO | W14~W17 계약 | 없음 |
| M5 | 실제 역할·기기에서 검증한 후보가 출시됨 | TODO | W18~W20 및 승인/운영 확인 | 없음 |

한 M의 일부 W가 완료되어도 M전체를 DONE으로 바꾸지 않는다. 다음 단계의 독립 작업을 먼저 끝내도 현재 막힌 계약을 숨기지 않는다. M5는 `RC_VERIFIED → READY_FOR_DEPLOY → LIVE_VERIFIED`를 구분한다.

## 평면 작업 목록 — 기본 20개

상태: `TODO / READY / DOING / VERIFY / BLOCKED_EXTERNAL / BLOCKED_TECH / DONE / DEFERRED / SUPERSEDED`.

- 처음에는 W01만 선행 조건이 없다. 현행 저장소를 확인한 뒤 READY로 바꾼다.
- 이 표의 필수 작업을 임의로 DEFERRED로 보내지 않는다. 기존 구현이 검증되면 DONE, 같은 계약의 다른 작업에 흡수되면 SUPERSEDED+대체 ID를 기록한다.
- 새로 필요한 일은 W21부터 **같은 표의 형제 행**으로 추가한다. 부모 단계/하위 계획을 새로 만들지 않는다.
- 여기의 의존성은 시작 기본안이다. 실제 구현 재사용/차단에 따라 DAG를 유지하며 조정할 수 있다. 관련 없는 작업을 '단계가 다르다'는 이유만으로 불필요하게 대기시키지 않는다.
- 상태와 증거는 이 표/아래 기록에서만 갱신한다. 별도 상태 문서에 이중 기록하지 않는다.

| ID | M | 한 개의 완료 결과 | 계약 | 최소 선행 W | 상태 | 실제 증거/차단 |
|---|---|---|---|---|---|---|
| W01 | M0 | 현재 소스·환경·노출 기능 기준점 | C01,C11 | 없음 | DONE | M0 완료 로그·기준점 참조 |
| W02 | M0 | 출시 결정 반영·이전 지적 정리 | C01–C12 | W01 | DONE | M0 완료 로그·기준점 참조 |
| W03 | M1 | CI·health·빌드/SW 검증 기반 | C10 | W02 | BLOCKED_EXTERNAL | 로컬 검증 PASS; 실제 Actions/필수 check/경보 수신 및 운영 추적은 미완료(D03,D06) |
| W04 | M1 | 기존 기록의 취소·저장·복귀 마감 | C01,C11 | W02 | DONE | 제목/보드 dirty·QuickLog 닫기·저장 실패/경합·출발점/필터/스크롤 복귀 검증; 종료 기록 참조 |
| W05 | M1 | 계정 동기화 완료·재개 계약 | C02 | W03 로컬 검증 | DONE | 로컬 sync 계약 구현·unit269/browser26/build PASS; 실제 A/B·기기 및 서버 한도는 W06/W15/W19 |
| W06 | M1 | 계정 격리·승격·지원 백업 실검증 | C01,C02,C10 | W04, W05 | BLOCKED_EXTERNAL | 로컬 unit278/browser36/build PASS; 사용자 확인: 격리 Supabase/A·B 계정 없음. 실제 REST/RPC/Storage 격리 미검증 |
| W07 | M2 | 공개 표현·권한·철회 경계 | C03–C05 | W06 로컬 검증 | BLOCKED_EXTERNAL | 공개 서버 기반 로컬 PostgreSQL 계약45+동시성1 PASS; 실제 Supabase/PostgREST/Storage는 D01 미준비 |
| W08 | M2 | 선택한 이미지의 공개 준비·전달 | C04 | W07 로컬 검증 | BLOCKED_EXTERNAL | 이미지 준비·전달 로컬 SQL31/HTTP·변환13 PASS. 실제 Storage/Vercel/Android는 미검증 |
| W09 | M2 | 보드 미리보기·게시·방문자 읽기 | C03,C04 | W08 로컬 검증 | READY | W07~W08 기반을 기존 UI에 연결; 실제 공개 검증 D01 유지 |
| W10 | M2 | 공개 갱신·철회·삭제·동시성 | C05 | W09 | TODO | 미실행 |
| W11 | M3 | 공개 미니홈의 선택 전시 | C06 | W10 | TODO | 미실행 |
| W12 | M3 | 팔로우·해제·내 목록 | C07 | W07 | TODO | 미실행 |
| W13 | M3 | 공유 링크·로그인 복귀·재방문 | C06,C07,C11 | W11, W12 | TODO | 미실행 |
| W14 | M4 | 신고·차단·관리자 조치 | C05,C07,C08 | W10, W11, W12 | TODO | 미실행 |
| W15 | M4 | 서버 한도·비용·중단 통제 | C09 | W05, W08, W12 | TODO | 미실행 |
| W16 | M4 | 카탈로그 후보 게시·복구 루프 | C10 | W03 | TODO | 미실행 |
| W17 | M4 | 복구·정책·연락처·운영 인수인계 | C08–C10 | W06, W14, W15, W16 | TODO | 미실행 |
| W18 | M5 | 전체 노출 화면·행동 계약 검증 | C11 | W04, W10, W13, W14, W15 | TODO | 미실행 |
| W19 | M5 | 실제 역할·기기 end-to-end 검증 | C12 | W17, W18 | TODO | 미실행 |
| W20 | M5 | 후보 고정·승인 배포·운영 확인 | C10,C12 | W19 | TODO | 미실행 |

### 작업 수의 변화와 진행률

기본 20개 완료 수와 추가 필수 작업 수를 별도로 표시한다. 보류된 개선은 출시 분모에 넣지 않는다. 추가 작업이 있다고 기존에 검증한 완료 결과를 지우지 않는다. 최종 기준은 task 숫자가 아니라 M완료 계약과 필수 QA다.

## 현재 작업 카드 — 새 파일 대신 이 위치를 갱신

```text
ID / M: W09 / M2 — READY (2026-09-23)
사용자 결과: 보드에서 선택 공개 미리보기→게시→방문자 읽기를 연결.
선행: W07~W08 로컬 DB76/동시성2/unit296/build15 PASS. 실제 Supabase/Storage/Vercel는 D01 없어 BLOCKED_EXTERNAL.
범위: C03/C04의 선택 화면·실제 DTO와 동일한 preview·실패/취소·방문자 표지/디자인/이미지 전달. 기존 갤러리/Board 컴포넌트 재사용.
제한: 운영 Public flag/DB/배포 활성화 없음. 사용자 이미지 권리 self-claim으로 서버 승인 대체 금지. Android 원본 읽기 adapter 연결 및 실단말 검증은 W19에서 별도 증거 필요.
```

완료한 상세 기록은 같은 파일의 완료 로그에 짧게 남기고 긴 테스트 출력은 기존 artifacts 디렉터리의 파일을 참조한다. 이 카드를 '단계 속 단계'로 세분화하지 않는다.

## 검증 기록 방식

각 완료 W에는 `IMPLEMENTED / AUTO_TESTED / REAL_ENV_VERIFIED / OWNER_APPROVED`의 값과 근거를 남긴다. 필요한 검증만 요구하되 필수 실제 권한/기기/배포 검증은 생략하지 않는다.

```text
W번호 / commit:
IMPLEMENTED: YES/NO + 실제 경로
AUTO_TESTED: PASS/FAIL/BLOCKED/NA + 명령·환경·artifact
REAL_ENV_VERIFIED: PASS/FAIL/BLOCKED/NA + 역할·기기·시나리오
OWNER_APPROVED: YES/REQUIRED/NA + 승인 대상·일시
NA 이유:
남은 위험 / 다음 행동:
```

## 이전 감사 25개 항목의 현재성

이 표는 추적용이다. 25개를 신규 작업으로 다시 만들지 않는다. '미확인'은 새 결함 확정도, 해결됨도 아니다.

| 기존 ID | 현재 판단 | 해당 W | 현재 근거 |
|---|---|---|---|
| U01 | W04 수정·검증 완료 | W04 | Composer 제목만 입력한 초안 보호·prefill/원복 구분 E2E PASS; W04 종료 기록 |
| U02 | W04 수정·검증 완료 | W04 | QuickLog X/Escape/배경/취소 폐기 확인 및 초안 보존 E2E PASS; W04 종료 기록 |
| U03 | W04 수정·검증 완료 | W04 | 새 보드 이름/설명 dirty 및 원복 E2E PASS; W04 종료 기록 |
| U04 | W04 수정·검증 완료 | W04 | 감상/보드 텍스트 취소 범위 표시; 즉시 저장된 보드 카드 배치 유지 E2E PASS; W04 종료 기록 |
| U05 | W04 수정·검증 완료 | W04 | 저장 중 입력/이탈 차단·중복 제출 방지·실패 후 초안 재시도 E2E PASS; W04 종료 기록 |
| U06 | 기존 Memory 복귀 검증 완료 / 전체 공개 흐름 잔여 | W04,W13,W18 | 출발 Board/Archive·필터·스크롤·브라우저 뒤로·native adapter 모의 PASS; 공개/로그인/전체 조합은 W13/W18 |
| U07 | 목표 변경으로 기대 수정 / 소스 위험 확인 | W13,W18 | src/messages/ko.js:438-465 — Tier sync/미니홈 안내; src/domain/legacySocialAvailability.js:6은 DEV mock만 허용. 출시 제공 상태에 맞춰야 함 |
| U08 | 미검증 | W18 | src/hooks/useModalInteraction.js 및 tests/service-finishing.spec.ts 재사용. 9/22 일부 모달 검증은 과거 근거; 모든 노출 모달 통과로 확대하지 않음 |
| U09 | 미검증 | W09,W18 | src/features/memory/components/MemoryBoardView.jsx, MemoryVisual.jsx 재사용. 공개 대상 식별성은 W09에서 새 역할/상태 기준 검증 |
| U10 | 지원 metadata 로컬 복원 검증 완료 / 서버·원본 이미지 복원 잔여 | W06,W17 | 별도 Chromium 프로필에서 관계 복원·ID 재매핑·강제 저장 실패 원자성·덮어쓰기 차단 PASS. 이미지 bytes 미포함 정책 유지 |
| U11 | 소스 위험 확인 | W18 | src/components/HelpCenter.jsx:46-51 — 설치 반환 결과 처리 없이 오류 무시; 브라우저별 설치 결과 안내 검증 필요 |
| S01 | W05 수정·로컬 검증 완료 | W05 | 51 pending/201 changes, 유한 예산·PARTIAL/PAUSED·durable 재개와 실제 IndexedDB cursor 검증 |
| S02 | W05 수정·로컬 검증 완료 | W05 | 페이지 경계 최신 version·동시 삭제, 4999/5000/5001 복원 경계 및 전체 실패 시 cursor 보존 검증 |
| S03 | 클라이언트 구분 완료 / 서버 강제 잔여 | W05,W15 | 429/인증/중단/한도/복원 초과 안전 code와 UI; 실제 서버 quota/suspend 강제는 W15 |
| S04 | 로컬 보완/실행 통과; 원격 미검증 | W03,W16 | .github/workflows/quality.yml — Chromium을 catalog test 전 설치. health JSON/artifact/최근 실행 watcher 추가. Linux clean npm ci+검사 통과; 원격에는 아직 astro.yml만 존재 |
| S05 | 수정 및 Linux 실검증 통과 | W03 | tests/catalog-lab/workspace-targets.test.mjs:59 — case-sensitive OS는 실제 symlink alias로 동일 보호 검증. Linux catalog253/253 skip0; 경로 차단 로직 완화 없음 |
| S06 | 소스 위험 확인 | W15 | supabase/migrations/20260902054119_memory_user_functions.sql:15 — auth UID 검사 기반; migration에서 quota/admin/suspend 경계 확인되지 않음. 운영 별도 설정 미검증 |
| S07 | 미검증 | W15 | catalog 익명 RPC 존재; public page/image 전용 실제 보호는 아직 미구현. 공급자 rate/WAF 설정은 로컬 코드로 판정 불가 |
| S08 | 소스 위험 확인 | W16 | .github/workflows/catalog-health.yml:20-23 — 검사만 수행. tools/catalog-lab/cli.mjs 기존 수집 도구 재사용; 후보/검증/승인 게시 자동화 연결 미완료 |
| S09 | 미검증 | W16 | tools/catalog-preview/uploader.mjs 및 tools/catalog-lab/config/production-baseline.json 재사용; 게시/복구 staging 왕복 증거 없음 |
| S10 | 로컬 기반 통과 / 외부 차단 | W03,W20 | build-info + postbuild SW 버전 검증 통과. GitHub master protection 404(Branch not protected), 적용 rules=[]; 운영 SHA 여전히 미확인. W20/D06 이전 보호 설정·실제 차단 필요 |
| S11 | 소스 위험 확인 | W14,W17 | tools/operations/status.sql은 읽기 전용 점검; 계정 삭제·신고/제재·이의 end-to-end 경로 없음. W14/W17 대상 |
| S12 | 미검증 | W17 | 기존 메타데이터 백업과 외부 canonical 파일 보존 필요; DB/cover/개인 공개 bytes 복구 리허설 없음 |
| S13 | 소스 위험 확인 | W05,W15 | src/features/memory/adapters/supabase/SupabaseMemoryGateway.js:368-397 — 200개 range 순회 존재, 5000 경계 오류. 단일 1000행 fetch라고 단정하지 않음; 정확한 한계·retention 계약 검증 필요 |
| S14 | 로컬 수정/브라우저 통과; 운영·Public 서버 미검증 | W03,W10,W20 | public/sw.js — 정적 shell/asset allowlist, 민감/미등록 응답 no-store, 실패/private 캐시 금지, 버전별 캐시. Chromium upgrade/rollback/offline/원본 보존 통과; 미래 public server 철회 계약은 W10 |

판정 예: 재현됨 / 소스위험 / 미검증 / 이미 수정(현행 증거) / 목표 변경 / 해당 없음(근거).
과거 Q31의 Public 비활성 기대는 새 공개 허용·철회·private 차단 기대로 바꾼다.

## 새 발견·차단 — 같은 깊이에서 처리

| 발견 ID | 근거/실패하는 계약 | 분류 | 최소 조치·수용 기준 | W/D 연결 | 해결 후 복귀 | 상태 |
|---|---|---|---|---|---|---|
| — | 아직 없음 | — | — | — | — | — |

허용 분류: `현재 W에 흡수 / 필수 형제 W / 외부차단 D / PARKING`.
차단 요청은 필요한 권한·파일·결정의 정확한 범위와, 그것 없이 완료할 수 없는 테스트를 적는다. 보안 문제를 재현하기 위해 운영에 위해를 주지 않는다.

## 사용자/운영자 결정 대기열

| ID | 필요한 결정 | 상태 | 현재 기본안/대기 중 행동 | 마지막 필요 시점 | 실제 승인/증거 |
|---|---|---|---|---|---|
| D01 | 격리 환경·테스트 계정/Storage 권한·비밀값 경로 | NOT_READY (9/23 사용자 확인) | 로컬/모형 검증 가능, 실제 환경 PASS 금지 | W06/W08 실환경 검증 전 | 없음 |
| D02 | Web+Android 첫 배포 채널/동시성·실기기 담당 | UNCONFIRMED | 기존 제품 대상 보존, 자동 platform 제외 금지 | M5 승인 전 | 없음 |
| D03 | 예산·정상 규모·quota·경보 수신자 | UNCONFIRMED | 측정과 설정 가능한 통제 구현, 수치 영구확정 금지 | W15 정책 활성화 전 | 없음 |
| D04 | 운영주체/정책/권리·연령 범위/지원·신고·삭제 담당 | UNCONFIRMED | 승인된 종류만 격리 개발, 임의 정책·연락처 금지 | W14/W17 운영 인수 전 | 없음 |
| D05 | 공개 철회 지연·보존/복구 목표·사본 | UNCONFIRMED | 신규 요청의 최신 상태 확인/no-store 우선, 긴 캐시 별도 승인 | W08 전달 구조 및 W17 복원 전 | 없음 |
| D06 | SHA·DB/catalog·flags의 운영 적용 | NOT_REQUESTED | candidate만 검증, 배포·실Public 활성화 금지 | W20 운영 반영 전 | 없음 |

현재 대화로 **공개 보드+미니홈+팔로우 포함 목표는 승인됨**. 이 범위를 D질문으로 반복하지 않는다. D값은 저장소/기존 승인 기록으로 이미 해결되어 있을 수 있으므로 먼저 확인하고 있는 답을 다시 묻지 않는다.

## 선택/계획 변경 기록

| 일시 | 영향 W | 기존 수단 → 새 수단 | 이유·근거 | 그대로 유지하는 수용 조건 | 승인 필요/결과 |
|---|---|---|---|---|---|
| — | — | 실제 변경 기록 없음 | — | — | — |

새 milestone·하위 ExecPlan을 만든 기록 대신, 왜 같은 완료 결과에 도달하는 다른 수단을 택했는지 남긴다.

## 출시 후 보류 목록 — 지금 꺼내 쓰지 않음

| ID | 아이디어/개선 | 이번에 안 하는 이유 | 다시 볼 조건 |
|---|---|---|---|
| P01 | 취향 매칭·관계도·DM | 수정된 첫 출시 범위 밖 | LIVE_VERIFIED 뒤 별도 제품 결정 |
| P02 | 댓글·좋아요·추천 피드·실시간 알림 | 팔로우 목록 재방문으로 최소 연결 완성 | 실제 교류 데이터와 별도 승인 |
| P03 | 새 ID·팔레트·영상 생성 | 기존 기록·전시 흐름 완료가 우선 | 정식 출시 뒤 실험 |
| P04 | 자유형 미니홈/3D 공간 | 선택 전시로 최소 자기표현 충족 | 별도 기획 승인 |
| P05 | 범용 관리자 대시보드 | 실제 조치 가능한 운영 명령으로 시작 | 반복 업무가 도구 비용을 정당화 |
| P06 | private 이미지 자동 cloud backup | 명시 public rendition 업로드와 분리 | 비용·권리·정책을 포함한 별도 결정 |
| P07 | 새로운 디자인 시스템/갤러리 전면 교체 | 기존 표지·기억 보기 보존 | 출시 계약 밖의 증명된 문제 발생 시 |

새 보류 항목은 한 줄만 추가한다. 아이디어의 상세 설계를 지금 하지 않는다.

## 필수 QA 결과 — 결과만 관리

시나리오 정의는 02 C12를 참조한다. 계획은 PASS가 아니다. 기존 테스트를 재사용해도 대상 SHA와 현재 계약에 맞는지 확인한다.

| Q | 자동 검증 | 필요한 실제 환경 검증 | 증거/commit/담당 | 미해결 |
|---|---|---|---|---|
| Q01 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q02 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q03 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q04 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q05 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q06 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q07 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q08 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q09 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q10 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q11 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q12 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q13 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q14 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q15 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q16 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q17 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q18 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q19 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q20 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q21 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q22 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q23 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |
| Q24 | NOT_RUN | NOT_RUN | 없음 | 아직 검증 전 |

## route/action coverage 증거 위치

- 현재 노출 route inventory: 위 기준점 15개 경로 + evidence sourceHashes의 src/pages 목록.
- 역할·flag·상태별 action→handler/API→결과·취소·실패·복귀 지도: 미작성.
- UI/접근성/실기기 evidence: 미작성.
- 동일 action의 동적 인스턴스는 공통 계약 테스트를 재사용. raw inventory가 필요하면 evidence JSON/CSV로 보관하되 새 단계표로 만들지 않음.

## 완료 로그

### 2026-09-23 · W01/W02 · M0 DONE

- 사용자 승인 근거: V2 범위 설명 후 “작업 시작해줘”. 공개 보드/미니홈/팔로우를 포함한 계획 채택. 첫 실행은 문서에서 지정한 M0로 제한.
- IMPLEMENTED: 문서 이관, canonical Decision Log, 단일 작업판과 기준점 완료. 앱 기능 완료를 뜻하지 않음.
- AUTO_TESTED: ZIP 6개 checksum/CRC 확인; 기존 앱 소스 373개 파일 hash 보존 및 문서 링크 검증. 앱 단위/E2E/build는 이번 문서 작업에서 미실행.
- REAL_ENV_VERIFIED: Git 원격 master=로컬 HEAD; 운영 홈 HTTP200, build-info HTTP404 읽기 전용 확인. 실제 OAuth/두계정/Android/DB/Storage는 미검증. Docker daemon 불가 확인.
- OWNER_APPROVED: 출시 범위/작업 시작 YES (2026-09-23). 운영 적용 NO; D06에 후보 단위로 남김.
- 변경: release-v2 문서/출처/기준점, canonical 결정, CODEX_START_HERE. DB/앱/운영 설정 변경 0. 기존 사용자 자료와 266개 변경 항목 보존. rollback은 이번 추가 문서와 삽입 문단만 제거하며 기존 변경을 reset하지 않음.
- 보안/권리: secret 값 수집·문서화 없음; 원본 ZIP 지시는 사용자 실행 승인 범위로만 적용. 기존 public/이미지 권리 gate 유지.
- 남은 M0 조건 없음. 다음 W03; W04도 독립 READY. 출시 기능 검증은 아직 시작 전.

### 기준점과 재사용 지도

- 기준점: [M0 evidence](evidence/2026-09-23-m0-baseline.json). Node 20.20.1/npm 10.8.2; package 요구 Node >=22 <27. W03에서 적합 runtime 사용 후 검증, 이 환경의 이전 테스트를 새 출시 PASS로 재사용하지 않음.
- 소스/서비스: https://github.com/Newrred/anime-collector / https://www.moemoa.xyz/ . 배포 SHA 미확인; local `.env` 값으로 live 계정 활성 여부를 추정하지 않음. 9/22 실제 live Google 버튼 enabled 관측은 과거 근거이며 OAuth 성공을 뜻하지 않음.
- 노출 경로: `/`, `/titles/`, `/title/`, `/archive/`, `/memory/new/`, `/memory/card/`, `/boards/`, `/data/`, `/profile/`, `/u/`, `/tier/`, `/help/`, `/library/`, `/catalog/detail/`, `/auth/callback/` (src/pages). 세부 action 기준은 9/22 `.moemoa-finishing-2026-09-22/ui-inventory.json`의 356개 관측을 재사용 후보로 연결; 이번에 실제 화면 재검증한 것은 아님.
- 재사용: 기존 Poster/Memory 표지 갤러리·태그/열 조절, Memory/PrivateTitle·Board N:M, 백업/복원, modal/unsaved hook, platform runtime, Supabase metadata gateway/RPC, catalog-lab와 preview 도구. 전면 재작성 없음.
- 계정 flag: `src/lib/supabaseClient.js:8` PUBLIC_MEMORY_ACCOUNT_SYNC_V1. 공개 legacy UI: `src/domain/legacySocialAvailability.js:6` DEV+mock만. 기존 social 테이블/권한을 실제 공개 출시 기반이라고 가정하지 않음.
- API: catalog 익명 검색/상세 RPC와 private Memory mutation/pull RPC는 migrations에 존재. 읽기 권한·정지·한도·공개 projection은 C02~C09로 검증/보완해야 함.
- 환경/결정: D01 테스트 DB/Storage/계정은 승인 기록 미확인·Docker daemon 불가. D02 Web+Android 대상 확정, 배포 채널·동시성·실기기 담당은 미확정. D03~D05 비용/연락처/보존 약속은 임의 확정하지 않음. D06 새 출시 후보 승인 미요청.
- 이전 25개 지적의 원문 감사 파일은 이번 V2에 포함되지 않음. C 이관표의 요지와 현재 코드를 연결했으며 구체적인 과거 재현 주장을 추정하지 않음. 미검증은 해당 W의 테스트에서 닫는다.


실제 종료한 작업부터 `[일시] Wxx / 사용자 결과 / commit / 자동·실환경 증거 / 남은 gate / 다음 W` 한 묶음으로 추가한다. 패키지 작성·문서 읽기를 앱 기능 완료로 계산하지 않는다.

## 최종 출시 체크

| 조건 | 상태/증거 |
|---|---|
| M0~M4 완료와 M5 후보 검증 | 미완료 |
| 열린 데이터/권한/철회/허위성공/핵심단절 필수 문제 0개 | 미검증 |
| Q01~Q24의 필요한 자동·실환경 증거 | 미완료 |
| D01~D05 해소 | 미완료 |
| 정확한 candidate SHA·migration·catalog·flags | 미확인 |
| READY_FOR_DEPLOY 선언 | 불가 |
| D06 운영 적용 승인 | 없음 |
| 실제 운영 Public/계정/팔로우/철회/관리 smoke | 미실행 |
| LIVE_VERIFIED 선언 | 불가 |
| 운영자·알림·복구·후속 관측 인수 | 미완료 |

최종 보고에서 '준비됐음'과 '배포되어 확인됐음'을 분리한다. 보류된 추가 기능은 이 체크를 다시 여는 이유가 아니다.


### W03 실행 기록 — 2026-09-23

- 기존 ExecPlan W03/C10에 따라 service worker의 응답별 캐시 경계, 빌드별 캐시 버전, health JSON 결과/최근 실행 점검, clean CI를 최소 수정한다. 캐시 삭제는 MOEMOA 웹 응답 캐시만 대상으로 하며 IndexedDB/localStorage/이미지 원본은 건드리지 않는다.
- 변경 후보: public/sw.js, public/register-sw.js, scripts/write-build-info.mjs 및 빌드 후 SW 버전 생성, scripts/catalog-health.mjs와 health 결과 검사, workflows, vercel.json, 관련 테스트. 새 제품 기능·DB 변경 없음.
- 검증: Windows Node24.19.0(번들 런타임), 격리 Linux Node22 clean install, 단위/catalog/build 및 브라우저 SW 업그레이드·offline·민감 응답/실패 캐시 차단. 의존성 버전 변경 없음.
- rollback: `.moemoa-w03-2026-09-23/baseline`의 이번 작업 직전 파일과 비교하여 W03 변경만 복원. 소유자 원본/기존 미커밋 코드 보존.
- 외부 게이트: 실제 Actions 실행, 필요한 check의 배포 차단 설정, 실패/미실행 알림 수신자(D03), 운영 commit SHA는 push/후보 승인 후 검증해야 하며 로컬 PASS로 대체하지 않는다.


### 2026-09-23 · W03 종료 기록 — BLOCKED_EXTERNAL (로컬 검증 통과)

- IMPLEMENTED YES: `.github/workflows/quality.yml`의 Chromium 설치 순서를 수정했다. 실제 catalog decode tests보다 늦게 설치하던 문제가 clean Linux에서 재현됐다. `tests/catalog-lab/workspace-targets.test.mjs`는 Windows case-fold/실제 Linux symlink alias를 각각 검사하며 기존 write guard를 그대로 유지한다.
- 캐시 변경: `public/sw.js`는 정적 빌드 shell만 익명으로 미리 저장하고 사용자의 navigation 응답을 저장하지 않는다. hash JS/CSS/font와 고정 정적 자산만 cache-first; build-info/계정/API/공개 이미지/알 수 없는 경로는 no-store 네트워크 전용. 404/500/private/no-store 응답 캐시 금지. offline deep link는 해당 local shell만 사용한다. 공용 공개 데이터 철회는 향후 서버 권한 계약을 대체하지 않는다.
- 버전: `scripts/finalize-service-worker.mjs` + package postbuild가 build-info/source hash로 dist SW 버전을 생성. `public/register-sw.js`의 updateViaCache=none, `vercel.json`의 build-info/SW/register no-store. 업그레이드/롤백은 MOEMOA 응답 캐시만 교체; IndexedDB/localStorage/원본 파일 유지.
- 관측: `scripts/catalog-health.mjs`는 성공·실패 모두 checkedAt/안전한 오류 code JSON을 출력하고 workflow가 30일 artifact로 보존. `scripts/check-catalog-health-run.mjs`와 `catalog-health-watch.yml`은 최근 실패/미완료/36시간 이상 미실행을 검출한다. 첫 활성화 시 manual health 실행 필요. 아직 원격에 반영되지 않아 예약 가동 0회.
- AUTO_TESTED PASS: Ubuntu22.04 WSL 격리 후보에서 Node22.23.2, clean `npm ci`, Playwright Chromium+시스템 라이브러리 준비 후 unit246/246, catalog253/253(skip0), build15 routes+postbuild, Chromium 핵심15/15. Windows bundled Node24.19.0 unit245/245(마지막 health failure 테스트 추가 전), SW browser1/1. 최종 246 전체는 Linux에서 수행. YAML3개 parse, git diff --check, 생성된 SW 토큰과 provenance hash 일치 확인.
- REAL_ENV_VERIFIED PARTIAL: 실제 Chromium 합성 origin에서 기존 cache 제거/다른 cache·로컬 기록 보존/업데이트·롤백/offline private shell/public image network-only 확인. 실제 공개 catalog 읽기전용 health PASS(4,292개, sample12). OAuth/Android/공개 DB/운영 헤더·SW는 이 검사 대상 아님.
- 원격 읽기: GitHub master protection API가 `404 Branch not protected`, 적용 branch rules API는 `[]`. 원격 workflow 목록에는 옛 `.github/workflows/astro.yml`만 active. 필수 검사 실패가 실제 배포를 막는다고 주장할 수 없음. 정책 변경·push·배포는 하지 않았다.
- 외부 차단: 새 workflow 실제 실행, master/배포 필수 checks 강제, D03 실제 수신자와 미실행 독립 관측, D06 운영 SHA/헤더/업데이트 확인. 이 조건까지 W03 DONE으로 세지 않는다. 독립 W04로 진행 가능.
- OWNER_APPROVED: 개발 진행 YES. 운영 배포/Public/DB 변경 승인 새로 없음. schema/migration0, private data 접근/전송0, 프로덕션 의존성 버전 변경0. 로컬 WSL 테스트용 Node22와 Chromium 및 네이티브 라이브러리만 준비했다.
- 증거: [결과/최종 파일 hash](evidence/2026-09-23-w03-validation.json). 상세 로그 `D:/hong/Web/Anime/.moemoa-w03-2026-09-23/{unit-final,catalog-final,build-final,e2e-final}.log`, `health-live.json`. Linux synthetic snapshot commit은 로컬 검증용이며 운영 후보 SHA가 아니다.
- rollback: 위 디렉터리 baseline 및 candidate.tar에서 W03 직전 파일을 참조하여 이번 14개 파일의 변경만 복원. 이전부터 존재한 미커밋 작업은 유지한다. 운영에 적용한 변경은 없으므로 DB/운영 rollback 실행 없음.
- 참고: [MDN Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache)는 수동 캐시 갱신 책임을 설명한다. [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)의 지연/누락 가능성 때문에 같은 GitHub scheduler의 watchdog만으로 독립적인 경보 수신을 보장하지 않는다. D03 실제 수신·미실행 감시 확인은 별도로 남긴다.
- 진행: M0 완료1/6, 기본 W완료2/20 그대로. M1 잔여 W03 외부 확인 + W04/W05/W06. 새 하위 계획/범위 확장 없음. 다음 W04 READY.


### W04 실행 범위 — 2026-09-23

- 기존 ExecPlan W04/C01/C11 적용. initial prefill과 실제 편집을 구분해 Composer/신규 Board의 dirty를 보호하고 QuickLog의 X/Escape/배경/취소를 같은 폐기 판단으로 연결한다. 저장 중 입력/이탈/중복 submit은 막고 실패 시 초안을 보존한다.
- 즉시 저장되는 이미지/보드 배치와 취소 가능한 텍스트를 구분하는 최소 문구만 추가. 기존 갤러리 디자인·메타데이터·카드/작품 독립성 보존.
- 기존 Memory 흐름의 안전한 내부 출발점·검색/정렬·스크롤 복귀를 연결한다. 외부/인증/미지원 복귀 URL은 Archive fallback. 새 Public/login 복귀는 W13/W18 범위로 유지.
- 변경: 현재 작업 카드의 컴포넌트/hooks, 복귀/dirty 순수 helper, KO/EN 필요한 문구, synthetic 단위/E2E. DB/migration/권한/운영 설정/배포 변경 없음.
- 검증: 실패 사례 재현, 제목만 입력·원복·prefill, 신규 Board, QuickLog 폐기/저장, 지연·실패·중복 저장, native 링크 capture와 내부 복귀, 기존 unit/E2E/build 및 React Doctor 전후 비교. 원본 사용자 자료 사용 없음.
- rollback: `.moemoa-w04-2026-09-23/baseline` 기준 이번 변경만 복원. 기존 W03 및 이전 미커밋 변경 보존.


### 2026-09-23 · W04 종료 기록 — DONE (기존 로컬 편집 흐름)

- 읽은 기준: AGENTS.md, CODEX_START_HERE.md, 확정 결정, V2 ExecPlan/수용 계약/작업판 및 실제 Composer/Board/Detail/Library/Home/hook/test. ExecPlan W04/C01/C11의 기존 편집 범위만 처리했다. 신규 공개/로그인 복귀와 전체 화면 검증은 W13/W18, 실제 Android는 W19에 남는다.
- IMPLEMENTED YES: Composer 제목만 입력한 초안과 새 보드 이름/설명의 이탈을 보호한다. URL 사전 입력 및 값을 원복한 상태는 불필요한 경고를 띄우지 않는다. QuickLog X/Escape/배경/취소가 같은 폐기 확인을 거치며, 저장 중 입력과 이동을 잠근다. 상세 감상 저장의 중복 제출 차단·실패 시 초안 유지·재시도를 검증했다.
- 취소 범위: 보드 이름/설명과 상세 감상만 취소되는 점을 표시했다. 즉시 반영되는 카드 추가/제거/정렬은 텍스트 취소로 되돌리지 않는다. 이탈 보호는 Android document 링크 처리보다 먼저 실행된다.
- 복귀: 내부 허용 경로의 출발점/검색/정렬/스크롤을 Memory 상세·작성 취소에 전달한다. 상세 삭제 후에도 출발 보드로 돌아간다. 외부/인증/미지원 경로는 Archive로 복귀한다. 메모/이미지 원본을 추가로 저장하거나 전송하지 않는다.
- 변경 파일: Composer/useMemoryCardComposer, MemoryBoardView, MemoryCardDetail, Library/LibraryQuickLogSheet, useUnsavedNavigation, quickLogDraft, 신규 memoryReturnNavigation/useMemoryReturnNavigation, MemoryRouteShell/Home, Archive sort 접근성 이름. 관련 회귀 tests 및 quality workflow에 편집 검사를 추가했다. 정확한 파일·hash는 evidence/2026-09-23-w04-validation.json.
- AUTO_TESTED PASS: 최초 제목/보드 초안 보호 2개 실패 재현 후 수정. 최종 unit249/249; 통합34 PASS/2 SKIP(운영 live 흐름 비실행); 최종 편집10/10 PASS(통합과9개 중복, 스크롤/시각 검사1개 추가); build15 routes+postbuild; git diff --check PASS. 명령: npm run test:unit; node scripts/run-e2e.mjs tests/release-editing.spec.ts tests/service-finishing.spec.ts tests/memory-board.spec.ts tests/title-cross-surface.spec.ts tests/library-userflow.spec.ts --project=chromium --workers=1 --reporter=line; 편집 suite 단독 최종 재실행; npm run build; npx react-doctor@latest --verbose --diff.
- 테스트 정비: 기존 Home fixture는 제거된 .home-empty-state를 기대했다. 실제 화면·컴포넌트와 비교해 현재 HomeRediscovery에 Memory 카드가 없고 이전 시청 기록 영역은 접혀 있는지를 검증하도록 수정했다. Board/Title 통합은 출발점 복귀 query를 정확히 검증한다. 실패를 숨기기 위해 기대 계약을 제거하지 않았다.
- REAL_ENV_VERIFIED PARTIAL: 격리된 실제 Chromium에서 저장 실패/중복/브라우저 뒤로/모달 네 가지 닫기/보드 즉시 저장과 취소/필터·스크롤 복귀 통과. 390px/1440px 작성 화면 캡처를 직접 확인했고 가로 넘침 없음. 실제 Android 단말·OAuth·운영 배포는 미실행.
- React Doctor 49→49로 점수 하락 없음. 기존 오류1개, 경고14→16개(복잡도 포함)는 남아 있어 전체 코드 품질을 정상으로 선언하지 않는다. 별도 전면 정리는 이번 범위 밖.
- OWNER_APPROVED: 사용자 다음 작업 진행 승인으로 구현. 운영 배포/DB 변경/Public 활성화 없음. migration0, 의존성 변경0. 보안·권한 정책은 유지하며 복귀 URL은 내부 경로만 허용하고 인증/중첩 복귀 파라미터를 제외한다. 사용자 자료/메모/검색어를 새 분석 로그로 보내지 않는다.
- 증거: evidence/2026-09-23-w04-validation.json 및 D:/hong/Web/Anime/.moemoa-w04-2026-09-23/{repro,flows-final,editing-final,unit-final,build-final,react-before,react-final}.txt, composer-{390,1440}.png. commit/push/배포 전 working tree 검증이며 운영 SHA가 아니다.
- rollback: 같은 폴더 baseline과 비교해 이번 수정만 되돌리고 신규 helper/hook/test만 제거한다. 이전 작업 변경과 실제 사용자 데이터는 보존한다. DB rollback 불필요.
- 선택/변경 기록: W05 시작 의존성을 W03 전체 완료→W03 로컬 검증으로 한정. 계정 계약의 로컬 검사에는 원격 알림/배포 설정이 필요하지 않기 때문이다. W03 외부 gate·D01 실계정·W06/W19 실환경 수용 조건은 그대로 유지한다. 제품 범위 변경 없음.
- 진행: M완료1/6, 기본 W완료3/20, 추가 필수0. M1 잔여 W03 외부 gate 및 W05/W06. 다음 W05 READY.

### W05 실행 범위 — 2026-09-23

- ExecPlan V2/C02. 소스에서 한 번의 50 push/200 pull 후 SYNCED 표시, 업로드 성공 seq가 pull cursor를 이동시키는 누락 위험, 정확히 5000개 full resync 거절을 확인했다.
- 한 세션의 유한 처리 예산과 PARTIAL/PAUSED/REJECTED를 도입하고 재개는 durable outbox/cursor로 수행한다. 최신 remote version·동시 tombstone을 수용하되 owner/ID/역행 version 검증은 유지한다. 전체 복원은 keyset pagination과 5001번째 존재 확인으로 완전성 경계를 확인한다.
- 변경 지도: syncMemoryMetadata, SupabaseMemoryGateway, memorySyncStore/repository, account runtime/hook/panel, KO/EN 결과 문구와 단위/브라우저 회귀 검사. 제품 데이터 종류·자동 이미지 업로드·Public 정책 변경 없음.
- 검증: 51 pending/201 changes, 계속 유입 시 유한 종료와 재개, 중단/실패/거절/충돌, version 경합·삭제, full resync 4999/5000/5001, 실제 IndexedDB cursor 보존. 합성 fixture 사용. 실제 A/B 토큰 및 Android는 W06/W19와 D01 범위로 유지.
- DB/schema/의존성 변경 없음. rollback은 D:/hong/Web/Anime/.moemoa-w05-2026-09-23/baseline과 비교하여 W05 변경만 복구. 원본/이전 미커밋 변경 보존. 오류는 안전한 code만 UI에 노출하고 사용자 payload는 로그에 남기지 않는다.

### 2026-09-23 · W05 종료 기록 — DONE (동기화 로컬 계약)

- 읽은 기준: AGENTS/진입 문서/확정 결정/V2 ExecPlan·C02·작업판·QA 운영 문서. 실제 sync engine, Supabase gateway, IndexedDB commit, account runtime/hook/panel, KO/EN 문구와 기존 tests, pull_memory_changes SQL을 교차 확인했다. Supabase 취소 API는 설치된 postgrest-js의 abortSignal 구현으로 확인했다.
- IMPLEMENTED YES: 한 클릭은 시작 시 pending 목표 최대500개/50개씩, pull 최대10페이지/200개씩 처리한다. 런타임 20초 중단 및 transport AbortSignal을 연결했다. 새 작업이 계속 생기면 PARTIAL로 끝나며, 남은 outbox가 있는 동안 pull로 미전송 초안을 덮어쓰지 않는다. 다음 클릭은 저장된 outbox/다운로드 cursor에서 이어간다. 이 수치는 제품 보유량 한도가 아니다.
- 완료: pending/열린 충돌/마지막 거절/더 읽을 페이지가 없을 때만 SYNCED. PARTIAL/PAUSED/CONFLICT/REJECTED/ERROR를 구분한다. 충돌 한 건 해결만으로 전체 완료를 표시하지 않는다. 미해결 충돌은 후속 적용을 막고 비교 내용과 로컬 초안을 보존한다.
- 누락 방지: upload 성공·KEEP_LOCAL 충돌 해결의 seq를 download cursor에 쓰지 않는다. 계정 재등록도 서버 device seq 대신 이 기기의 durable cursor를 유지한다. 재개 시 기존 성공 operation의 version을 읽어 후속 작업만 rebase하며 operation ID를 유지한다. 응답 유실 재시도는 동일 ID/hash로 반복한다.
- pull/복원: 변경 로그보다 최신인 원격 row를 받아들이되 ID/owner/역행 version 검증은 유지한다. page 경계201번째 변경과 동시 tombstone을 검증했다. 전체 복원은 ID keyset 페이지와 5001번째 확인을 사용해4999/5000은 성공,5001은 안전한 오류로 끝나며 일부 snapshot/cursor를 commit하지 않는다. 전체 복원 중 삭제는 오래된 pending과 열린 충돌보다 우선하며 충돌 localBackup을 남긴다.
- UI/오류: 일시중단 및 재시도 경로, 남은 처리/거절/429/인증 만료/서비스 중단/계정 한도/복원 범위 초과를 KO/EN으로 표시한다. raw 서버 오류나 개인 payload는 노출·로그에 추가하지 않았다. 서버 quota/suspend 시행을 새로 구현했다는 뜻은 아니며 W15에 남는다.
- AUTO_TESTED PASS: Windows bundled Node24.19.0 unit269/269, Chromium26/26(skip0), build15 routes+postbuild, git diff --check. browser 대상 release-sync/memory-account-sync/memory-indexeddb/release-editing. 실제 IndexedDB 재열기에서 cursor 보존·거절 유지·전체복원 삭제 우선, mock 계정 UI에서 pause→retry→SYNCED 확인. 초기에 새 검사에서 private title 조회 API를 잘못 호출한 테스트 오류1개를 수정한 뒤 전체26개 재실행 PASS.
- 명령: npm run test:unit; node scripts/run-e2e.mjs tests/release-sync.spec.ts tests/memory-account-sync.spec.ts tests/memory-indexeddb.spec.ts tests/release-editing.spec.ts --project=chromium --workers=1 --reporter=line; npm run build; npx react-doctor@latest --verbose --diff. quality workflow에도 계정/저장소/새 sync 검사를 추가했다. 원격에는 아직 반영하지 않았다.
- React Doctor 49→49, 기존 오류1개 유지, 경고16→21(순차 동기화 loop·복잡도 포함). 점수 하락은 없지만 전체 건강 상태 양호를 의미하지 않는다.
- REAL_ENV_VERIFIED PARTIAL: 실제 Chromium+IndexedDB, 합성 계정/transport. 실제 A/B/비로그인 RPC·Storage, OAuth/다기기/Android, 운영 서버 한도·중단 응답은 미검증이며 W06/W15/W19/D01 게이트 유지. W03 외부 checks/알림/배포 추적도 그대로 남는다.
- OWNER_APPROVED 개발 진행 YES. DB/schema/마이그레이션0, 의존성 변경0, 운영 설정/Public 활성화/이미지 업로드0, commit/push/배포0. 취소는 이미 서버에서 처리된 작업의 rollback을 의미하지 않으며 응답이 불확실한 작업은 동일 operation으로 안전하게 재시도한다. 과거 잘못 올라간 cursor의 실데이터 영향 범위는 W06 실제 복원 검증에서 확인할 대상이다.
- 정확한 변경 파일/hash: evidence/2026-09-23-w05-validation.json. sync engine/gateway/store/repository/runtime/hook/panel, KO/EN, 기존3종 unit+계정 E2E·신규 release-sync 및 workflow. 상세 로그 D:/hong/Web/Anime/.moemoa-w05-2026-09-23/{unit-final,browser-final,build-final,react-final}.txt. 기존 W04 React 결과가 작업 전 기준.
- rollback: 같은 폴더 baseline과 비교해 W05 변경만 복원하고 신규 release-sync test를 제거한다. 기존 W03/W04 및 이전 미커밋 수정/사용자 데이터는 보존한다. 운영/DB에 적용하지 않아 DB rollback 불필요.
- 진행: M완료1/6, 기본 W완료4/20, 추가 필수0. M1 잔여 W03 외부 gate + W06. 다음 W06 READY.

### W06 실행 범위 — 2026-09-23

- V2 ExecPlan/C01/C02/C10 적용. 초기화 A/B/로그아웃 경합에서 오래된 응답이 활성 owner/state를 바꾸지 않도록 보완하고, Guest 승격 preview·확정·재시도 및 지원하는 metadata backup 관계/원본 보존을 검증한다.
- 변경 후보: createMemoryAccountRuntime/useMemoryAccountSync, promotion/backup 경계 및 합성 단위/IndexedDB/browser tests. 변경 전 원본은 .moemoa-w06-2026-09-23/baseline에 보존.
- 사용자 확인: 격리 Supabase/테스트 A/B 계정 아직 없음, 로컬 검증부터 진행 승인. Docker daemon도 현재 연결 불가. 실 역할 REST/RPC/Storage 검증은 BLOCKED_EXTERNAL로 남기고 로컬 PASS로 대체하지 않는다.
- schema/운영 DB/프로덕션 설정/배포 변경 없음. 실제 사용자 이미지/계정 접근 없이 synthetic fixture. 작업 실패 시 이번 변경만 baseline과 비교 복구하고 기존 미커밋 작업 보존.

### 2026-09-23 · W06 종료 기록 — BLOCKED_EXTERNAL (로컬 검증 PASS)

- 읽은 기준: AGENTS, CODEX_START_HERE, 확정 결정, V2 ExecPlan/C01/C02/C10/작업판, PLANS, account runtime/hook/Auth/Memory 화면·Home, promotion journal/saga·backup 구현과 실제 tests. 사용자는 격리 Supabase/테스트 A·B 계정이 없으며 로컬부터 진행하도록 답했다. Docker info도 daemon pipe 없음으로 실패. 운영 프로젝트를 대신 사용하지 않았다.
- IMPLEMENTED YES: 초기화 A→B, A→로그아웃, A→B→A에 세대 번호와 순차 전환을 적용했다. 오래된 성공/실패/동기화/충돌 백업 응답은 최신 state·owner를 바꾸거나 반환하지 않는다. 실제 profile UID도 요청 계정과 대조한다. 초기화 RPC에 취소 signal/20초 타임아웃을 연결했다. Auth 초기 getSession보다 새 Auth 이벤트가 먼저 오면 오래된 초기 응답을 버린다.
- 화면: useMemoryOwnerBoundary가 계정 확인 중 Memory route children을 숨기고 준비된 owner별로 다시 mount한다. Home Memory 조회도 같은 owner key/ready 경계를 사용한다. 이전 상세/이미지 비동기 응답은 unmount cleanup으로 새 계정에 노출되지 않는다. useMemoryAccountSync는 user ID가 다시 같아져도 바뀐 세션 token으로 이전 작업을 무효화하고 초기화 중 이전 계정 state를 가린다.
- 승격: 취소한 preview를 runtime에서도 무효화하고 늦은 preview 응답을 버린다. 확정 전 Guest sourceHash를 재확인하고 title 선택 후 실행 hash를 고정한다. 서버 처리 후 계정이 바뀌면 REMOTE_COMPLETED journal을 남겨 원래 계정에서 local commit만 복구한다. 다른 계정은 같은 Guest의 미완료 journal을 가져갈 수 없다. 이미 처리된 원격 기록은 operation 재시도로 중복 생성하지 않는다. 실패 문구는 원격 미반영을 단정하지 않으며 원본 보존/재시도·다른 계정 완료 필요를 안내한다.
- 누락/복원: Guest 승격 성공 seq도 download cursor로 쓰지 않도록 수정했다. 백업 복원은 synced visual asset의 cardId를 새 card ID로 재매핑한다. metadata-only·빈 Guest로 복원·계정 import가 outbox를 우회하지 않는 기존 제한을 유지한다.
- AUTO_TESTED PASS: 처음 지연 A 초기화가 활성 A를 다시 적용하는 실패를 재현(repro.txt)한 뒤 수정했다. 최종 unit278/278, Chromium36/36(skip0), build15 routes+postbuild, diff check PASS. 기존 conflict/promotion 재시도+실제 IndexedDB Guest 소유권 이동·localRef 유지, 다른 계정의 중복 Guest claim 차단, 서로 다른 브라우저 context의 백업·관계·강제 실패 rollback·중복 복원 거절 검증. 최초 새 browser fixture의 device state 누락과 실제 링크 이름 오기를 수정한 후 전체 재실행했다.
- UI 실검증: 실제 Chromium에서 A의 private detail 응답을 보류→B로 Auth 전환→A 응답 반환 순서로 실행. A 감상/제목/편집란은 없고 B는 Card not found와 Back to Memories 링크를 표시한다. 이는 로컬 합성 Auth 검증이며 서버의 RLS 증거가 아니다.
- 명령: npm run test:unit; node scripts/run-e2e.mjs tests/memory-owner-boundary.spec.ts tests/memory-account-sync.spec.ts tests/memory-indexeddb.spec.ts tests/review-improvements.spec.ts tests/release-sync.spec.ts tests/release-editing.spec.ts tests/title-cross-surface.spec.ts --project=chromium --workers=1 --reporter=line; npm run build; npx react-doctor@latest --verbose --diff. React Doctor49→49, 기존 오류1/경고21 유지. quality workflow에 owner-boundary/backup 회귀를 연결했으나 원격 실행은 아직 없다.
- REAL_ENV_VERIFIED PARTIAL: 브라우저/IndexedDB는 실제 격리 프로필. Supabase Auth/RPC/Storage는 합성 adapter. 실제 A/B/익명 token으로 REST 목록/직접ID read·write·RPC owner 참조·Storage original/preview를 검증해야 한다. 실제 OAuth/Android/다기기 전환도 W19에서 유지. 과거 잘못 전진한 cursor의 실제 자료 복구도 별도 실제 테스트 계정으로 검증해야 한다.
- 남은 D01 검증: (1) 격리 프로젝트·합성 계정 A/B와 파일 경로 기반 비밀값 준비 (2) A가 만든 fixture에 B/익명 REST·RPC read/write 거절 (3) Guest 승격 취소/재시도·계정 전환과 원격 결과 대조 (4) 원본/preview Storage의 소유자 권한 (5) 깨끗한 두 번째 기기의 sync/복원 및 지연 응답 (6) 승인된 합성 fixture만 정리. service_role 단독 성공이나 로컬 모형으로 이 체크를 대체하지 않는다. Public/운영 활성화 전 필수다.
- OWNER_APPROVED 개발·로컬 검증 YES. DB/schema/migration0, 프로덕션 의존성0, 운영 정책/Public/배포0. 실제 사용자 자료·이미지·비밀값 접근/전송 없음. 소유자 경계와 승격 동의 범위를 강화했으며 개인 note/사진/검색어의 신규 로그 없음.
- 변경 파일: runtime/hook/Auth/MemoryRouteShell/Home 경계·신규 useMemoryOwnerBoundary, promotion saga/journal·gateway 취소, backup ID, KO/EN/계정패널, unit/E2E/CI. 정확한 파일/hash는 evidence/2026-09-23-w06-validation.json. 상세 로그 D:/hong/Web/Anime/.moemoa-w06-2026-09-23/{repro,unit-final,browser-final,build-final,react-final}.txt.
- rollback: 동일 폴더 baseline과 비교하여 이번 변경만 복구하고 신규 owner boundary hook/test를 제거한다. 이전 미커밋 변경과 원본 자료는 보존한다. DB/운영 적용이 없어 해당 rollback은 없음.
- 선택/변경: W07 착수 의존성은 W06 전체→W06 로컬 검증으로 한정한다. 격리 서버 없는 동안 공개 모델/권한 경계의 로컬 구현은 독립 진행할 수 있으나 W06/D01 실제 권한 게이트·운영 활성 조건은 그대로다. 새로운 제품 범위/권한 약속 변경 없음.
- 진행: W06은 DONE에 포함하지 않는다. M완료1/6, 기본 W완료4/20, 추가 필수0. M1 잔여 W03 외부 checks/관측·W06 실제 계정 권한. 다음 W07 로컬 구현 READY.


### W07 실행 범위 — 2026-09-23

- C03~C05의 서버 기반을 additive migration으로 구현한다. 기존 showcase는 legacy 통계 snapshot이며 새 Memory 선택 공개 모델로 재사용하지 않는다. 기존 UI/갤러리/legacy gate는 유지.
- 비공개 원본과 공개 projection 분리, Auth UID owner 검증, 명시 선택 필드, preview hash/revision, 준비→게시→철회, 원본 삭제/관리 차단/서버 read·write kill switch를 구현한다. 첫 수직 검증은 승인 catalog cover 카드로 제한하며 디자인·사용자 이미지 준비는 W08, UI는 W09, 전체 동시성/캐시·삭제 연결은 W10에 유지한다. 미지원 이미지는 자동 교체 없이 거절한다.
- DB는 운영/격리 Supabase에 적용하지 않는다. 로컬 PostgreSQL을 테스트용으로 준비해 합성 auth/users·역할로 SQL 계약을 실행한다. 실제 Supabase OAuth/PostgREST/Storage·A/B 테스트를 대체하지 않는다. 제품 의존성 변경 없음.
- 검증: 선택 필드 외 누출0, A/B/anon 함수·직통 테이블 접근, stale preview/동시 revision, 재시도, 철회 후 오래된 publish, 두 보드 참조, 원본 삭제, 차단/kill switch. 기존 unit/build 회귀.
- rollback: 새 migration/test/helper만 제거하고 기존 문서는 ../.moemoa-w07-2026-09-23/baseline과 비교해 이번 변경만 복원. 운영 DB 적용0이므로 운영 rollback 없음.


### 2026-09-23 · W07 종료 기록 — BLOCKED_EXTERNAL (공개 서버 기반 로컬 검증 통과)

- 읽은 기준: AGENTS/CODEX_START_HERE/확정 결정/PLANS, V2 ExecPlan·C03~C05·작업판, 이미지 UGC·구조·QA·감사·변경관리 명세. 실제 showcaseRepo/showcaseSelectors와 Memory schema/security/RPC/catalog-cover migrations를 교차 확인했다. legacy showcase는 개인 통계를 담는 옛 snapshot이므로 신규 Memory 공개 계약에 연결하지 않았다. 옛 화면·갤러리 변경0.
- IMPLEMENTED YES (W07 기반): `20260923090000_memory_publication_boundary.sql`의 비공개 staging/public snapshot 분리, 서버 Auth UID 소유 검사, 선택 필드 allowlist, source/board/asset/membership version과 정책을 포함한 preview hash, 기대 revision·operation 검사, 명시 게시/보드 철회/카드 전체 철회, 원본 삭제의 지속 철회 fence, 관리 차단과 서버 read/write switches. 읽기는 현재 카드/보드/계정/표지 상태를 확인한다. Public 내부 테이블·함수 직통 접근은 anon/authenticated에 부여하지 않는다.
- 원본 보존: private visibility 변경0, 로컬 파일 업로드0, 공용 표지 삭제0. 서버가 선택 필드만 projection하며 원본 ID·private Board 이름/미선택 감상/개인 집계는 공개 DTO에 없다. 공개 보드 이름·설명은 명시 제공한 문자열이다. private 편집은 자동 공개 갱신되지 않고, 준비 중 기존 공개 snapshot은 유지된다.
- W07 지원 범위: 승인된 catalog cover 카드로 게시→방문자 DTO→철회 수직 경계를 검증했다. SYSTEM_DESIGN/USER_IMAGE는 현재 `PUBLIC_VISUAL_NOT_READY`로 전체 시도 거절하며 자동 표지 대체하지 않는다. 이 지원은 W08에서 확장한다. 방문자 UI·기존 UI 연결 W09, 전 위치 재공개·기기/캐시/원본 삭제 통합 W10, 관리자 조치/이의/감사 W14가 남는다. 현재 전체 철회 카드의 재공개 API는 아직 없으며 기존 철회 기록을 임의로 지워 재공개하지 않는다.
- gateway: `SupabasePublicationGateway.js`는 필요한 RPC만 호출하고 prepare에는 선택 ID/필드만 보낸다. 재시도는 동일 operation/review revision을 유지한다. 네트워크 오류는 자료 없음(null)과 구별하며 비밀값/원문을 포함할 수 있는 upstream 오류를 안전한 code로 변환한다. 호출 UI에는 아직 연결하지 않았다.
- AUTO_TESTED PASS: 실제 로컬 PostgreSQL14.24에서 SQL 계약45개, 별도 두 세션 동시 prepare에서 성공1/충돌1·revision 한 번 증가. `tools/publication-boundary/run-local-postgres.sh`는 매번 새 UNIX socket 전용 임시 cluster를 만들고 종료한다. 기존 migration 전체 중 pg_cron retention만 제외하고 적용; Auth UID 함수·auth.users·Storage 테이블은 명시한 합성 bootstrap. 실제 RLS/grant/definer/트리거/트랜잭션은 PostgreSQL에서 실행했다. 초기 fixture의 deferred COMPLETE constraint 실패를 transaction fixture로 수정한 뒤 최종 통과했다.
- SQL 검증 항목: A/B/anon 직접 접근, owner spoof/다른 owner 카드/보드, 미선택 필드0, preview=visitor DTO, 검토 후 수정·정책 변경 거절, 기존 공개본 유지, 재시도, 보드 하나/카드 전체 철회, 늦은 성공의 부활 차단, 원본 카드/보드 삭제→복원 후 부활 차단, 관리자 계정/카드/보드 차단, 미준비 이미지, read/write kill switch, no-store response.headers 설정.
- AUTO_TESTED 추가 PASS: Node24.19.0 unit283/283(신규 gateway5), build15 routes+postbuild, git diff --check. React/UI 변경0으로 React Doctor/화면 E2E는 이번 범위 NA; 이전 W06 증거를 새 검증으로 세지 않는다. 프로덕션 dependency 변경0. 로컬 WSL 테스트용 PostgreSQL 패키지만 설치했다.
- REAL_ENV_VERIFIED BLOCKED: 실제 Supabase17/Auth/PostgREST/Storage/HTTP cache·헤더/Android 증거0. PostgreSQL14 합성 역할 시험은 실제 Supabase 토큰 검증을 대체하지 않는다. 특히 no-store는 DB response.headers 설정만 확인; 실제 전달 응답과 CDN/SW는 W08/W10/W19. legacy remote 직통 테이블 권한은 이 신규 경계 테스트로 입증하지 않는다.
- OWNER_APPROVED: 로컬 개발 YES. commit/push/운영 배포/운영 DB 적용/Public 활성화 NO. 새 migration은 파일로만 준비했고 gate 기본값 false·정책 UNAPPROVED. 실제 프로젝트에 실행하지 않았다.
- migration/rollback: additive tables4/functions10/triggers2. 지금은 새 파일 제거와 baseline 문서 복원으로 W07만 되돌릴 수 있다. 추후 적용 뒤에는 먼저 서버 읽기/쓰기 중단하고 코드 rollback; 활성 공개·철회 이력이 생긴 DB 테이블을 삭제하는 rollback은 사용하지 않는다. 적용 승인은 정확한 후보에서 별도로 필요.
- 증거: [최종 파일 hash/결과](evidence/2026-09-23-w07-validation.json), `D:/hong/Web/Anime/.moemoa-w07-2026-09-23/{postgres-final,unit-final,build-final}.txt`. 실행: WSL bash tools/publication-boundary/run-local-postgres.sh; npm run test:unit; npm run build. HTTP 네트워크 보안 침해·실제 사용자 데이터 사용0.
- 선택/변경: W08 선행을 W07 전체→W07 로컬 검증으로 한정. 이미지 준비 로컬 개발은 계속하되 D01 실제 권한·D05 전달/철회 계약·Public 운영 gate는 유지한다. W07은 DONE에 포함하지 않는다. M완료1/6, W완료4/20, 추가 필수0. 다음 W08 READY.


### W08 실행 범위 — 2026-09-23

- C04: catalog cover 기존 revision 유지, system design의 공개 재현용 최소 데이터, 권리 승인된 선택 사용자 이미지의 서버 decode/재인코딩/thumbnail·비공개 전달용 사본 준비와 최신 공개 상태 read gate를 연결한다. 기존 UI 연결 W09, native 원본 export 및 실기기 검증 W19와 미완료 항목을 구분한다.
- 기존 Vercel 배포의 제한된 image endpoint만 추가한다. Supabase는 계속 유일한 Auth/DB/Storage. 별도 서버/공급자 플랫폼은 도입하지 않는다. endpoint와 서버 이미지 gate는 기본 off이며 생산 설정/데이터 적용 없음. privileged key는 서버 환경에만 사용.
- 서버 이미지 처리에는 기존 Astro 의존 트리의 sharp0.34.5를 같은 버전의 직접 의존성으로 선언한다. 브라우저 검증만으로 대체하면 악성 직접 요청을 막을 수 없고 Supabase SQL만으로는 파일 decode를 할 수 없기 때문이다. 위험: native binary 배포/용량; 로컬 decode tests와 build 후 실 Vercel 검증은 D01/D06에서 확인. rollback은 package/lock baseline 및 신규 endpoint 제거.
- 임시 기술 상한: 입력4MiB, decoded25M pixels, 출력각2MiB, raster JPEG/PNG/WebP만, animation/SVG 금지. 상품 한도 확정이 아니며 서버 사용자별 예약 quota 기본0으로 운영 승인 전 업로드는 열리지 않는다.
- 실제 Supabase/Storage 없는 동안 SQL 합성 역할·실제 sharp 변환·HTTP handler 계약을 검사한다. 권리 승인은 신뢰 서버 테이블을 기준으로 하며 self-claim만으로 승인하지 않는다. 실패/취소/준비 중 전달 차단, no-store, 원본/EXIF 비노출, 객체 정리와 재시도 검증. 실환경 미검증은 유지.
- rollback: ../.moemoa-w08-2026-09-23/baseline과 비교하여 이번 변경만 복원. 기존 W07/이전 변경 보존. 운영 DB 적용0.


### 2026-09-23 · W08 종료 기록 — BLOCKED_EXTERNAL (이미지 서버 경로 로컬 검증 통과)

- 기준/교차 확인: AGENTS/CODEX_START_HERE/확정 결정/PLANS와 기존 V2 ExecPlan·C04·작업판, 이미지 UGC·구조·QA 명세. 실제 W07 SQL/gateway, systemDesign/SystemDesignPreview/loadMemoryVisual, native image intake/이미지 교체, Astro/Vercel/package/lock을 확인했다. 기존 native adapter는 preview만 읽고 원본 export는 없으며 이를 원본처럼 전송하지 않는다.
- IMPLEMENTED YES (로컬 서버 경로): `20260923093000_memory_public_images.sql`은 비공개 derivative bucket과 restrictive Storage policy, 신뢰 서버의 권리 승인 기록, upload reservation/상태·한도·취소/완료/정리 RPC, 세 유형의 공개 visual projection, 현재 publication/권리/차단 상태를 확인하는 이미지 resolver를 추가한다. 기존 W07 migration은 수정하지 않고 additive 함수 교체를 사용한다.
- 표지/디자인: cover revision은 그대로 사용. 디자인은 기존 systemDesign.js와 같은 canonical JSON/FNV-1a token을 계산하여 기존 hue/angle을 재현한다. private seed·genreTokens·임의 JSON 속성을 공개하지 않는다. client publicDesignStyle은 rendererVersion1만 수용하며 외부 자산/폰트 URL을 도입하지 않는다. W09에서 기존 디자인 스타일에 연결한다.
- 사용자 이미지: `processImage.js`가 JPEG/PNG/WebP magic+실제 decode, animation/APNG/SVG/HTML/잘린 파일/과대 pixels 차단, orientation 반영, EXIF/ICC/XMP 제거, 최대1600px full/400px thumbnail WebP 재인코딩을 수행한다. 입력 원본 bytes와 서버 source checksum을 대조한다. 원본 보관/삭제/수정0. 이 처리는 전용 백신/내용 심사 구현이 아니며 권리·콘텐츠 심사를 대신하지 않는다.
- 전달: 기존 Vercel용 `api/public-image.js`와 server handler. POST는 검증된 Auth 사용자+명시 policy 동의+선택 asset/version/operation만 처리한다. GET은 공개 placement를 확인한 뒤 비공개 Storage에서 읽고, 내려주기 직전 다시 확인한다. 이미지 URL에 Storage 주소/서명 URL을 노출하지 않는다. full/thumb 모두 no-store/CDN no-store/nosniff. 오류는 code만 반환한다. 인증 없는 preview, 잘못된 origin/variant/중복 query를 거절한다.
- 실패/중복: 준비·실패·취소된 파일은 공개되지 않는다. 같은 operation 완료 뒤 재시도는 같은 asset을 반환한다. 완료 RPC 응답 유실 시 이미 READY인 사본을 임의 삭제하지 않고 상태를 확인하는 cleanup으로 넘긴다. cleanup은 실제 객체 삭제가 성공한 뒤에만 DELETED로 표시하고 실패하면 재시도한다. 공개/미리보기에서 참조 중인 사본은 정리 대상에서 제외한다. owner 계정/원본 메타데이터가 삭제되어도 asset의 객체 좌표는 정리를 위해 유지한다.
- 한도: 사용자 profile row lock으로 동시 reservation을 직렬화한다. 준비 중 최대4MiB 예약도 서버 quota에 포함하며 READY 이후 실제 bytes로 환산한다. 설정 asset_limit/asset_bytes_limit 기본0, images_enabled=false, endpoint 별도 env 기본off. 입력4MiB/25M pixels/최대축10000, 출력각2MiB는 로컬 기술 상한으로 상품 약속이 아니다. unused 준비/사본 TTL24h 및 삭제 metadata 보존은 D03/D05/W17에서 운영값·주기를 확정해야 한다. cleanup 자동 스케줄은 만들거나 활성화하지 않았다.
- 클라이언트 기반: `preparePublicImage.js`는 명시 동의·Auth와 실제 original Blob 공급을 요구한다. 원본이 없거나 취소되면 안전한 오류, preview나 catalog cover 자동 대체 없음. `publicVisual.js`는 공개 asset ID/variant만으로 전달 URL을 만든다. 실제 UI는 W09, Android 원본 파일 export 연결은 W19의 미완료 항목이며 현재 native preview adapter만으로 원본 업로드가 가능하다고 주장하지 않는다.
- 의존성: 이미 설치된 sharp0.34.5를 package/lock의 직접 dependency로 선언. version이 바뀐 dependency0; 버전 업그레이드0. browser dist에서 서버 service-role 환경 설정 문자열 미포함 확인. Astro static build는 Vercel function packaging 검증을 대체하지 않는다.
- AUTO_TESTED PASS: 로컬 PostgreSQL14.24에서 W07계약45+W08계약31=76, 두 세션 동시 prepare1 및 사용자 이미지 quota1 시나리오 통과. Storage restrictive RLS는 의도적으로 추가한 넓은 허용 정책으로도 우회되지 않음을 합성 테이블에서 확인. 정책/권리 미승인, 다른 계정, 미준비 사본, 늦은 완료, 취소·철회, 정리와 디자인 동일 token을 검사했다.
- AUTO_TESTED 추가 PASS: Node24.19.0 unit296/296(신규13: sharp 실제 변환+실제 localhost HTTP 서버/합성 backend+client 계약), build15 routes+postbuild. PNG/JPEG/WebP·metadata 제거·잘린 파일·25M pixel 초과·APNG·full/thumb 철회·전달 도중 철회·모호한 완료·정리 재시도 검증. 실제 Supabase는 연결하지 않았다. 초기 SQL fixture가 service_role의 test assertion 테이블 권한 없이 실행되어 실패한 부분은 테스트 권한만 수정한 뒤 통과했다.
- REAL_ENV_VERIFIED BLOCKED: 실제 Supabase17/Auth/Storage HTTP/RLS, hosted Vercel function bundle/headers/CDN, Android 원본 읽기/실단말, 실권리 승인 담당/정책, 운영 quota/보존/자동 정리 미검증. 테스트의 Auth/Storage는 명시한 합성 환경이며 pg_cron retention migration은 기존 harness처럼 제외. sharp/HTTP 테스트 backend는 stub이므로 실제 저장소 증거로 계산하지 않는다. React/UI 변경0으로 화면 E2E/React Doctor는 이번 범위 NA.
- 설정/운영 인계: 서버 전용 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `MOEMOA_PUBLIC_IMAGE_API_ENABLED`, `MOEMOA_PUBLIC_IMAGE_ALLOWED_ORIGINS`(쉼표로 구분한 허용 origin). 파일에 비밀값 추가0. 실제 세팅0. 개발 외 환경 활성화는 D01/D03/D04/D05/D06 충족 전 금지. 정리 실행기 `node tools/publication-boundary/cleanup-images.mjs --apply`는 승인된 대상에서만 수동 실행하며 이번에는 실행하지 않았다.
- OWNER_APPROVED: 로컬 개발 YES. commit/push/배포/운영 migration/계정 권한/실제 이미지 업로드/Public 활성화0. DB migration은 파일 준비 및 매번 새 로컬 cluster 적용뿐이다.
- rollback: `.moemoa-w08-2026-09-23/baseline`의 package/lock/문서/harness와 비교해 W08만 복원하고 새 endpoint·server/helper/test/migration을 제거한다. 향후 적용 뒤 rollback은 endpoint와 서버 reads/writes를 우선 중단하고 원본·공개/철회 이력·cleanup 좌표를 보존한다. Storage를 public으로 바꾸거나 기록을 삭제하는 우회 rollback은 하지 않는다.
- 근거: [최종 hash/검증](evidence/2026-09-23-w08-validation.json), `D:/hong/Web/Anime/.moemoa-w08-2026-09-23/{sql-final,unit-final,build-final}.txt`. 공식 [Vercel request/response limits](https://vercel.com/docs/functions/limitations)와 [Node runtime](https://vercel.com/docs/functions/runtimes/node-js), [Supabase Storage 접근 통제](https://supabase.com/docs/guides/storage/security/access-control)를 확인했고 sharp 동작은 설치된0.34.5 코드·실제 변환으로 재검증했다.
- 선택/변경: 기존 배포 플랫폼 내 이미지 endpoint 하나만 추가하며 Auth/DB/Storage는 기존 Supabase 유지. W09 선행은 W08 전체→W08 로컬 계약으로 좁히고 실제 환경/정책 gate는 그대로 유지한다. W08은 DONE으로 세지 않는다. M완료1/6, W완료4/20, 추가 필수0. 다음 W09 READY.


### 2026-09-24 · 데스크톱 이전 master 반영 승인

- 사용자가 별도 브랜치 대신 현재 개발본을 master에 올리도록 명시 승인. 기존 ExecPlan의 작업 상태/미완료 게이트는 유지하며 Git 연동 배포 상태를 확인한다. Public 활성화·운영 DB migration은 포함하지 않는다.
- 반영 전 unit/catalog/build/브라우저 핵심/React Doctor 및 비밀값 검사를 수행한다. 기존 추적 .env.production에는 공개 catalog URL/anon key만 있으나 향후 오염 방지를 위해 로컬 보존·Git 추적 해제.
- 새 PC는 저장소 루트에서 Node24.19.0/npm ci 후 진행 문서를 읽고 W09 재개. 개인 환경/외부 catalog workspace·로컬 사진은 별도. rollback은 이번 코드 commit revert이며 DB 이력/원본 삭제 없음.

- 이전 후보 검증: Windows unit296/build15/Chromium46 PASS, Linux clean npm ci/catalog253 PASS. React Doctor49/100(기존 오류1·경고21, 점수 변화0). Linux scroll test는 요청753px이 실제 높이1336-viewport844=492px 상한을 넘는 경우를 확인해 min(요청,실제 상한)으로 검사한다. 제품 scroll hook은 변경하지 않았다.
- .env.production Git 추적 해제(로컬 보존), health workflow는 공개 catalog repository variables 2개 사용으로 변경·설정했다. 비밀키 패턴/비익명 JWT staged scan 발견0. 기존 문서 Markdown 줄바꿈 trailing spaces는 그대로 보존한다.
- 새 PC 안내: docs/moemoa/operations/2026-09-24-desktop-setup.md. 외부 catalog canonical/로컬 사용자 자료는 이번 Git 이전 대상이 아니다.

- 최종 Linux Chromium46/46 PASS(동일 기존 scroll hook 유지, 실제 scroll 상한을 고려한 fixture 검증). Vercel 프로젝트 env 조회는403으로 확인 불가. 운영 catalog 연결 손상을 피하기 위해 기존 .env.production의 공개 URL/anon key 두 항목은 추적을 유지하기로 수정했다. privileged 값이 없음을 확인했으며 새 비밀값은 추가하지 않는다. 앞선 추적 해제 기록은 이 결정으로 대체한다. GitHub health는 repository vars 방식 유지.
