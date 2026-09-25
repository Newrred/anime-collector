# MOEMOA — bbff3d4 출시 잔여 현황

검토 기준일: 2026-09-25  
기준 자료: `MOEMOA-Pro-Review-bbff3d4.zip`  
기준 계획: `docs/moemoa/release-v2/`의 기존 M0~M5 / W01~W20  
문서 역할: **현재 상태를 기존 진행판에 반영하기 위한 검토 요약. 새 실행 계획·두 번째 진행판이 아니다.**

## 1. 핵심 판단

**기능을 처음부터 만드는 구간은 상당 부분 지났다. 현재는 실제 공개 흐름을 서버·이미지 전달·다른 사용자까지 연결하고, 운영 조건과 정확한 출시 후보를 닫아야 하는 구간이다.**

진행판의 `M 1/6`, `W 4/20`은 실제 환경·운영 승인까지 포함해 종료한 항목 수다. 구현률 20%나 남은 신규 기능 16개를 뜻하지 않는다. 반대로 로컬 테스트가 많다는 이유로 남은 일이 승인 버튼만 누르는 것이라고 보아서도 안 된다. 공개 이미지의 실제 전달과 철회, 실제 관리자 조치, 운영 한도·경보·자료 인계가 아직 증명되지 않았다.

공개 보드·미니홈·팔로우·최소 운영을 포함하는 목표를 유지한다. Private-only 베타로 목표를 대체하지 않는다. 최신 인계서는 Android를 **이번 실행에서 제외**했다고 기록한다. Android 추가 작업을 이번 마감의 자동 선행조건으로 복원하지 않는다. 다만 제품의 영구 지원 종료 또는 Android 출시 검증 통과를 의미하지 않으며, 최종 후보 채널은 D02에 구분해서 기록한다.

## 2. M0~M5 현재 위치

| 단계 | 구현·검증 상태 | 아직 닫지 못한 것 |
|---|---|---|
| M0 범위·원본 고정 | 종료 | 최신 날짜 기록과 오래된 상태 표를 같은 원장 안에서 정리 |
| M1 기록·계정 신뢰성 | 로컬 수정·검증, 실제 Google A/B 및 일부 왕복·격리 검증까지 진전 | 최신 후보 CI/배포 보호, 실제 큰 sync·기존 캐시 삭제 전파 등 미실행 계약 |
| M2 공개 보드·이미지 | 서버 SQL·UI·이미지 변환/철회 및 로컬 테스트 구현 | 활성화된 테스트 서비스에서 실제 게시·익명 열람·파일 전달·철회 |
| M3 미니홈·팔로우 | 선택 전시·관계 제어·공유/로그인 복귀 구현 및 로컬 검사 | 실제 계정/별도 브라우저의 게시→방문→팔로우→재방문·해제·차단 |
| M4 운영·관리·갱신·복구 | 신고/조치/자원 통제/카탈로그 전환 도구와 복원 기반 | 담당자·정책·한도·경보 수신, 실제 이미지/카탈로그 파일과 최신 철회 이력 인계 |
| M5 최종 후보·출시 | 로컬 종합 검사와 후보 거부 검사 존재 | 동일 SHA 검증, 정확한 후보 승인, Git 기반 배포·운영 smoke |

이 표는 이번 검토의 해석이다. 기존 원장의 W를 임의로 DONE으로 바꾸지는 않았다.

## 3. 이미 확보한 증거 — 처음부터 반복할 대상이 아니다

### 제공 자료에서 확인

- `2026-09-25-pro-interim-review.md` 및 진행판: 인계 직전 **unit 320 PASS, Web build 18 pages PASS**. 이번 응답에서 재실행한 숫자가 아니다.
- W16~W20 당시 결과: unit 320, catalog 256(별도 skip 2), Chromium 174(별도 skip 3), SQL 235, native 31. 당시 소스 hash 기준으로 기록된 과거 검증이며 모든 결과가 현재 후보 SHA에서 다시 실행됐다는 뜻은 아니다.
- 실제 Google 계정 A/B, 서로 다른 origin의 별도 로컬 저장소에서 카드 생성·복원·감상 수정·격리·삭제 및 비부활 검사 기록. **동일 PC의 다른 origin이지 다른 물리 기기 검증은 아니다.**
- 실제 JWT/HTTP/Storage **33/33 PASS**: A 12, B 12, anon 9. 기본 개인 자료 격리와 private bucket 접근 차단을 증명한다. 공개 활성 상태에서 이미지가 성공적으로 전달됨을 증명하지 않는다.
- hosted 테스트 DB 전체 dump 확보 후 선택한 **5개 schema 72개 table**의 행 건수·digest·RLS·client table grants를 격리 PostgreSQL에서 대조한 복원 기록.
- 16×16 WebP, 60bytes 합성 Storage 객체의 사본·재다운로드 hash·decode 일치. 실제 공개 이미지 수명주기·대용량 파일 복구 증거는 아니다.
- 오래된 local DB backup의 공개 부활 대조군과 최신 철회 fence 재적용 후 차단을 검증. 이 로컬 검사는 실제 운영의 최신 journal 보관 체계를 대신하지 않는다.

**종료할 반복:** 테스트 계정/키를 다시 준비하거나, PostgreSQL 복원 도구를 다시 구축하거나, 새 변화 없이 같은 72 table 복원을 계속 반복하는 일. 최종 후보의 관련 변경 회귀와 실제 운영 설정 검증은 별개로 수행한다.

### 이번 응답에서 독립 실행

- Node 22.16.0에서 `node --test --test-concurrency=2 tests/unit/*.test.mjs`.
- **276개 PASS**, 9개 파일은 `@supabase/supabase-js` 또는 `sharp` 부재로 테스트 본문 실행 전에 로드 실패. 실행된 assertion 실패 0. 전체 suite exit 1이므로 전체 통과라고 표시하지 않는다.
- 원본 publication controller와 예약 상태를 모사한 함수로 이미지 재시도 문제를 재현했다. 실제 hosted API·DB·브라우저 재현은 아니다.
- ZIP 원본 784개 파일을 검사 후 대조해 변경 0개. 제품 코드·운영 DB·배포·계정·feature flag 변경 없음.

## 4. 출시까지 남은 최소 네 묶음 — 새 M단계가 아니다

### A. 실제 공개 사용자 흐름 마감 — W06~W15, W18/W19

기존 테스트 환경과 A/B 계정을 사용한다. 필요하면 기존 실제 연결 구성을 사용한 격리 preview에 이미지 endpoint를 배치한다. 운영 Public은 변경하지 않는다. 합성 RPC에서 다시 동일한 성공을 만드는 것으로 이 검증을 대체하지 않는다.

1. A: 지원하는 기록/보드 동기화 → 공개 필드·이미지 선택 → 서버 미리보기 → 명시적 동의 → 게시.
2. 익명 새 세션: 작성자의 local storage/로그인 없이 공유 링크와 실제 이미지를 조회.
3. A: 공개 보드를 선택한 미니홈 게시. B: 미니홈 방문 → 팔로우 → 내 목록에서 재방문 → 해제.
4. B: 신고·차단. 승인된 테스트 운영자: 신고 조회 → 임시 가림/제한 → 결과·통지 확인 → 허용된 복구.
5. A: 카드의 모든 위치 공개 중지·보드 철회·원본 삭제. 기존 공개 보드/미니홈/이미지 URL에서 신규 요청이 실제로 차단되고 private 원본 계약은 유지되는지 확인.
6. 실패/중단/응답 유실/중복 실행/한도 초과/기존 캐시·오래된 기기 상태를 관련 기존 Q에 붙여 검사. 새 계정 테스트의 기본 격리 성공을 모든 mutation·공개 RPC의 성공으로 일반화하지 않는다.

표지·시스템 디자인뿐 아니라 **허용한 사용자 이미지**의 실제 bytes 경로를 포함해야 한다. 사용자 이미지의 승인 레코드와 정책 revision, 서버/클라이언트 flag가 맞아야 한다. 권리 검사를 제거해서 통과시키지 않는다. 원본 전체 자동 업로드와 공개용 파생본 준비는 계속 구분한다.

마감 결과: 기존 Q08~Q19 등 관련 검증에 **실제 환경/역할/후보/URL·로그 위치**를 기록. 발견한 실패만 기존 W에 흡수하고 회귀를 돌린다.

### B. 운영값·담당·실제 경보 확정 — D03~D05, W14~W17

| 결정 | 이번에 정해야 하는 내용 | 완료 증거 |
|---|---|---|
| D03 비용·한도 | 초기 수용 규모/월 예산, 정상 초기 동기화·게시 부하를 측정한 한도, 경보 수신자와 중단 책임 | 측정·정책 설정·실제 테스트 경보 수신·차단/해제 |
| D04 정책·담당 | 운영 주체, 허용 이미지·연령 범위, 신고·권리 문의·계정 삭제 담당, 통지/이의 처리 | 실제 공개 범위와 일치하는 안내, 합성 요청 접수→조치→통지 |
| D05 보존·복구 | 허용할 데이터 손실 범위/복구 목표, 공개 철회 지연, DB/이미지/canonical 사본과 최신 철회·제재 journal | 보관 위치·접근권한·담당자, 실제 필요한 파일·참조 복구 및 공개 비부활 |

수치·법적 적합성·운영 연락처를 이 검토서가 임의로 확정하지 않는다. 거대한 관리자 대시보드는 필요하지 않으며 현재 구현한 명령/RPC와 제한된 운영 도구의 실제 사용을 확인한다. 단순 사본 확인과 Supabase 서비스 전체 재구성은 다른 범위다. 범용 DR 플랫폼으로 확장하지 않는다.

### C. 정확한 후보로 회귀·CI·migration·복구를 묶기 — W03/W16~W20

