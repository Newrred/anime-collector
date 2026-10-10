# MOEMOA 전체 검토 안내 — 2026-10-10

이 문서는 **최신 구현·운영 근거·국가별 조사·남은 일의 읽기 지도**다. 새 출시 계획이나 법률 적합성 보증이 아니다. 배포 진행 상태와 최종 SHA는 [이번 운영 배포 보고](2026-10-10-latest-production-release.md)와 [배포 증거](evidence/2026-10-10-latest-production-release.json)를 우선한다. 문서가 Git에 있다는 사실만으로 운영 적용을 뜻하지 않는다.

## 1. 먼저 읽을 순서

1. [이번 배포 결과](2026-10-10-latest-production-release.md): 최신 소스, CI, Vercel Git 배포, 실제 서비스 SHA, 읽기 전용 확인 결과.
2. [확정 결정](../01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md): 위쪽의 최신 Decision Log와 아래쪽 10월 제품 변경 기록. 오래된 일반 표보다 후속 결정을 우선한다.
3. [현재 구조와 화면 흐름](../CURRENT_STRUCTURE_AND_FLOW.md): 작품·감상·Memory·Board·계정의 관계. 이 문서는 10/9 기준이므로 10/10 가입/관리자/메뉴 변경은 아래 보고로 보완한다.
4. [가입·관리자 운영 보고](2026-10-10-first-signup-ui-release.md), [계정 메뉴·이미지 입력 보고](2026-10-10-account-menu-desktop-images.md): 이번까지 구현한 사용자 흐름과 검증 범위.
5. 이 문서의 국가별 조사 지도와 미완료 목록 → [단일 작업판](03_RELEASE_WORKBOARD.md) → [ExecPlan](01_RELEASE_EXECUTION_PLAN.md).

프로젝트 전체 지침은 저장소 루트의 [CODEX_START_HERE.md](../../../CODEX_START_HERE.md), [AGENTS.md](../../../AGENTS.md), [PLANS.md](../../../PLANS.md)를 따른다. 기본 운영 브랜치는 `master`이며 `codex/phone-test`는 과거 테스트 배포 소스를 보존하는 별도 브랜치다.

## 2. 현재 기능과 운영 범위

| 영역 | 구현·운영 근거 | 구분할 한계 |
| --- | --- | --- |
| 컬렉션·작품·감상 | 선반 편집, 같은 작품의 기억 겹침/펼침, 작품 두 보기, 작품 상세에서 감상 작성·수정·삭제. [Web 적용 기록](../reports/2026-10-05-v84-web-application.md), [구조 지도](../CURRENT_STRUCTURE_AND_FLOW.md) | 취소된 실험적 컬렉션 배치와 과거 필름 장식 시안은 현재 기능이 아니다. Hero 금지. 작품 저장·감상·Memory는 서로 자동 생성하지 않는다. |
| 계정 저장·개인 사진 | 로그인 상태의 새 기록/보드/사진 저장은 기존 계정 반영을 자동 시도. 사진 원본은 기기에 남고 서버에는 비공개 최적화 사본. [저장 계획](../plans/2026-10-08-save-to-account-on-save.md), [사진 신뢰성 기록](../plans/2026-10-09-private-photo-reliability-and-handoff.md) | 로그인만으로 과거 사진을 일괄 전송하지 않는다. Guest는 공식 표지 카드·작품·감상을 기기에 저장하며 개인 사진에는 로그인이 필요하다. |
| 새 가입 | 한국 만14세, 미국·태국 만13세부터 운영 활성. 국가→빈 연/월/일 입력→약관 한 번 수락→Google. 기존회원 로그인은 별도 경로. [활성 보고](2026-10-10-first-signup-ui-release.md) | 생년월일 자가 입력은 신원·보호자 인증이 아니다. 신규 운영 계정의 실제 Google 가입 왕복은 이번까지 미실행이다. |
| 계정·서비스 관리 | `/data/`의 본인 동의 기록·탈퇴, `/admin/`의 지정 운영자 집계와 검토된 가입 정책 일시정지/재개. [관리자 운영 증거](evidence/2026-10-10-service-admin-release.json) | 다른 사용자의 비공개 기록 열람·강제 탈퇴 권한이나 Public 활성 버튼을 추가한 것이 아니다. 지정 계정의 실제 관리자 로그인은 이전 운영 검사에서 확인했다. |
| 최신 메뉴·이미지 입력 | 계정 설정/데이터 관리 진입 통합. 새 이미지 및 교체에 파일 드롭·Ctrl+V/⌘V. [변경 보고](2026-10-10-account-menu-desktop-images.md) | 기능 소스는 `35d88ab`에서 로컬 검증 완료. 운영 반영 여부는 **이번 배포 보고**로 확인한다. 선택만으로 서버 전송하지 않고 기존 저장/교체를 거친다. |
| Public | 공개 보드·미니홈·팔로우·이미지 공개의 코드/스키마와 과거 테스트 근거가 존재 | **운영은 off 유지.** 이번 웹 업데이트는 전체 공개 출시나 애니 캡처·타인 팬아트 공개 승인이 아니다. |