- 기존 `2026-09-24-w20-candidate.json`은 `sourceCommit:null`, catalog hash null, D01~D06 PENDING, 로컬 `.cache` 증거 경로를 사용한 과거 후보 거부용 파일이다. 실패가 정상이며 현재 승인된 후보가 아니다. 상태를 PASS로 덮어쓰지 말고 최신 후보에 맞춰 작성한다.
- 검토 브랜치 bbff3d4 이름만으로 원격 CI/운영 배포가 확인되는 것은 아니다. 현재 quality workflow는 master push/PR/수동 실행이므로 review branch push 자체의 성공 검사도 별도로 확인한다.
- 최종 소스 commit, 테스트 artifact, 실제 설정·DB migration·catalog release를 묶는다. 동일 소스의 지원 범위 회귀를 한 번 수행하고 변경 후 영향 범위만 재실행한다.
- 진행판의 운영 `0330a54`, `workingTreeDirty=true`는 제공된 관찰 기록이다. 이번 응답에서 운영 사이트를 새로 조회하지 않았다. 원인을 확인하되 표시를 무조건 false로 덮지 않는다.
- 테스트에 적용한 17 migration의 원격 timestamp와 로컬 파일 timestamp가 다르다고 인계서가 경고한다. bootstrap 매핑/실제 정의를 대조한 후 운영 적용·복구 경로를 준비한다. 전체 `db push`를 무조건 재실행하거나 이력을 임의 정리하지 않는다.
- package 보안 advisory/권한/RPC 검토는 최종 후보에 한정한다. 이전 정적 분석의 전체 점수를 올리기 위한 광범위 refactor는 하지 않는다.
- `check-release-candidate.mjs`는 android PASS를 고정 필수로 요구한다. **현재 실행 제외**와 **최종 Web-only 후보 승인**을 구분한다. D02가 최종 Web-only 후보를 명시 승인한 경우에만 플랫폼별 필수 검사와 승인 근거 있는 N/A를 표현하도록 최소 수정한다. Android 검증을 가짜 PASS로 채우거나 제품의 영구 지원을 삭제하지 않는다.

### D. 정확한 운영 승인 → Git 배포 → 실서비스 확인 — D06/W20

최종 commit/DB/catalog/client·server flags/정책 revision/이미지 API 설정/롤백 대상을 승인받은 뒤 기존 Git master→Vercel 경로로 배포한다. 배포 READY만으로 종료하지 않고 운영 도메인의 로그인·기록·공개·이미지·미니홈·팔로우·철회·health를 승인된 테스트 자료로 확인한다. 현재 검토는 이 작업을 승인하거나 실행하지 않는다.

## 5. 이번에 추가로 확인한 수정·연결 지점

### B01. 공개 이미지 준비 실패 후 같은 화면에서 재시도 불가 — W08 중심, W09 회귀

**증거 수준:** 실제 controller 실행 + SQL 예약 상태를 모사한 함수. hosted/브라우저 재현 아님.

- `createPublicationController.js:136–149`는 asset ID와 source version당 operation ID를 한 번 만들고 유지한다. `cancel()`도 imageOperations를 비우지 않는다.
- `handler.js:45–58`의 원본 hash 불일치·변환/Storage 실패는 예약을 FAILED로 정리할 수 있다.
- `20260923093000_memory_public_images.sql:67–71`은 기존 같은 operation이 READY가 아니면 `ASSET_OPERATION_UNAVAILABLE`로 거절한다. 후속 migration에서 이 예약 함수의 재시도 의미를 교체하는 정의는 찾지 못했다.

재현: 잘못된 원본 → `SOURCE_IMAGE_MISMATCH`; 올바른 원본으로 변경 후 재시도 → `ASSET_OPERATION_UNAVAILABLE`; controller 취소 후 재시도 → 같은 거절. 화면을 닫아 controller를 새로 만들면 다른 ID를 얻을 수 있으므로 계정의 영구 불능은 아니다.

**최소 수정 결과:** 이미 완료됐는지 불확실한 응답은 같은 operation 상태를 먼저 확인하고, 확정된 실패는 정리/새 시도로 회복한다. 잘못된 파일을 고른 뒤 올바른 파일을 선택하면 화면을 강제로 다시 열지 않아도 성공해야 한다. 무조건 매 요청마다 새 ID 생성·기존 Storage 덮어쓰기는 금지한다. 파일·quota·공개 원본 상태를 보존한다.

### U01. 보드 공유 방문자 → 작성자 미니홈 연결 — W13의 작은 마감

**증거 수준:** 화면/DTO 소스 확인, 브라우저 재현 아님.

`PublicMemoryBoard.jsx`와 `PublicBoardSnapshot.jsx`에는 보드·카드·공유·신고는 있지만 작성자 미니홈 이동이 없다. `publicationSnapshot()`도 공개 작성자 home ID를 보존하지 않는다. 미니홈 URL로 직접 들어오면 팔로우 경로가 있으나 보드 URL로 진입한 사용자의 흐름은 연결이 부족하다.

첫 출시의 "공유 보드 구경→작성자 소개→팔로우"를 연결하려면, 공개된 작성자 미니홈이 있을 때만 안전한 공개 home ID/닉네임으로 링크를 제공한다. Auth UID·이메일·private profile을 노출하지 않는다. 작성자가 해당 연결을 공개하는 의미를 알 수 있어야 하고, 홈이 없거나 철회/가림 상태면 안전하게 생략한다. 새로운 검색·추천·피드는 만들지 않는다. 이 연결을 제품상 하지 않기로 결정했다면 미니홈 공유를 기본 진입점으로 명시해 기대 흐름을 맞춘다.

### O01. 사용자 이미지 공개 승인 절차는 실제 운영으로 연결해야 함 — D04/W08/W14

이는 이미지 권리를 더 제한하자는 새 제안이 아니다. 현재 SQL은 private `memory_public_image_rights`에 해당 자산/버전의 신뢰된 승인 기록을 요구한다. 체크박스만으로 이 레코드는 생성되지 않는다. 소스에서 확인되는 명시적 INSERT는 로컬 테스트 fixture다. 공개 시스템이 작동하려면 승인된 이미지 범위와 운영자의 승인/철회 실행 경로를 실제로 인계해야 한다. 허가된 표지의 VisualAsset 사용 승인을 다시 묻거나 사용자 private 사진 전체를 공개하지 않는다.

## 6. 진행판의 오래된 상태 표를 한 번만 정리

새 문서를 더 만드는 것이 아니라 `03_RELEASE_WORKBOARD.md`의 현재 표와 Q/D 행을 갱신한다.

| 현재 남아 있는 과거 표현 | 최신 증거에 맞는 표현 |
|---|---|
| D01 NOT_READY, 테스트 A/B 없음 | 환경·키·A/B 확보. 기본 OAuth/격리/복원 실검증 있음. 공개 서비스 통합 검사만 미완료 |
| W06~W15 전부 환경 미제공 | 구현·로컬 검증을 유지하고 실제 성공한 검사를 표시. 남은 공개 흐름은 실행 가능한 READY/검증중과 진짜 외부 차단을 분리 |
| Android 무조건 미제공 차단 | 이번 실행 제외. 최종 배포 채널·검사 범위를 D02에 따로 정리 |
| bbff3d4 인계 후에도 새 후보 미커밋 | 검토 스냅샷/브랜치 인계 완료와 정식 RC 미고정을 분리 |
| 모든 복구 미검증 | 72 table 복원·사본·stale fence 대조는 확보. 실제 운영 사본/정책/전달 경계가 잔여 |

코드 구현/자동 테스트/실환경/승인을 별도 열로 보고, 최종 DONE 집계는 원래 완료 계약을 충족할 때만 올린다. 위 표가 W의 자동 완료 선언은 아니다.

## 7. 다음 Codex 작업 지시문

```text
기존 docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md에서 재개한다.
M0~M5, W01~W20와 공개 출시 목표를 유지하고 새 계획 트리를 만들지 않는다.

최신 9/25 기록을 기준으로 D01 환경/키/A·B 미제공이라는 과거 표시를 갱신한다.
Android는 현재 실행 제외를 유지하며 실제 최종 배포 채널 승인과 혼동하지 않는다.
기본 DB 연결·A/B 격리·72 table 복원은 변경/실패 근거 없이는 반복하지 않는다.

다음 본 작업은 W07~W15의 실제 공개 end-to-end 마감이다.
먼저 W08 안에서 공개 이미지 준비 실패 후 재시도 문제를 재현·최소 수정하고,
같은 operation의 불확실한 완료를 안전하게 확인하는 계약을 유지한다.
W13에서 공유 보드→공개 작성자 미니홈→팔로우 연결을 확인한다.

기존 테스트 환경과 실제 A/B/익명·승인된 테스트 운영자로
게시→실제 이미지 열람→미니홈→팔로우/재방문→신고/차단/조치→철회를 검증한다.
합성 RPC만 사용한 검사를 실제 서버 통합 PASS로 기록하지 않는다.
필요한 테스트 flag/관리권한/preview 설정은 기존 승인 범위를 먼저 확인하고,
권한이 부족하면 필요한 정확한 항목만 D01에 요청한다. 운영 Public은 변경하지 않는다.

D03~D05는 예산/정책/담당/복구의 한 묶음으로 병행 정리한다.
현실적으로 필요한 한도를 측정하되 임의 사업 수치를 확정하지 않는다.
발견 결함은 기존 W에 흡수하고 실제 새 실패가 없는 인프라 재구축은 하지 않는다.
마지막에 기존 W20에서 정확한 후보·필수 CI·migration/config/rollback·D06 승인을 닫는다.

보고: 이번에 새로 통과한 실제 사용자 행동 / 대상 소스와 근거 /
현재 W 잔여 조건 / 진짜 외부 차단 / 다음 작업 1개.
```

## 8. 근거 사용 범위

이번 판단은 첨부 ZIP의 현행 코드·인계서·진행판·포함된 증거에 근거한다. 운영 도메인·GitHub Actions·Supabase를 이번에 다시 조회하거나 수정하지 않았다. 이전 첨부 일부가 만료됐어도 이번 ZIP에 필요한 V2 계획과 검증 자료가 포함되어 있어 추가 업로드가 필요하지 않았다. 비포함 `.cache` 원본 로그와 실제 hosted DB dump를 다시 열어 검증했다고 주장하지 않는다.

검토한 소스의 공개 이미지 재시도 모형과 unit 실행 결과는 별도 evidence로 저장했다. 새로운 기능 개발이나 운영 범위 변경을 자동 승인하는 문서가 아니다.

---

# 부록: 원본 근거 발췌

아래는 ZIP 원본의 해당 줄을 변경 없이 발췌했다. 전체 소스의 버전은 첨부 ZIP을 기준으로 한다. 표의 과거 상태와 최신 날짜 기록이 다르면 최신 기록을 우선하되 검증 범위를 넓혀 해석하지 않는다.

## E01 최신 검토 범위/남은 순서

`docs/moemoa/reports/2026-09-25-pro-interim-review.md:1–68`

```text
1: # MOEMOA Pro 중간 검토 인계 — 2026-09-25
2: 
3: ## 검토 대상과 목적
4: 
5: 검토 브랜치: `review/pro-interim-2026-09-25`. 비교 기준: `0330a5401e0112f2e36886a6826812219e7aed89`.
6: 이 문서가 포함된 커밋의 소스 전체를 검토한다. GitHub master/현재 운영 화면을 이 개발본과 동일하다고 보지 않는다.
7: 
8: 목적은 Pro의 V2 출시 계획에서 실제로 무엇을 구현했고 무엇이 남았는지 확인하고, 추가 계획을 늘리지 않고 출시까지의 최소 작업 순서를 판단하는 것이다. 중간 검토용이며 RC 승인·출시 완료 보고서가 아니다.
9: 
10: 현재 목표는 **개인 기록 + 계정 + 공개 보드 + 공개 미니홈 + 팔로우 + 최소 운영**이다. Android는 사용자가 이번 실행에서 제외했으며 제품의 영구 지원 범위를 변경한 것은 아니다. 최근 테스트 환경/복구 작업은 충분한 기본 증거를 확보했으므로 새로운 실패나 변경 없이 반복하지 않는다.
11: 
12: ## 읽는 순서
13: 
14: 1. 이 문서: 전체 상황과 검토 요청.
15: 2. [단일 진행판](../release-v2/03_RELEASE_WORKBOARD.md): 현재 상태·최신 날짜 기록. 과거 W행의 당시 미제공/미검증 설명보다 최신 증거를 우선한다.
16: 3. [Pro V2 목표](../release-v2/00_CODEX_START_HERE.md), [기존 실행 계획](../release-v2/01_RELEASE_EXECUTION_PLAN.md), [수용 계약](../release-v2/02_ACCEPTANCE_CONTRACTS.md): 목표/완료 조건/이전 지적25개 매핑.
17: 4. [확정 제품 결정](../01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md), [현재 UI·코드 감사](2026-09-24-release-surface-audit.md).
18: 5. 아래 소스 지도와 증거. 문서의 완료 주장보다 실제 코드와 검사 범위를 우선한다.
19: 
20: 상시 갱신하는 진행 원장은 여전히 하나다. 이 인계서는 새로운 계획 트리나 두 번째 진행판이 아니다.
21: 
22: ## 구현 상태와 주요 소스
23: 
24: | 영역 | 현재 구현/확인 범위 | 검토할 파일 |
25: |---|---|---|
26: | 개인 기록·동기화 | 취소/복귀·재개·owner 경계, 실제 복원 시 visual 연결 누락 수정 | `src/features/memory/adapters/indexeddb/{IndexedDbMemoryRepository,memorySyncStore}.js`, `tests/memory-indexeddb.spec.ts` |
27: | 로그인 | PKCE callback/내부 복귀, Google 계정 선택 | `src/features/auth/webOAuth.js`, `src/components/auth/AuthCallbackClient.jsx`, `src/repositories/authRepo.js` |
28: | 공개 보드 | 선택 필드·미리보기·명시 동의·게시·익명 읽기 | `src/features/memory/application/createPublicationController.js`, `src/features/memory/components/{MemoryPublicationPanel,PublicMemoryBoard,PublicBoardSnapshot}.jsx` |
29: | 이미지·철회 | 서버 변환·비공개 파생본, 공개 접근 재검증, 원본 삭제 전 철회 | `src/server/publicImages/`, `src/features/memory/application/{preparePublicImage,retirePublicationBeforeDelete,deleteMemoryCard}.js` |
30: | 미니홈·팔로우 | 선택 전시·미니홈 reader·관계 제어·공유 링크 | `src/features/memory/application/createMinihomeController.js`, `src/features/memory/components/{MemoryMinihome,PublicMinihome,MemoryRelationships,PublicLinkCopy}.jsx` |
31: | 신고·운영 한도 | 신고/차단/제재/감사·서버 자원 한도 | `src/features/memory/components/MemorySafety.jsx`, `supabase/migrations/20260923213901_memory_moderation.sql`, `20260924115258_memory_resource_controls.sql` |
32: | 카탈로그·복구 | checked release 전환·파일 hash·삭제 fence 복원 | `tools/catalog-preview/uploader.mjs`, `supabase/migrations/20260924121214_catalog_release_transitions.sql`, `tools/publication-boundary/restore-roundtrip.sh` |
33: | 출시 검사 | 필수 증거 없는 후보 거부·CI 연결 | `scripts/check-release-candidate.mjs`, `.github/workflows/quality.yml`, `tests/publication-ui.spec.ts` |
34: 
35: 운영용 과거 schema와 테스트에 적용한 새 migration을 혼동하지 않는다. 테스트17개 migration 이력과 원본 이름/해시는 [bootstrap 증거](../release-v2/evidence/2026-09-24-hosted-test-bootstrap.json)에 있다. 테스트의 원격 migration timestamp는 로컬 파일 timestamp와 다르므로 무조건 db push하지 않는다.
36: 
37: ## 검증 수준
38: 
39: | 증거 | 결과 | 증명하지 않는 것 |
40: |---|---|---|
41: | 이번 인계 전 재실행 | unit320 PASS, 웹 build18 pages PASS | 전체 브라우저/실환경 검사의 이번 커밋 재실행 아님 |
42: | [W16~W20 당시 검사](../release-v2/evidence/2026-09-24-w16-w20-validation.json) | unit320, catalog256(skip2), Chromium174(skip3), SQL235, native31 | 현재 소스 전체와 동일한 SHA의 원격 CI 아님. Android 실기기 미검증 |
43: | 실제 OAuth/기록 왕복 | 두 Google 계정, 별도 origin 복원·수정·삭제·격리 확인 | 서로 다른 물리 기기 검증 아님; 진행판 최신 기록 참조 |
44: | [실제 API/Storage](../release-v2/evidence/2026-09-25-hosted-api-storage.json) | A/B/익명33 PASS | 모든 RPC 공격 조합, 활성 공개 이미지/CDN 미검증 |
45: | [오래된 복원 SQL](../release-v2/evidence/2026-09-25-local-stale-recovery.json) | SQL236 PASS, 이미지14 PASS | 합성 local auth/storage; 이미지 backend는 mock |
46: | [서버 연결·파일 사본](../release-v2/evidence/2026-09-25-server-connection.json) | 테스트 서버 연결·비공개60bytes 이미지 hash/decode 일치 | Storage 서비스 전체 복구 아님 |
47: | [hosted DB 복원](../release-v2/evidence/2026-09-25-hosted-db-recovery.json) | 전체dump, 선택5schema72테이블·RLS·client table grants 일치 | Supabase Auth/Storage/Realtime 서비스·cron/vault·운영 PITR 복구 아님 |
48: 
49: 증거 JSON의 과거 source hash는 당시 실행에 해당한다. `.cache` 로그, 로컬 DB dump 및 자격증명은 Git에 포함하지 않는다. 원격 검토자는 포함된 결과 보고와 테스트 소스를 검토할 수 있지만, 비포함 원본 로그를 직접 재검증했다고 주장해서는 안 된다.
50: 
51: ## 출시까지 남은 최소 작업
52: 
53: 1. **실제 공개 기능 통합**: 테스트 환경에서 보드/이미지 게시→익명 열람→미니홈→팔로우→신고/차단/관리 조치→철회까지 실제 서비스 연결로 확인하고 발견 결함을 수정한다. 배포 환경 이미지 전달과 캐시/철회 경계도 포함한다.
54: 2. **운영값 확정**: D03 비용·지원 규모·한도·실제 경보 수신, D04 운영주체·허용 이미지·신고/삭제 담당과 정책, D05 보존·복구 목표/자료 인계. 코드의 기술 상한을 사용자 승인된 상품 약속으로 바꾸지 않는다.
55: 3. **후보 고정**: 최신 후보 회귀·보안 advisory/실제 노출 API 확인, CI, 배포 provenance의 `workingTreeDirty=true` 원인 확인, 운영 migration/config/rollback 준비. Pro 검토용 커밋은 자동 출시 후보 승인이 아니다.
56: 4. **운영 승인 및 검증**: D06에서 정확한 커밋/DB/catalog/flags 승인 후 master Git 연동 배포, 운영 도메인 핵심 흐름 확인. 별도 승인 없이 운영 DB/Public을 변경하지 않는다.
57: 
58: D01의 환경·계정·비밀값 제공은 확보됐다. 실제 공개 동작 검사 잔여를 환경 미제공으로 계속 표시하지 않는다. 진행판의4/20은 엄격한 작업 종료 개수이지 구현률20%가 아니다. [기존 후보 JSON](../release-v2/evidence/2026-09-24-w20-candidate.json)의 PENDING은 당시 상태이며 이번 인계만으로 PASS로 바꾸지 않는다.
59: 
60: ## Pro에 요청하는 검토
61: 
62: - V2 계획·수용 계약과 실제 소스 사이에 출시 필수 기능 누락/잘못된 완료 주장이 있는가?
63: - 계정 경계, 공개 DTO, 이미지 업로드 동의, 철회/삭제, 신고/차단·제재, 서버 한도에 실제 결함이 있는가? 구체적인 재현 경로와 파일 위치를 제시해 달라.
64: - 테스트 환경 준비/복구 작업 중 더 이상 반복할 필요 없는 부분과 실제 공개 통합에 꼭 필요한 검사를 구분해 달라.
65: - W 목록을 처음부터 재설계하지 말고 기존 항목에 연결하여 **출시 차단 / 출시 전 간단 수정 / 출시 후 보류**로 분류해 달라.
66: - 미확정 운영값은 최소한의 소유자 결정 목록으로 묶어 달라. 새 제품 기능·DM/댓글/추천 피드·불필요한 구조 개편은 추가하지 말아 달라.
67: 
68: 원하는 결과: 핵심 판단, 근거가 있는 결함 목록, 이미 충분한 검증, 출시까지 남은 최소 순서, 소유자가 결정해야 하는 값. 실제 실행하지 않은 테스트는 소스 검토와 구분해 달라.
```

## E02 진행판 최신 상태/복원/OAuth 기록

`docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md:5–98`