신규 시스템 디자인 카드 작성은 10/8 결정으로 종료했으며 기존 디자인 카드·백업은 보존한다. 예전 명세의 “시스템 디자인 선택 가능”을 신규 UI 요구로 다시 적용하지 않는다.

## 3. 국가별 연령·가입 조사 지도

아래 자료는 모두 Git 추적 대상이다. 이번 인계가 외부 법령을 새로 조사하거나 과거 해석을 확정한 것은 아니다. 각 문서의 **조회일, 직접 열람/검색 발췌/접근 실패, 법률상 사실/서비스 적용 판단**을 함께 검토한다.

| 자료 | 검토할 내용 |
| --- | --- |
| [국가별 실행 정책과 공식 근거](02_POLICY_MARKET_RESEARCH.md) | 한국·미국·EU/EEA·영국·스위스의 최소연령과 처리 근거, 계약능력, 현행 규칙과 예정 법안, 대표자·제공처 조건. §5.1의 유료 업체 비교는 이후 사용자 선택으로 실행 대상에서 제외됐다. |
| [필리핀·태국 재검토](REGIONAL_SIGNUP_PH_TH_20261010.md) | PH 나이정보와 유효한 동의 주체, 별도 체크가 필수라는 과도한 해석의 정정, 단일 수락 후보. TH 무료·비공개 기록 범위의 조건부 적용 판단과 두 차례 반례 검토. |
| [가입 행동 계약의 10/10 국가표](02_ACCEPTANCE_CONTRACTS.md#2026-10-10-c02d04-국가별-재조사-결론w14-기존-계정-연결) | 36개 국가 선택 목록과 유럽 개인정보 동의 연령 근거표. **개인정보 동의 연령표는 계정 가입 최소연령표가 아니다.** C02에는 Pinterest·Instagram·TikTok 사례, 목적별 처리, 기존 계정의 공개 기능 연결 이력도 있다. |
| [EU/UK 무보수 대표자 위임안](EU_UK_UNPAID_REPRESENTATIVE_PLAN.md) | 실제 현지 개인·단체의 무보수 수락, 소재/역할, 서면 위임, 처리내역·연락처, 빈칸 초안. 무료 수임자 확보나 실제 지정은 미완료. 유료 대행 문의·계약은 진행하지 않는다. |
| [10/10 운영 약관 소스](../../../src/components/legal/Terms20261010.astro), [개인정보 소스](../../../src/components/legal/Privacy20261010.astro), [문서 버전 연결](../../../src/features/auth/signupDocuments.js) | 운영 문안과 정확한 정책/약관/개인정보 버전 조합. 10/9·10/10-test 원문과 과거 수락 기록은 불변. `/legal/review/`는 검토본이지 활성 약관이 아니다. |

### 실제 활성과 연구 후보의 차이

| 지역 | 마지막 운영 확인 상태 | 남은 일 또는 적용 한계 |
| --- | --- | --- |
| 한국 | KR14 활성 | 14세가 성년 또는 모든 계약의 독립 체결 연령이라는 뜻은 아니다. |
| 미국 | US13 활성 | 현재 무료·비공개 기록 범위의 판단. 미국 50개 주의 모든 규칙·소송·향후 소셜 기능까지 적합성을 보증한 결과가 아니다. |
| 태국 | TH13 활성 | 무료·비공개 개인 기록과 좁은 콘텐츠 허락 범위의 적용 판단. 공개·광고·유료 등 기능 확대 시 같은 결론을 자동 재사용하지 않는다. |
| 필리핀 | 미활성, 기존 PH 행 보존 | 13세 목표·단일 수락 후보 유지. PH 연령정보 처리의 유효한 동의와 실제 제공처 경로/조건을 함께 마감해야 한다. 전원 보호자 이메일·신분증 또는 PH18로 임의 변경하지 않는다. |
| EU/EEA·영국 | 미활성 | 실제 무보수 현지 대표자 수락·위임, 처리/제공처 조건과 적용 정책 연결이 남는다. 유럽 전체를 영구 금지하거나 16/18세로 일괄 상향한 결정이 아니다. |
| 스위스 | 미활성 | EU 대표자 조건과 별개로 검토한 지역. CH13은 제품 목표이며 법률상 고정된 독립 동의 연령으로 확정한 것이 아니다. |

운영 근거는 [첫 가입 활성 집계 증거](evidence/2026-10-10-first-signup-ui-release.json)와 보고서다. release ID는 `MOEMOA_FIRST_SIGNUP_KR_US_TH_ACTIVATE_PROD_20261010_01`. 이번 메뉴/이미지 입력 배포는 국가 행·최소연령·동의 버전·DB 정책을 변경하지 않는다.

## 4. 검토할 코드와 재현 명령

| 경계 | 주요 코드·검사 |
| --- | --- |
| 가입 입력·나이 | `src/components/auth/SimpleSignup.jsx`, `src/features/auth/birthDateInput.js`, `simpleSignup.js`, `signupDocuments.js` |
| Google 왕복·직접 가입 차단 | `src/server/signup/handler.js`, `backend.js`, `security.js`, `api/signup.js`; migration `20261009130000`, `20261009143000`, `20261010190000` |
| 본인 조회·탈퇴 | `src/server/accountDelete/handler.js`, `src/features/auth/accountPrivacy.js`, `src/components/data/AccountPrivacyPanel.jsx`; migration `20261010170000` |
| 관리자 권한·최초 국가 활성 | `src/components/AdminDashboard.jsx`, `src/features/admin/adminService.js`; migration `20261010180000`, `20261010190000`; `tools/identity/build-first-signup-release.mjs` |
| 메뉴·이미지 입력 | `src/components/TopNavDataMenu.jsx`, `src/components/auth/AuthSheet.jsx`; `src/features/memory/adapters/platform/webImageIntake.js`, `application/imageTransferFiles.js`, `components/useImageFileTransfer.js`, composer/replacement |
| 동기화·이미지 수명 | `src/hooks/useMemoryAccountSync.js`, `src/hooks/useTitleStateSync.js`, `src/features/memory/application/saveNewMemoryToAccount.js`, `autoSavePrivatePhotos.js`, runtime/private image 경계 |
| Git 배포·자동 검사 | `.github/workflows/quality.yml`, `vercel.json`, `scripts/write-build-info.mjs`; CI의 `verify`와 `publication-contract` 결과를 같은 SHA로 대조 |

로컬 검토 환경에서는 기존 잠금 파일을 그대로 사용한다. `package.json`의 Node 지원 범위는 `>=22 <27`, CI는 Node22다. 새 설치가 필요하면 `npm ci`를 사용하며 검토를 위해 의존성을 업그레이드하지 않는다.

```text
npm run test:unit
npm run build
node scripts/run-desktop-image-e2e.mjs
node scripts/run-simple-signup-e2e.mjs
node scripts/run-admin-e2e.mjs
```

브라우저 runner는 격리된 로컬 합성 환경이며 실제 Google·운영 DB·사용자 사진 테스트가 아니다. 같은 로컬 서버/산출물을 사용하는 실행은 동시에 겹치지 않게 한다. PostgreSQL 계약과 추가 웹/카탈로그 회귀의 정확한 명령은 [quality workflow](../../../.github/workflows/quality.yml)를 따른다. 이 명령을 문서에 나열한 것을 이번 전체 실행 PASS로 세지 않는다.

- 기능 소스 `35d88ab` 로컬 결과: unit **585/585**, desktop 관련 Chromium **51/51**, build **32 pages**. [실패 원인·수정·범위](2026-10-10-account-menu-desktop-images.md#6-검증-결과).
- 이전 가입 배포 `6a2beff` 결과: CI `38048163986` 전체 성공, 운영 기존회원 Google 왕복 및 관리자 화면 확인. [원본 보고](2026-10-10-first-signup-ui-release.md#운영-적용-기록).
- 최신 배포 후보의 CI와 운영 확인은 [이번 배포 보고](2026-10-10-latest-production-release.md)를 따른다. 이전 수치와 새 검사·중복 재실행을 합산하지 않는다.

## 5. 아직 완료로 표시하면 안 되는 항목

- **실기기:** Windows/macOS 캡처 앱→실제 클립보드→붙여넣기 왕복. 합성 ClipboardEvent 회귀는 완료했지만 OS 실기기 확인은 아니다. Safari 추가 검사와 Android 출시는 이번 범위에서 제외/PASS 아님.
- **신규 운영 가입:** 운영의 실제 새 Google 계정 가입·최종 수락 왕복은 미실행. 이전 테스트 계정의 가입→합성 사진 저장→탈퇴→사진 정리 PASS는 [별도 증거](evidence/2026-10-10-test-receipts-preview.json)다. 운영 기존회원 로그인 PASS와 구분한다.
- **PH·유럽 후속:** 위 국가표의 실제 조건·제공처 경로·무보수 대표자 수임. 기존 Supabase Edge로 가입 경로를 옮기는 안은 [ExecPlan](01_RELEASE_EXECUTION_PLAN.md)의 기술 대안이며 구현·배포되지 않았다. 이것만으로 모든 EU 처리 계약 문제가 해결되는 것도 아니다.
- **복구·보존 운영:** 외부 암호화 사본 회수와 4,308개 파일 무결성은 확인했지만 독립 복구키 보관, 전체 DB 재가동·최신 삭제 대조, 회전/RPO/RTO는 미완료. [외부 복구 증거](evidence/2026-10-10-external-backup-recovery.json). 파일 복호화 성공을 서비스 재개 가능으로 해석하지 않는다.
- **삭제 응답 보존 보완:** `tools/operations/retention-response-candidate.sql`은 test 적용·검증 근거가 있으나 마지막 기록 기준 운영 미적용. [보존·삭제 증거](evidence/2026-10-10-retention-closeout.json). 지원/보안 기록 기한과 경보 실제 수신 등 기존 운영 잔여도 유지한다.
- **Public:** 공개 활성, 일반 UGC 운영 마감, 애니 캡처·타인 팬아트의 별도 권리 게이트는 이번 배포에 포함되지 않는다. 기존 공개 테스트 PASS를 현재 운영 허용으로 읽지 않는다.

이 목록은 구체적인 미완료·검증 한계다. 이를 이유로 이미 완료한 세 나라 가입/계정 기능을 “전부 미완료”라고 바꾸거나 같은 승인·테스트를 반복 요청하지 않는다.

## 6. 과거 문서를 읽을 때의 주의점

- `CODEX_START_HERE`, release-v2 `00/01/03`는 날짜별 실행 이력을 누적한다. 아래의 “현재/최신/다음”은 해당 시점 기록이다. 최신 배포 보고·작업판 상단과 배포 SHA를 먼저 본다.
- 확정 결정의 옛 `AGE-01` 표와 9월/10월9일 일부 절에는 12세·KWS·보호자 회신 이력이 남아 있다. 현재는 한국14/그 외 목표13이며 KWS·전원 보호자 이메일·유료 인증을 채택하지 않았다.
- `02_ACCEPTANCE_CONTRACTS` 상단의 test 연결 대기, TH 미확정 등은 이후 운영 보고보다 이른 조사/구현 기록이다. 원문을 지우지 않았으며 현재 세 나라 활성 사실은 별도로 확인됐다.
- `02_POLICY_MARKET_RESEARCH`의 DataRep 유료 비교·추천은 과거 대안이다. 이후 무보수 현지 개인·단체만 검토하라는 선택이 우선한다.
- [10/8 설정 지도](../operations/2026-10-08-configuration-map.md)는 위치 파악 자료로 사용한다. 옛 “운영 signup 미설치/off”, “Public schema 없음”, “자동 분석 기본on”, `admission_enabled=false` 복귀 절차를 현재 실행 명령으로 재사용하지 않는다. 최신 안전한 가입 pause는 **signup enabled=false, admission=true 유지**이며 실제 변경은 정확한 정책 revision·승인 범위로 수행한다.
- 코드에 모든 국가 목록·Public route·옛 Home·시스템 디자인 renderer가 있다는 것과 현재 해당 기능의 신규 사용/운영 허용은 다르다. 활성 정책·사용 route·feature flag·서버 권한을 함께 확인한다.

## 7. Git에 포함되는 것과 제외되는 것

코드·테스트·migration/운영 도구·국가별 조사·결정·보고·개인정보 없는 집계 증거가 검토 대상이다. 주요 조사 4개 문서는 이번 인계 이전부터 추적되고 있으며, 10/10 인계 점검에서 `docs/`의 미추적/ignored 문서는 0개였다. 이번 새 인덱스와 배포 기록은 같은 Git 인계에 추가한다.

환경 비밀값, 브라우저 로그인 세션, 실제 개인 사진·메모, DB dump, 백업/복구키, 로컬 캐시·실제 계정 화면 캡처는 업로드 대상이 아니다. 기존 문서의 로컬 캡처 경로는 다른 PC에서 열리지 않을 수 있다. 합성 테스트는 위 runner로 재현하고 운영 개인 화면은 해당 계정으로 직접 확인한다.

## 8. Pro 검토 요청에 사용할 내용

> `master`와 `docs/moemoa/release-v2/2026-10-10-pro-review-index.md`부터 읽고, 이번 배포 보고의 소스 SHA·CI·실제 moemoa.xyz 버전을 대조해 MOEMOA 전체 상태를 검토해 주세요. 구현·운영 완료·합성 테스트·실기기 확인·법률상 사실·적용 판단·미완료를 분리하고 과거 문서의 상태를 현재로 재사용하지 마세요. 계정 격리/가입 우회/삭제/비공개 이미지 노출/데이터 손실을 우선하고, 국가별 조사와 실제 활성 정책, 관리 권한, 메뉴 통합 및 드롭·붙여넣기, 기존 기록·동기화·백업을 확인해 주세요. 각 문제는 심각도·파일/줄 또는 실행 근거·영향·최소 수정안을 제시하고, 검증하지 못한 부분은 이유를 표시해 주세요. 이번은 검토 요청이므로 운영 DB·가입 국가·Public·계정·개인 사진을 변경하거나 약관을 대신 수락하지 마세요. 이미 확정된 무료·간단가입·무보수 대표자 방향을 새 유료 인증/일괄 연령 상향으로 바꾸지 말고, 정말 필요한 조건만 공식 근거와 서비스 적용 범위로 특정해 주세요.

이 인덱스 작성에는 근거 기반 문서 정리 기준을 적용했다. 외부 법률 재조사·코드/DB 변경·새 정책 결정은 없으며, 실제 배포 완료 판정은 상단의 별도 결과 보고가 담당한다.