```text
5: ## 현재 위치
6: 
7: | 항목 | 값 |
8: |---|---|
9: | 계획 | `MOEMOA_PUBLIC_LAUNCH_PLAN_V2_2026-09-22` |
10: | 출시 목표 | 개인 기록 + 계정 + 공개 보드 + 공개 미니홈 + 팔로우 + 최소 운영 |
11: | 제품 대상 | 기존 Web+Android 유지. 실제 첫 배포 채널/동시성은 D02에 기록 |
12: | 현재 milestone | **M5 로컬 후보 점검까지 실행 — M1~M5 외부 게이트 유지** |
13: | 현재 release 상태 | **BLOCKED_EXTERNAL — W16~W20 로컬 구현/검증/후보 점검 실행, 정식 출시 미완료** |
14: | 현재 본 작업 | 테스트 환경 준비·기본 격리·DB 복원 증거 확보. 다음은 W07~W15 공개 사용자 흐름의 실제 서버 통합 검증 |
15: | 다음 작업 | **격리 환경에서 게시→익명 열람→미니홈/팔로우→신고·차단→철회 흐름을 마감. 이미 통과한 DB 연결·기본 격리·복원은 변경/실패 근거 없이 반복하지 않음** |
16: | 작업 repository/branch | `Newrred/anime-collector` / `review/pro-interim-2026-09-25` (Pro 중간 검토용) |
17: | 작업 HEAD / dirty 상태 | 기준0330a54에서 누적 W09~W20 및 실제 환경 검증을 검토 브랜치 커밋으로 인계. 정확한 검토 SHA는 이 문서를 포함한 Git 커밋으로 식별 |
18: | 운영 SHA / 후보 SHA | 읽기 전용 재확인 `0330a54`, source=vercel-git, **workingTreeDirty=true 원인 미확인** / 새 후보 미커밋; HEAD를 변경 후보 버전으로 사용하지 않음 |
19: | 테스트 DB/Storage/계정 | `moemoa-test` (`nmgkhknponvzcwliajyk`) 준비됨. 실제 A/B 로그인·기록 왕복·직접 REST/비공개 Storage33 PASS, 서버 연결·Storage 사본·전체 dump/5schema72테이블 로컬 복원 PASS. 공개 사용자 흐름/API/CDN 통합 검증 잔여. 환경·키 미제공 차단은 해소; Android는 이번 실행 제외 |
20: | 완료 milestone | **1/6 — M0만** |
21: | 기본 작업 완료 | **4/20 — W01/W02/W04/W05** |
22: | 추가 필수 작업 | 0개 — 새 발견은 이 숫자로 별도 추적 |
23: | release blocker | W03 외부 검증, W06~W20 및 D01~D06 미해소 |
24: | 마지막 실제 작업 기록 | 2026-09-25 hosted DB 백업·격리 복원 / evidence/2026-09-25-hosted-db-recovery.json |
25: 
26: ## 고정 milestone 현황
27: 
28: ### 2026-09-25 Pro 중간 검토 Git 인계
29: 
30: - 사용자 요청: Git 최신화·링크·검토 문서 정리. 운영 자동 배포를 유발하는 master 대신 `review/pro-interim-2026-09-25` 브랜치를 만들었다. 새 계획을 만들지 않고 [검토 안내](../reports/2026-09-25-pro-interim-review.md)에 읽기 순서/소스 지도/검증 범위/출시 잔여/Pro 질문을 모았으며 시작 문서의 진입 링크를 갱신했다.
31: - 현재 소스 재검사: `npm run test:unit`320/320 PASS, `npm run build`18 pages/postbuild PASS. 전체 브라우저/SQL/원격 CI를 이번 인계에서 재실행했다고 하지 않는다. 과거 테스트는 해당 evidence의 당시 소스 범위로 구분했다.
32: - stage120개 파일에 대해 로컬 실제 server key/DB URL/password 일치, secret key/접속문자열/private key/non-anon JWT 패턴 검사 발견0. staged diff check PASS. env·DB dump·로그·개인 이미지 미포함. 기존 Android 관련 소스 변경은 누적 개발본 보존을 위해 포함하지만 Android 추가 구현/검증은 하지 않았다.
33: - 이번 변경은 검토용 commit/push만 허용하며 운영 DB/migration/Public/master merge/운영 배포는 수행하지 않는다. 브랜치 push 뒤 원격 SHA를 대조한다. 원격 Actions 실행은 별도 확인 없이는 PASS로 표시하지 않는다.
34: 
35: ### 2026-09-25 출시 잔여 범위 재정렬
36: 
37: - 사용자 질문에 따라 Pro V2 실행 패키지·문서 검증·W목록·최신 증거를 대조했다. 문서 구조/25개 기존 지적 매핑 완료와 기능의 출시 완료는 구분한다. 4/20은 엄격한 작업 종료 판정이며 구현20%라는 의미가 아니다. 과거 W행의 환경 없음/미검증 설명은 당시 이력이며 위 최신 상태와 후속 증거를 우선한다.
38: - 최근 작업이 테스트 인프라에 집중됐다. 이미 확보한 연결·A/B 기본 격리·백업 복원은 새 변경/실패가 없으면 반복하지 않는다. 테스트 DB 자체를 추가 개선하는 작업을 새 출시 선행조건으로 늘리지 않는다.
39: - 남은 순서: (1) 실제 공개 보드/이미지/미니홈/팔로우·신고/차단/철회 통합 검증 및 발견 결함 수정, (2) 기존 원장 D03~D05의 최소 운영값·담당/정책·보존/비용/경보와 자료 인계 확정, (3) 최신 후보 회귀·보안 검토·Git/CI·빌드 provenance 및 운영 migration/rollback 준비, (4) 정확한 후보 D06 승인 후 Git 연동 배포·운영 smoke. Android는 사용자 지시대로 이번 실행에서 제외하며 영구 platform 축소/자동 통과로 해석하지 않는다.
40: 
41: ### 2026-09-25 D05 hosted 테스트 DB 백업 → 격리 PostgreSQL17 복원
42: 
43: - 사용자 `ㄱㄱ`에 따라 기존 ExecPlan에 hosted 복원 범위를 먼저 추가했다. 기존 시작/확정 결정/QA/변경 통제/복구 인수인계와 local harness·restore script를 기준으로 진행했다. 공식 [PostgreSQL Ubuntu 도구](https://www.postgresql.org/download/linux/ubuntu/)와 [Supabase 백업·복원](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)을 확인했다.
44: - 공식 서명 apt 저장소에서 PostgreSQL17.11 server/client 및 libpq 패키지를 다운로드·추출해 WSL `/opt/moemoa-pg17`에 격리했다. 기존 PostgreSQL16/시스템 apt sources/앱 dependency/lockfile은 변경하지 않았다. 새 DB는 Unix socket 전용, TCP listener 없음, 완료 후 중지했다.
45: - 원격은 테스트 ref `nmgkhknponvzcwliajyk`/Session pooler5432 guard 및 `default_transaction_read_only=on`으로 고정했다. 전체 custom pg_dump PASS: **708,697bytes**, SHA256 `d6af268a6b839a2f9782c04cf7b7775921a7be35aad4c971e8e137f61f8507c5`, source17.6/tool17.11. 실제 dump는 WSL `/var/lib/postgresql/moemoa-hosted-recovery-20260925/hosted.dump`에 mode600, 상위 folder700으로 보관. 테스트 Auth 데이터가 포함되므로 Git/일반 로그에 복사하지 않는다.
46: - 격리 DB 복원 PASS: `public/private/auth/storage/supabase_migrations` **72개 테이블**의 건수·전체 행 digest가 원격과 일치. UTC 및 C 정렬을 고정하고 비교 전후 원격 데이터 불변 확인. 원문과 개별 digest는 출력하지 않았다. RLS enabled/forced, policy 정의, anon/authenticated/service_role 테이블 권한도 원본과 일치. 두 계정, COMPLETE_PRIVATE1/DELETED1, Storage metadata1 보존; 원격·복원본 Public flags 모두 closed.
47: - 첫 로컬 복원은 schema 필터가 CREATE SCHEMA 항목을 포함하지 않아 실패했다. local 스키마를 먼저 준비한 후 전체 선택 schema 복원은 exit0. 첫 행 비교는 UTC/JST 표현 차이로16테이블 불일치였으며 시간대/정렬을 정규화한 최종72개 비교는 모두 일치했다. 데이터 수정으로 결과를 맞추지 않았다.
48: - 한계: 전체 dump 확보와 **선택5schema 복원**을 구분한다. Supabase cron/vault/realtime 플랫폼 객체·Auth HTTP/Storage service·외부 OAuth 설정은 로컬에 재구성하지 않았다. 원래 DB owner는 local postgres로 매핑했다. Storage bytes는 앞선 별도60bytes 사본이며 DB dump에 포함된다고 하지 않는다. 운영 백업/PITR/보존·RPO/RTO·배포/CDN 검증은 여전히 남는다.
49: - 변경: ExecPlan/이 원장/[복구 결과 JSON](evidence/2026-09-25-hosted-db-recovery.json), ignored 진단 scripts 및 WSL 격리 도구/사본. 앱 코드·원격 데이터·schema migration·공개 활성화·Android·commit/push/deploy 변경 없음. rollback은 local DB 중지와 도구 사용 중단이며 원격 자료를 되돌릴 작업은 없다. D05 부분 증거 추가이며 모든 W 완료/출시 승인으로 승격하지 않는다.
50: 
51: ### 2026-09-25 서버 연결·Storage 사본 확인
52: 
53: - 사용자 입력 완료 후 `.env.moemoatest.server.local`의 값은 출력하지 않고 존재·대상 ref·포트·형식만 검사했다. `moemoa-test` ref 일치, Session pooler5432, secret key 형식 확인. env 및 `.cache` 사본은 gitignored다.
54: - 실제 psql 연결 PASS: TLS require, PostgreSQL17.6/postgres 응답. 첫 inline Python 호출은 WSL 실행 구성 문제로 결과가 없어 성공으로 세지 않았고, 파일 기반 probe로 실제 연결 성공을 확인했다. 비밀번호는 프로세스 인자나 일반 로그로 출력하지 않았다.
55: - 실제 서버 키로 private bucket의 기존 합성 `d01-probe.webp` 다운로드 PASS. 로컬 백업 사본60bytes와 재다운로드 SHA256이 기존 기준과 모두 일치하며 sharp 실제 decode16x16 PASS. Storage 복원/공개 이미지 전달/CDN 성공을 뜻하지 않는다.
56: - 읽은 기준: AGENTS/시작 문서/확정 결정/PLANS/QA/변경 통제/기존 ExecPlan·복구 인수인계 및 Supabase·verify-before-claiming skill. 변경은 ExecPlan/이 원장/[결과 JSON](evidence/2026-09-25-server-connection.json)과 ignored 진단 파일/합성 사본뿐이다. 제품 코드·DB migration·운영/Public/배포 변경 없음, rollback은 진단 실행 중단이다.
57: - 다음: hosted DB17에 맞는 dump 도구와 격리 복원 준비. 현 WSL에는 PostgreSQL16 도구만 있으므로 hosted 전체 dump/restore는 아직 실행하지 않았다. D01/D05 전체 완료 아님. Android 제외 유지. 키 재입력은 필요 없다.
58: 
59: ### 2026-09-25 D05 오래된 백업 복원 및 이미지 처리 로컬 재검증
60: 
61: - Android 제외 지시 유지. ExecPlan D01 후속을 먼저 추가하고 restore-roundtrip/resource-contract 및 이미지 handler/backend/검사를 읽었다. Supabase 공식 백업 문서에서 DB 백업에 Storage 파일 bytes가 포함되지 않는 점을 확인했다: https://supabase.com/docs/guides/platform/backups .
62: - 기존 최신 pg_dump→별도 DB pg_restore 검사에 오래된 백업 시나리오를 추가했다. 실제 로컬 PostgreSQL16에서 별도 recovery DB의 합성 게시물1개 노출 확인→dump→카드 retire→최신 fence CSV 추출→stale DB로 restore→삭제 전 노출이 재현되는 대조군 확인→공개 gate 닫기→최신 fence 중복2회 병합→reads만 열어도 카드0개→다시 닫기를 검증했다. hosted/운영 서버에는 적용하지 않았다.
63: - 발견/수정: resource-contract의 전날 fixture가 서버 timezone current_date-1을 사용해 JST 자정~UTC 자정 사이에 UTC 오늘로 남는 테스트 오류. 제품 budget은 UTC를 사용하므로 fixture도 `(now() at time zone 'UTC')::date-1`로 수정했다. 제품 quota 동작/schema는 바꾸지 않았다.
64: - 최종 전체 SQL harness PASS, 추가 stale 복원 검증 PASS. `.cache/d01-stale-restore.log`, WSL artifact `/tmp/moemoa-publication-test.LSOuuq`에 실제 dump/restore/journal 사본. 서버 격리는 Unix socket + listen_addresses=''이며 합성 데이터만 있다. `node --test tests/unit/publicImages.test.mjs` 14/14 PASS: 실제 sharp 바이트 변환/metadata 제거/실제 loopback HTTP, backend RPC/Storage는 모의이므로 hosted 이미지 처리 성공으로 세지 않는다.
65: - 변경 파일: restore-roundtrip.sh, resource-contract.sql, ExecPlan/진행판. rollback은 추가 리허설만 되돌리며 운영 원본/삭제 이력에 영향 없다. 테스트 DB schema/운영/Public/의존성/배포 변경 없음.
66: - 실제 hosted 전체 DB dump 및 서버 전용 이미지 backend 연결은 로컬 DB URL·service key가 없어 대기. 값은 읽거나 노출하지 않았고 존재하는 env의 해당 키 유무만 확인했다. 무시되는 `.env.moemoatest.server.local`에 빈 입력란을 준비했다. 필요한 값은 moemoa-test Session pooler DB URL과 서버 전용 service_role/secret key이며 운영 값 사용 금지. 아직 공개 이미지 활성화나 D05 완료 판정은 하지 않는다.
67: 
68: ### 2026-09-25 D01 실제 API·Storage 검사 — Android 제외
69: 
70: - 사용자 범위: 나머지 진행, Android 제외. 기존 ExecPlan D01에 실행 계획을 추가하고 Supabase/검증 skill과 실제 source/migration을 확인했다. 공식 changelog 및 Storage access-control 문서 확인. 대상 test ref 고정, 운영/정책/공개 권한 변경 없음.
71: - 방법: 무시되는 `.cache` loopback HTML/JS에서 기존 실제 Google A/B 세션으로 정상 Supabase client를 사용했다. 토큰은 메모리에서 API Authorization에만 사용하고 화면/로그/파일에 내보내지 않았다. 익명 검사는 publishable key만 사용했다. MCP SET ROLE 우회/권한 확대 없음.
72: - 실제 결과 **33/33 PASS**: A12/B12/anon9. 본인 카드 조회200, 상대 UUID 조회200/빈 배열, 무필터 조회도 본인1개만, 상대 직접 PATCH403·직접 INSERT403(anon401), 실제 private 스키마 접근406. 실제 JWT/HTTP 검증으로 이전 앱 UI 격리 근거를 보강한다. 모든 RPC 조합의 완전한 공격 감사는 아니다.
73: - Storage: 직접 생성한 단색16x16 WebP60 bytes를 관리자 대시보드로 test private bucket에 업로드하고 미리보기 색상 렌더를 확인했다. SQL로 파일 실존·크기·MIME 확인. A/B/anon 모두 목록빈배열·서명 URL 발급거부·public/authenticated 다운로드거부·업로드 및 덮어쓰기거부(HTTP400/body statusCode403). 누락 파일의404를 접근차단으로 잘못 판단하지 않도록 fixture 존재 확인 후 최종 재검사했다. 최초 schema 검사 이름 오류를 실제 private 스키마로 정정하고 최종33회 모두 재검사했다.
74: - 무결성: 실패한 쓰기 뒤 저장소 파일1개/60bytes, A카드DELETED/version4·B카드COMPLETE_PRIVATE/version2 유지. 개인 사용자 이미지/운영 데이터 사용 없음. 재검증용 합성 fixture는 비공개에 보존한다. source/결과/파일 해시는 [실제 HTTP 검증 증거](evidence/2026-09-25-hosted-api-storage.json)에 기록.
75: - Security Advisor ERROR0. INFO18(private RLS/no policies), WARN anon definer2/authenticated definer35 및 leaked-password protection1. 의도된 RPC 진입점 경고는 기존 설계와 연결되지만 전부 무해 판정하지 않는다. [RPC 경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [비밀번호 보호 설명](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Google 로그인 경로 검사와 이메일/비밀번호 보안 설정 검사는 별개다.
76: - reads/writes/images/minihomes=false, policy UNAPPROVED 재확인. 공개 이미지 변환·게시·철회 전달/CDN·실제 백업복구는 미검증으로 유지. Android는 이번 작업 대상 제외이지 출시 gate 자동 통과가 아니다.
77: - 변경: ExecPlan/진행판/증거 JSON, 임시 진단 도구만. 앱 제품 코드/DB schema/의존성/commit/push/deploy 없음. 진단 HTML은 완료 후 제거하고 탭을 닫는다. rollback은 테스트 실행 중단이며 운영 원본 변경 없음. D01 전체 완료/모든 W 완료로 승격하지 않는다.
78: 
79: ### 2026-09-24 D01 두 실제 Google 계정 격리 및 삭제 검증
80: 
81: - 사용자가 승인한 B Google 계정의 직접 인증 완료 후 앱에서 B 이메일 및 동기화 성공을 확인했다. hosted 집계는 auth.users=2, Google identities=2, user_devices=3. 비밀번호/토큰을 읽거나 저장하지 않았다.
82: - A 합성 카드 `4bbeab73-58ee-4458-b9d0-a1c0d7b06b34`는 B 로그인·동기화 후 보이지 않았고 직접 상세 URL도 Card not found. B에서 합성 SYSTEM_DESIGN 카드 `4b44bc17-e417-4ea8-96ba-588cd392e5c7`를 작성·동기화했다. DB에서 cards=2/distinct owners=2 확인. A로 동기화 후 B 상세 URL 역시 Card not found. 이는 실제 OAuth/앱 동기화/로컬 owner 경계 증거이며 공격자가 임의 REST 필터를 만드는 검사는 아니다.
83: - 추가 hosted 역할 검사 시 관리 MCP 연결이 SET ROLE authenticated를 거부했다. 권한을 확대하거나 우회하지 않았으며 해당 검사 PASS로 세지 않는다. 실제 사용자 JWT의 공격 REST/Storage 검증은 잔여다.
84: - A 합성 카드의 앱 삭제·동기화 성공: hosted status DELETED, tombstone=true, version4. B 카드는 COMPLETE_PRIVATE/tombstone=false/version2로 보존. 삭제한 데이터는 이번 테스트에서 생성한 합성 카드이며 실제 사용자 기록/이미지는 대상이 아니다.
85: - B→A 재로그인에서 계정 선택 화면과 정상 callback 복귀 확인. 복원 origin은 재로그인 직후 이미 Memory 0개여서, 뒤의 재동기화는 삭제 카드 비부활 검사로 한정한다(캐시된 카드 제거 전파 증거로 과장하지 않음).
86: - 재동기화 완료 후 실제 Archive의 No cards saved yet를 확인했다. A 삭제 카드가 복원되지 않았고 B 카드도 A 목록에 유입되지 않았다.
87: - 앱 코드 추가 수정/운영 migration/배포/Public 활성화 없음. D01은 부분 검증이며 실제 공격 REST·Storage/Android·기존 사본 삭제 전파 및 D02~D06은 남아 있다.
88: 
89: ### 2026-09-24 D01 실제 기록 복원 오류 수정 및 왕복 검증
90: 
91: - 기준: AGENTS/기존 시작·확정 결정·아키텍처·QA 문서 및 ExecPlan D01 상세. 실제 테스트만 승인된 범위이며 prod schema/배포/Public 변경 없음.
92: - 실제 흐름: 테스트 앱 127.0.0.1에서 합성 SYSTEM_DESIGN 카드 생성→Sync now→hosted memory_cards 1개 확인. 정확한 localhost callback을 추가하고 별도 origin의 빈 저장소(0개)에서 같은 Google 계정 로그인→동기화했다. 개인 사진/운영 자료는 사용하지 않았다.
93: - 발견: sync_changes가 PRIVATE_TITLE seq1, CARD seq2, VISUAL seq3, CARD seq4인 경우 pull의 최신 엔티티 압축으로 visual이 card보다 먼저 저장됐다. 카드의 visualAssetId가 null로 남아 Archive에서 IndexedDB DataError가 발생했다. 동기화 성공 문구만으로 복원 성공이라 판단하지 않았다.
94: - 수정: memorySyncStore가 카드 수신 시 기존 owner_state 인덱스의 같은 owner/current visual을 연결한다. IndexedDbMemoryRepository는 과거 누락 연결을 조회 transaction에서 복구해 읽기와 후속 수정 모두 가능하게 한다. owner 경계와 원본 bytes 유지, DB 버전/schema 변경 없음. 임시 진단 로그는 제거했다.
95: - 실제 검증: 복원 측 Archive 1개·동일 card UUID `4bbeab73-58ee-4458-b9d0-a1c0d7b06b34`·합성 제목/감상/시스템 디자인 확인. 복원 측 감상 수정→hosted version3/update_matches=true→원래 origin Sync now→변경 감상 표시까지 확인했다. 서로 다른 실제 기기가 아니라 같은 PC의 origin별 별도 저장소임을 구분한다.
96: - 자동 검증: IndexedDB Chromium 8/8(신규 순서 역전/과거 연결 복구/후속 수정), account/owner Chromium 9/9, 동기화 계약·엔진·runtime unit37/37 PASS. 최초 인덱스 선택 실수는 테스트 실패로 확인 후 기존 owner_state 사용으로 수정했다. 계정 합성 테스트를 hosted 모드에서 실행한 첫 시도는 fixture 실패(1 pass/1 fail); 합성 전용 별도 4322 서버에서 최종9 PASS. 운영 통과 근거로 사용하지 않는다.
97: - 웹 Google 로그인은 이전 계정 자동 선택을 피하도록 select_account prompt만 추가했다. 실제 Google 계정 선택 화면 확인. 사용자가 승인한 B 계정 로그인은 비밀번호 화면까지 준비했으며 직접 인증 대기. B/anon 실 JWT·REST 공격 검증 및 삭제 전파는 아직 완료 아님.
98: - 변경 파일: 위 adapter 2개, authRepo, memory-indexeddb.spec.ts, ExecPlan/진행판. rollback은 이 수정만 되돌리고 원본·서버 기록은 보존. 마이그레이션/의존성/commit/push 없음. 남은 D01 및 D02~D06 gate 유지.
```

## E03 기존 작업 상태

`docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md:130–174`

```text
130: | 단계 | 사용자에게 보이는 완료 결과 | 상태 | 남은 완료 조건 | 증거 |
131: |---|---|---|---|---|
132: | M0 | 현재 위치·범위·다음 작업이 명확함 | DONE | 없음; 미검증 항목은 담당 W로 연결 | 아래 기준점·25개 매핑·결정 로그 |
133: | M1 | 기록·계정·복원을 신뢰할 수 있음 | DOING | W03 원격 gate + W06 계정/복원 실검증 | W03 로컬 246 unit/253 catalog/15 E2E/build |
134: | M2 | 선택 보드를 타인이 보고 철회할 수 있음 | DOING | W07~W10 계약 | 없음 |
135: | M3 | 미니홈에서 소개하고 팔로우해 재방문함 | DOING | W11~W13 실제 환경/OAuth/기기 계약 | W11~W13 로컬 증거 |
136: | M4 | 운영자가 조치·제한·갱신·복구함 | DOING | W14~W15 실제 환경/정책 + W16~W17 계약 | W14~W15 로컬 증거 |
137: | M5 | 실제 역할·기기에서 검증한 후보가 출시됨 | DOING | W18~W20 실제 역할·기기·후보 CI/승인/운영 | 로컬 전체 검사·APK·후보 guard; RC_VERIFIED 아님 |
138: 
139: 한 M의 일부 W가 완료되어도 M전체를 DONE으로 바꾸지 않는다. 다음 단계의 독립 작업을 먼저 끝내도 현재 막힌 계약을 숨기지 않는다. M5는 `RC_VERIFIED → READY_FOR_DEPLOY → LIVE_VERIFIED`를 구분한다.
140: 
141: ## 평면 작업 목록 — 기본 20개
142: 
143: 상태: `TODO / READY / DOING / VERIFY / BLOCKED_EXTERNAL / BLOCKED_TECH / DONE / DEFERRED / SUPERSEDED`.
144: 
145: - 처음에는 W01만 선행 조건이 없다. 현행 저장소를 확인한 뒤 READY로 바꾼다.
146: - 이 표의 필수 작업을 임의로 DEFERRED로 보내지 않는다. 기존 구현이 검증되면 DONE, 같은 계약의 다른 작업에 흡수되면 SUPERSEDED+대체 ID를 기록한다.
147: - 새로 필요한 일은 W21부터 **같은 표의 형제 행**으로 추가한다. 부모 단계/하위 계획을 새로 만들지 않는다.
148: - 여기의 의존성은 시작 기본안이다. 실제 구현 재사용/차단에 따라 DAG를 유지하며 조정할 수 있다. 관련 없는 작업을 '단계가 다르다'는 이유만으로 불필요하게 대기시키지 않는다.
149: - 상태와 증거는 이 표/아래 기록에서만 갱신한다. 별도 상태 문서에 이중 기록하지 않는다.
150: 
151: | ID | M | 한 개의 완료 결과 | 계약 | 최소 선행 W | 상태 | 실제 증거/차단 |
152: |---|---|---|---|---|---|---|
153: | W01 | M0 | 현재 소스·환경·노출 기능 기준점 | C01,C11 | 없음 | DONE | M0 완료 로그·기준점 참조 |
154: | W02 | M0 | 출시 결정 반영·이전 지적 정리 | C01–C12 | W01 | DONE | M0 완료 로그·기준점 참조 |
155: | W03 | M1 | CI·health·빌드/SW 검증 기반 | C10 | W02 | BLOCKED_EXTERNAL | 기존0330a54 Actions quality/최근 health·freshness 성공 확인. 새 후보 checks/보호 규칙·경보 수신 및 운영 dirty 표시 원인 D03/D06 대기 |
156: | W04 | M1 | 기존 기록의 취소·저장·복귀 마감 | C01,C11 | W02 | DONE | 제목/보드 dirty·QuickLog 닫기·저장 실패/경합·출발점/필터/스크롤 복귀 검증; 종료 기록 참조 |
157: | W05 | M1 | 계정 동기화 완료·재개 계약 | C02 | W03 로컬 검증 | DONE | 로컬 sync 계약 구현·unit269/browser26/build PASS; 실제 A/B·기기 및 서버 한도는 W06/W15/W19 |
158: | W06 | M1 | 계정 격리·승격·지원 백업 실검증 | C01,C02,C10 | W04, W05 | BLOCKED_EXTERNAL | 로컬 unit278/browser36/build PASS; 사용자 확인: 격리 Supabase/A·B 계정 없음. 실제 REST/RPC/Storage 격리 미검증 |
159: | W07 | M2 | 공개 표현·권한·철회 경계 | C03–C05 | W06 로컬 검증 | BLOCKED_EXTERNAL | 공개 서버 기반 로컬 PostgreSQL 계약45+동시성1 PASS; 실제 Supabase/PostgREST/Storage는 D01 미준비 |
160: | W08 | M2 | 선택한 이미지의 공개 준비·전달 | C04 | W07 로컬 검증 | BLOCKED_EXTERNAL | 이미지 준비·전달 로컬 SQL31/HTTP·변환13 PASS. 실제 Storage/Vercel/Android는 미검증 |
161: | W09 | M2 | 보드 미리보기·게시·방문자 읽기 | C03,C04 | W08 로컬 검증 | BLOCKED_EXTERNAL | 선택→서버 DTO→게시→익명 방문→보드 철회 UI, unit306/Chromium11/build16 PASS; 실제 Auth/Storage/Vercel/Android는 D01 등 유지 |
162: | W10 | M2 | 공개 갱신·철회·삭제·동시성 | C05 | W09 로컬 검증 | BLOCKED_EXTERNAL | unit310/Chromium25/build16/SQL88+동시성6 PASS; D01/D05 실제 전달·복원 검증 대기 |
163: | W11 | M3 | 공개 미니홈의 선택 전시 | C06 | W10 로컬 검증 | BLOCKED_EXTERNAL | unit315/Chromium18/build18/SQL 미니홈27 PASS; D01 실제 Auth/Storage/Android 게이트 유지 |
164: | W12 | M3 | 팔로우·해제·내 목록 | C07 | W07/W11 로컬 검증 | BLOCKED_EXTERNAL | unit315/Chromium20/build18/SQL 관계22+동시성1 PASS. 실제 Supabase/OAuth/Android는 D01/W19 |
165: | W13 | M3 | 공유 링크·로그인 복귀·재방문 | C06,C07,C11 | W11, W12 로컬 검증 | BLOCKED_EXTERNAL | unit317/Chromium29/build18/Android dist routes18 PASS, 실제 OAuth/Android D01/W19 대기; 아래 결과 참조 |
166: | W14 | M4 | 신고·차단·관리자 조치 | C05,C07,C08 | W10, W11, W12 로컬 검증 | BLOCKED_EXTERNAL | unit317/Chromium24/build18/SQL 신고·조치34+동시성2 PASS. 실제 담당자/통지/보존/Storage D01/D04/D05 대기 |
167: | W15 | M4 | 서버 한도·비용·중단 통제 | C09 | W05, W08, W12, W14 로컬 검증 | BLOCKED_EXTERNAL | unit318/SQL218(새35+경합3) PASS; 실제 예산·ingress/WAF/경보 D03, 삭제 fence/ledger 보존 D05, hosted 역할 D01 대기 |
168: | W16 | M4 | 카탈로그 후보 게시·복구 루프 | C10 | W03 로컬 검증 | BLOCKED_EXTERNAL | catalog256 PASS/Windows skip2; SQL 전환14+경합1. 실제 canonical/Storage 후보·게시/복구 D01/D05/D06 대기 |
169: | W17 | M4 | 복구·정책·연락처·운영 인수인계 | C08–C10 | W06, W14, W15, W16 로컬 검증 | BLOCKED_EXTERNAL | 현재 합성 DB dump/restore·안전 이력 대조/닫힌 복구2 PASS; 실제 파일 사본·최신 철회 journal·담당자/정책 D04/D05 대기 |
170: | W18 | M5 | 전체 노출 화면·행동 계약 검증 | C11 | W04, W10, W13, W14, W15 로컬 검증 | BLOCKED_EXTERNAL | 18 route/action 지도, unit320/Chromium174 PASS·3 명시 skip. 실제 기기/사람 검증 및 출시 gate 유지 |
171: | W19 | M5 | 실제 역할·기기 end-to-end 검증 | C12 | W17, W18 로컬 검증 | BLOCKED_EXTERNAL | SDK36 준비·native31 PASS·최신 debug APK/packaged18경로 PASS. 실제 연결 기기0·Google/hosted A/B 없음 |
172: | W20 | M5 | 후보 고정·승인 배포·운영 확인 | C10,C12 | W19 | BLOCKED_EXTERNAL | build18·증거 hash/설정/rollback 인계, candidate guard의 거부 확인. 새 후보 commit/CI·D01~D06·운영 dirty 표시 원인 미해소 |
173: 
174: ### 작업 수의 변화와 진행률
```

## E04 공개 이미지 업로드 operation 관리

`src/features/memory/application/createPublicationController.js:136–159`

```text
136:     upload: ({ cardId, file, consented }) => run("uploading", async ({ signal, check }) => {
137:       if (!consented || !policyRevision || policyRevision === "UNAPPROVED") fail("IMAGE_CONSENT_REQUIRED");
138:       const detail = await getBoard(boardId);
139:       const item = detail?.items.find((entry) => entry.bundle.card.id === cardId);
140:       if (detail?.board.ownerId !== ownerId || !item || !synced(item.bundle.asset)) fail("SYNC_REQUIRED");
141:       const asset = item.bundle.asset;
142:       const session = await auth();
143:       await check();
144:       const key = `${asset.id}:${asset.sync.remoteVersion}`;
145:       if (!imageOperations.has(key)) imageOperations.set(key, uuid());
146:       await prepareImage({ sourceAssetId: asset.id, sourceVersion: asset.sync.remoteVersion, operationId: imageOperations.get(key),
147:         accessToken: session.access_token, policyRevision, consented, readOriginal: () => file, signal });
148:       await check();
149:       emit({ review: null, phase: "imageReady" });
150:     }),
151:     cancel() {
152:       // Once sent, a publish/revoke cannot be described as cancelled; reload recovers server state.
153:       if (["publishing", "revoking"].includes(state.phase) && state.busy) return;
154:       generation++; currentRequest?.abort(); currentRequest = null;
155:       operationId = null; reviewedSelection = null; sourceStamp = null;
156:       emit({ busy: false, review: null, error: null, phase: "selecting" });
157:     },
158:     dispose() { disposed = true; generation++; currentRequest?.abort(); listeners.clear(); },
159:   };
```

## E05 예약/실패/권리 승인

`supabase/migrations/20260923093000_memory_public_images.sql:11–78`

```text
11: -- Trusted moderation approval, never populated from client metadata or rights self-assertion.
12: create table private.memory_public_image_rights(
13:   asset_id uuid not null,
14:   user_id uuid not null references auth.users(id) on delete cascade,
15:   source_version bigint not null,
16:   image_type text not null check(image_type in ('USER_ORIGINAL','LICENSED_IMAGE')),
17:   evidence_ref text not null check(length(evidence_ref) between 1 and 240),
18:   approved_at timestamptz not null default now(),
19:   revoked_at timestamptz,
20:   primary key(user_id,asset_id,source_version)
21: );
22: create table private.memory_public_assets(
23:   id uuid primary key default gen_random_uuid(),
24:   user_id uuid not null,
25:   card_id uuid not null,
26:   source_asset_id uuid not null,
27:   source_version bigint not null,
28:   source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
29:   operation_id uuid not null,
30:   policy_revision text not null,
31:   state text not null default 'PREPARING' check(state in ('PREPARING','READY','FAILED','CANCELLED','DELETING','DELETED')),
32:   object_prefix uuid not null default gen_random_uuid(),
33:   reserved_bytes bigint not null default 4194304,
34:   full_hash text, thumb_hash text,
35:   full_bytes integer, thumb_bytes integer,
36:   width integer,height integer,
37:   created_at timestamptz not null default now(),
38:   expires_at timestamptz not null default (now()+interval '24 hours'),
39:   unique(user_id,operation_id),
40:   check(state<>'READY' or (full_hash ~ '^[a-f0-9]{64}$' and thumb_hash ~ '^[a-f0-9]{64}$'
41:     and full_bytes between 1 and 2097152 and thumb_bytes between 1 and 2097152
42:     and width between 1 and 1600 and height between 1 and 1600))
43: );
44: -- No FK to mutable source asset/card: retain keys for cleanup even after source purging.
45: create index memory_public_assets_source on private.memory_public_assets(user_id,source_asset_id,source_version,state);
46: alter table private.memory_public_image_rights enable row level security;
47: alter table private.memory_public_assets enable row level security;
48: revoke all on private.memory_public_image_rights,private.memory_public_assets from public,anon,authenticated;
49: 
50: create function public.reserve_memory_public_asset(p_asset_id uuid,p_source_version bigint,p_operation_id uuid,p_policy_revision text)
51: returns jsonb language plpgsql security definer set search_path='' as $$
52: declare u uuid := private.require_publication_writer(); a public.memory_visual_assets%rowtype;
53:   r private.memory_public_assets%rowtype; settings private.memory_publication_settings%rowtype; n bigint; bytes bigint;
54: begin
55:   select * into settings from private.memory_publication_settings where singleton for share;
56:   if not settings.images_enabled then raise exception 'PUBLIC_IMAGE_DISABLED'; end if;
57:   if p_policy_revision is distinct from settings.policy_revision or p_operation_id is null then raise exception 'CONSENT_MISMATCH'; end if;
58:   -- Serialize reservations per account; pending reservations consume the same budget as ready objects.
59:   perform 1 from public.user_profiles where user_id=u for update;
60:   if not found then raise exception 'AUTH_REQUIRED'; end if;
61:   select * into a from public.memory_visual_assets where id=p_asset_id and user_id=u and version=p_source_version
62:     and asset_type='USER_IMAGE' and state='READY' and is_current and deleted_at is null for share;
63:   if not found or a.checksum_sha256 is null then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
64:   if not exists(select 1 from public.memory_cards where user_id=u and id=a.card_id and status='COMPLETE_PRIVATE' and deleted_at is null)
65:     or exists(select 1 from private.memory_public_cards where user_id=u and card_id=a.card_id and (revoked or hidden)) then raise exception 'PUBLICATION_RESTRICTED'; end if;
66:   if not exists(select 1 from private.memory_public_image_rights where user_id=u and asset_id=a.id and source_version=a.version and revoked_at is null) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
67:   select * into r from private.memory_public_assets where user_id=u and operation_id=p_operation_id;
68:   if found then
69:     if r.source_asset_id<>a.id or r.source_version<>a.version or r.policy_revision<>p_policy_revision then raise exception 'OPERATION_MISMATCH'; end if;
70:     if r.state='READY' then return jsonb_build_object('id',r.id,'state','READY'); end if;
71:     raise exception 'ASSET_OPERATION_UNAVAILABLE';
72:   end if;
73:   select count(*),coalesce(sum(reserved_bytes),0) into n,bytes from private.memory_public_assets where user_id=u and state<>'DELETED';
74:   if n>=settings.asset_limit or bytes+4194304>settings.asset_bytes_limit then raise exception 'IMAGE_QUOTA_EXCEEDED'; end if;
75:   insert into private.memory_public_assets(user_id,card_id,source_asset_id,source_version,source_hash,operation_id,policy_revision)
76:     values(u,a.card_id,a.id,a.version,a.checksum_sha256,p_operation_id,p_policy_revision) returning * into r;
77:   return jsonb_build_object('id',r.id,'state',r.state,'sourceHash',r.source_hash,'prefix',r.object_prefix);
78: end $$;
```

## E06 실제 이미지 처리 실패 경로

`src/server/publicImages/handler.js:34–60`

```text
34:       if(!["GET","POST"].includes(req.method)) throw new PublicImageError("METHOD_NOT_ALLOWED",405);
35:       const backend=createBackend();
36:       if(req.method === "POST") {
37:         if(req.headers["content-type"]?.split(";")[0] !== "application/octet-stream") throw new PublicImageError("INVALID_BINARY_BODY");
38:         const user=await backend.user(tokenOf(req));
39:         const asset=requiredId(req.headers["x-moemoa-asset"]), operation=requiredId(req.headers["x-moemoa-operation"]);
40:         const version=Number(req.headers["x-moemoa-version"]), consent=req.headers["x-moemoa-consent"];
41:         if(!Number.isSafeInteger(version) || version<1 || typeof consent!=="string" || consent.length<1 || consent.length>120) throw new PublicImageError("INVALID_REQUEST");
42:         const reservation=await user.rpc("reserve_memory_public_asset",{p_asset_id:asset,p_source_version:version,p_operation_id:operation,p_policy_revision:consent});
43:         if(reservation.state === "READY") { res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({id:reservation.id,state:"READY"})); return; }
44:         const paths=pathsFor(reservation.prefix);
45:         try {
46:           await user.rpc("authorize_memory_image_attempt",{});
47:           const bytes=await inputBytes(req);
48:           if(imageHash(bytes)!==reservation.sourceHash) throw new PublicImageError("SOURCE_IMAGE_MISMATCH");
49:           const output=await transform(bytes);
50:           await backend.put(paths[0],output.full);
51:           await backend.put(paths[1],output.thumb);
52:           await backend.rpc("complete_memory_public_asset",{p_id:reservation.id,p_full_hash:output.fullHash,p_thumb_hash:output.thumbHash,
53:             p_full_bytes:output.full.length,p_thumb_bytes:output.thumb.length,p_width:output.width,p_height:output.height});
54:         } catch(error) {
55:           // READY can be committed even when the final HTTP response is lost. Never delete on an ambiguous commit.
56:           await backend.rpc("fail_memory_public_asset",{p_id:reservation.id}).catch(()=>{});
57:           // Cleanup worker rechecks state/references before removing private objects.
58:           throw error;
59:         }
60:         res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({id:reservation.id,state:"READY"})); return;
```

## E07 공개 보드 방문자 연결

`src/features/memory/components/PublicMemoryBoard.jsx:1–50`

```text
1: import { useEffect, useState } from "react";
2: import PublicLinkCopy from "./PublicLinkCopy.jsx";
3: import MemorySafety from "./MemorySafety.jsx";
4: import { useUiPreferences } from "../../../hooks/useUiPreferences.js";
5: import { getPublicationServices } from "../runtime/platformPublication.js";
6: import { isPublicationId, publicationSnapshot } from "../domain/publicationView.js";
7: import PublicBoardSnapshot from "./PublicBoardSnapshot.jsx";
8: import { publicationCopy } from "./publicationCopy.js";
9: 
10: export default function PublicMemoryBoard({ base = "/" }) {
11:   const { locale } = useUiPreferences(), copy = publicationCopy(locale);
12:   const [state, setState] = useState({ status: "loading", snapshot: null });
13:   const [retry, setRetry] = useState(0);
14:   const services = getPublicationServices();
15:   const id = new URLSearchParams(globalThis.location?.search || "").get("id");
16:   useEffect(() => {
17:     const request = new AbortController();
18:     const timeout = setTimeout(() => {
19:       request.abort(); setState({ status: "error", snapshot: null });
20:     }, 20000);
21:     const read = async () => {
22:       setState({ status: "loading", snapshot: null });
23:       if (!services.enabled) { setState({ status: "disabled", snapshot: null }); return; }
24:       if (!isPublicationId(id)) { setState({ status: "unavailable", snapshot: null }); return; }
25:       try {
26:         const result = await services.reader.read(id, { signal: request.signal });
27:         if (request.signal.aborted) return;
28:         if (result && result.id !== id) throw new Error("PUBLICATION_RESPONSE_INVALID");
29:         setState(result ? { status: "ready", snapshot: publicationSnapshot(result) } : { status: "unavailable", snapshot: null });
30:       } catch {
31:         if (!request.signal.aborted) setState({ status: "error", snapshot: null });
32:       }
33:     };
34:     read().finally(() => clearTimeout(timeout));
35:     const recheck = () => { if (document.visibilityState === "visible") setRetry((value) => value + 1); };
36:     window.addEventListener("pageshow", recheck);
37:     document.addEventListener("visibilitychange", recheck);
38:     return () => { clearTimeout(timeout); request.abort(); window.removeEventListener("pageshow", recheck); document.removeEventListener("visibilitychange", recheck); };
39:   }, [id, retry, services]);
40:   return <main className="public-memory-board page-shell page-shell--wide">
41:     <header><a href={base}>MOEMOA</a><h1>{copy.title}</h1></header>
42:     {state.status === "ready" ? <PublicBoardSnapshot snapshot={state.snapshot} publicationId={id} services={services} locale={locale} />
43:       : <p role={state.status === "error" ? "alert" : "status"}>{state.status === "loading" ? copy.loading
44:         : state.status === "disabled" ? copy.disabled : state.status === "error" ? copy.failed : copy.unavailable}</p>}
45:     {state.status === "ready" && <PublicLinkCopy key={id} kind="board" id={id} locale={locale} base={base} />}
46:     {state.status !== "loading" && state.status !== "disabled" && <button type="button" className="btn btn--subtle"
47:       onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button>}
48:     {isPublicationId(id) && <MemorySafety kind="board" target={id} locale={locale} base={base} />}
49:   </main>;
50: }
```

## E08 공개 DTO의 필드

`src/features/memory/domain/publicationView.js:8–40`

```text
8: // Only the public DTO is admitted. Never merge private bundles into this view model.
9: export function publicationSnapshot(input) {
10:   if (input?.schemaVersion !== 1 || !Array.isArray(input.cards) || input.cards.length > 100) fail();
11:   const seen = new Set();
12:   return {
13:     schemaVersion: 1, title: text(input.title, 80), description: text(input.description, 500),
14:     cards: input.cards.map((card) => {
15:       if (!isPublicationId(card?.id) || seen.has(card.id)) fail();
16:       seen.add(card.id);
17:       const result = { id: card.id, title: text(card.title, 500) };
18:       const visual = card.visual;
19:       if (visual?.type === "SYSTEM_DESIGN") {
20:         try { publicDesignStyle(visual); } catch { fail(); }
21:         result.visual = { type: visual.type, rendererVersion: 1, patternToken: visual.patternToken };
22:       } else if (visual?.type === "CATALOG_COVER" && /^asset:[a-f0-9]{40}$/i.test(visual.revisionId || "")
23:         && /^anime:[a-f0-9-]{36}$/i.test(card.animeId || "")) {
24:         result.animeId = card.animeId;
25:         result.visual = { type: visual.type, revisionId: visual.revisionId };
26:       } else if (visual?.type === "USER_IMAGE" && isPublicationId(visual.assetId)) {
27:         result.visual = { type: visual.type, assetId: visual.assetId };
28:       } else fail();
29:       for (const field of PUBLIC_FIELDS) {
30:         if (!(field in card)) continue;
31:         if (field === "emotionTags") {
32:           if (!Array.isArray(card[field]) || card[field].length > 32) fail();
33:           result[field] = card[field].map((value) => text(value, 100));
34:         } else result[field] = card[field] == null ? null : text(card[field], 10000);
35:       }
36:       if ("watchedAt" in card) result.watchedAtPrecision = text(card.watchedAtPrecision, 16);
37:       return result;
38:     }),
39:   };
40: }
```

## E09 후보의 플랫폼 검사

`scripts/check-release-candidate.mjs:6–27`

```text
6: 
7: const CHECKS = ['unit', 'catalog', 'browser', 'sql', 'build', 'android'];
8: const GATES = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'];
9: // Local evidence integrity check only; it does not configure branch protection or deploy.
10: export async function checkReleaseCandidate(candidate, { head, dirty, verifyEvidence }) {
11:   const blockers = [];
12:   if (!/^[a-f0-9]{40}$/.test(candidate?.sourceCommit ?? '') || candidate.sourceCommit !== head) blockers.push('SOURCE_COMMIT_MISMATCH');
13:   if (dirty) blockers.push('SOURCE_NOT_CLEAN');
14:   for (const id of CHECKS) {
15:     const check = candidate?.checks?.[id];
16:     if (check?.status !== 'PASS' || check.sourceCommit !== head || check.failed !== 0 || !(check.passed > 0)
17:       || !Number.isSafeInteger(check.passed) || !Number.isSafeInteger(check.skipped) || check.skipped < 0
18:       || (check.skipped > 0 && !check.skipReason?.trim())) blockers.push(`CHECK_${id}_INCOMPLETE`);
19:     else if (!await verifyEvidence(check.evidence)) blockers.push(`CHECK_${id}_EVIDENCE_INVALID`);
20:   }
21:   for (const id of GATES) {
22:     const gate = candidate?.gates?.[id];
23:     if (gate?.status !== 'VERIFIED' || !gate.verifiedBy?.trim()) blockers.push(`GATE_${id}_PENDING`);
24:     else if (!await verifyEvidence(gate.evidence)) blockers.push(`GATE_${id}_EVIDENCE_INVALID`);
25:   }
26:   if (!candidate?.catalogRelease?.id || !/^[a-f0-9]{64}$/.test(candidate.catalogRelease.hash ?? '')) blockers.push('CATALOG_VERSION_MISSING');
27:   if (!await verifyEvidence(candidate?.configurationEvidence)) blockers.push('CONFIGURATION_EVIDENCE_MISSING');
```

## E10 실제 Git 품질 workflow 트리거

`.github/workflows/quality.yml:1–12`

```text
1: name: Service quality
2: on:
3:   push:
4:     branches: [master]
5:   pull_request:
6:   workflow_dispatch:
7: permissions:
8:   contents: read
9: concurrency:
10:   group: quality-${{ github.ref }}
11:   cancel-in-progress: true
12: jobs:
```

## 원본 증거 `2026-09-25-hosted-db-recovery.json`

```json
{
  "project": "nmgkhknponvzcwliajyk",
  "date": "2026-09-25",
  "backup": {
    "format": "pg_dump custom full database",
    "bytes": 708697,
    "sha256": "d6af268a6b839a2f9782c04cf7b7775921a7be35aad4c971e8e137f61f8507c5",
    "toolVersion": "17.11",
    "sourceVersion": "17.6"
  },
  "restore": {
    "target": "isolated local PostgreSQL17.11 Unix socket only",
    "schemas": [
      "public",
      "private",
      "auth",
      "storage",
      "supabase_migrations"
    ],
    "tableCount": 72,
    "rowCountsAndDigestsMatched": true,
    "mismatchTables": [],
    "sourceStableDuringComparison": true,
    "unstableTables": [],
    "rlsFlagsMatched": true,
    "policiesMatched": true,
    "clientTableGrantsMatched": true,
    "remotePublicClosed": true,
    "restoredPublicClosed": true,
    "cardStatusCounts": "COMPLETE_PRIVATE|1\nDELETED|1",
    "authUserCount": 2,
    "storageObjectCount": 1
  },
  "limitations": [
    "Not a Supabase Auth/Storage/Realtime service restore",
    "Platform cron/vault/realtime schemas not restored locally",
    "Original ownership mapped to local postgres; client table ACL and RLS compared",
    "Storage bytes separately backed up, not contained in pg_dump",
    "Not a production backup, PITR, RPO or RTO certification",
    "Android excluded"
  ],
  "remoteWrites": false,
  "localServerStopped": true,
  "artifacts": "/var/lib/postgresql/moemoa-hosted-recovery-20260925"
}

```

## 원본 증거 `2026-09-25-local-stale-recovery.json`

```json
{
  "date": "2026-09-25",
  "environment": "WSL PostgreSQL 16, isolated Unix socket, synthetic auth/storage",
  "sqlPassNotices": 236,
  "imageUnitTestsPassed": 14,
  "staleRecovery": "Old dump exposes the synthetic card as negative control; closed flags suppress it; two latest-fence journal replays keep it hidden even when local reads are enabled; flags closed afterwards.",
  "sourceFiles": {
    "tools/publication-boundary/restore-roundtrip.sh": "AFF7EF6100597377ABE754BE6C9729BAD0D87921162E317786FA5A8861BBB39B",
    "tools/publication-boundary/resource-contract.sql": "76932A69C23D96B001475685486CB7F53C0E3F282A2F05CDFC15DDFC19E5031A"
  },
  "logs": {
    ".cache/d01-stale-restore.log": "97254B941AAEED108584BE31C8E177CB64FD721D4365CB9862D5C2084B79B397",
    ".cache/d01-images.log": "9BAA1083858548DFEA9B23A3D483A481956114BDE13F3436035B2B25A462DA25"
  },
  "artifacts": "/tmp/moemoa-publication-test.LSOuuq",
  "limitations": ["No hosted dump/restore", "Image RPC and Storage backend mocked", "No CDN/deployment verification", "Android excluded"],
  "productionChanges": false
}

```

## 이번 독립 검사 `unit-summary.json`

```json
{
  "source": "MOEMOA-Pro-Review-bbff3d4.zip",
  "scope": "independent current-response Node unit tests; not hosted/browser/build",
  "command": "node --test --test-concurrency=2 tests/unit/*.test.mjs",
  "node": "22.16.0",
  "passed": 276,
  "filesFailedBeforeTests": [
    "tests/unit/catalogConsumer.test.mjs",
    "tests/unit/catalogRepository.test.mjs",
    "tests/unit/nativeAppNavigation.test.mjs",
    "tests/unit/publicImages.test.mjs",
    "tests/unit/quickActionActions.test.mjs",
    "tests/unit/sourceIndependentCatalog.test.mjs",
    "tests/unit/syncAccountMeta.test.mjs",
    "tests/unit/syncMutationSafety.test.mjs",
    "tests/unit/watchLogSource.test.mjs"
  ],
  "failureClass": "ERR_MODULE_NOT_FOUND: @supabase/supabase-js or sharp unavailable in this runtime",
  "executedAssertionFailures": 0,
  "reportedExitCode": 1,
  "fullSuitePassed": false,
  "rawLogSha256": "91c3239a36f76ffe7ad50e8f285d8e653af054f4f82876a0a6dceae37d37802c"
}
```

## 이번 독립 검사 `upload-retry-result.json`

```json
{
  "evidenceLevel": "ORIGINAL_CONTROLLER_WITH_MODELED_RESERVATION_AND_UPLOAD_FAILURE",
  "networkRequests": 0,
  "productionChanges": 0,
  "scenarios": [
    {
      "attempt": 1,
      "phase": "error",
      "error": "SOURCE_IMAGE_MISMATCH"
    },
    {
      "attempt": 2,
      "phase": "error",
      "error": "ASSET_OPERATION_UNAVAILABLE"
    },
    {
      "attempt": 3,
      "phase": "error",
      "error": "ASSET_OPERATION_UNAVAILABLE"
    }
  ],
  "sameOperationOnAllAttempts": true,
  "interpretation": "A known failed image preparation cannot be retried in this controller, even after cancel and choosing the correct original. Reopening the editor creates a new controller and can allocate another ID; it is not a permanent account failure."
}

```
