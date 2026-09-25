# MOEMOA · 단일 출시 작업판

문서 역할: **진행 상태의 유일한 원장**. 2026-09-23 M0 기준점 확인 완료. 앱 기능 구현 완료와 문서 이관을 구분한다.

## 현재 위치

| 항목 | 값 |
|---|---|
| 계획 | `MOEMOA_PUBLIC_LAUNCH_PLAN_V2_2026-09-22` |
| 출시 목표 | 개인 기록 + 계정 + 무료 비공개 최적화 이미지 연동 + 공개 보드 + 공개 미니홈 + 팔로우 + 최소 운영 |
| 제품 대상 | 제품 Web+Android 유지. 첫 출시 후보 WEB_ONLY 확정, Android는 Web 개선 후 후속 출시(D02) |
| 현재 milestone | **M1/W06·M2/W08 private 최적화 연동 구현 — 기존 M5/W19 공개 근거 보존, M1~M5 전체 종료·승인 미완료** |
| 현재 release 상태 | **NOT_RELEASE_READY — 새 private 이미지 연동 구현·실기기 검증, 후보 환경 및 운영/후보 승인 잔여** |
| 현재 본 작업 | **W20 간이 테스트용 Web Git 배포 진행(사용자 승인). W06/W08 private·public 서버 검증은 미완료로 유지** |
| 다음 작업 | **W06/W08/D01: private→public 실제 테스트에 적용할 migration·한도·합성 사본 권리·원복 범위를 확정하고 hosted 검증 준비** |
| 작업 repository/branch | `Newrred/anime-collector` / `review/pro-interim-2026-09-25` (Pro 중간 검토용) |
| 작업 HEAD / dirty 상태 | **bbff3d4 이후 구현을 간이 테스트 배포 후보로 선별 커밋 중. 정확한 배포 SHA/검증은 아래 새 기록 및 evidence/2026-09-26-web-smoke-deployment.json 참조** |
| 운영 SHA / 후보 SHA | **이번 작업 시작 시 GitHub master와 Vercel 운영 모두0330a54 재확인. 간이 테스트 배포를 진행하며 정식 Public RC 승인과 구분** |
| 테스트 DB/Storage/계정 | `moemoa-test` (`nmgkhknponvzcwliajyk`). 과거 A/B·REST/Storage33·5schema72table 복원 유지. 이번 실제 공개 retry/게시·익명 bytes·home/follow/report/block·moderator/owner RPC 철회 PASS; 제품 UI 취소/철회 및 익명·home·이미지 차단 PASS. 후보CDN 등 잔여. test flags/역할 원복 완료. Android 이번 실행 제외 |
| 완료 milestone | **1/6 — M0만** |
| 기본 작업 완료 | **4/20 — W01/W02/W04/W05** |
| 추가 필수 작업 | **0개 유지 — R0925-B01/U01/O01은 기존 W08/W13/W14에 흡수; 새 W 또는 하위 계획을 생성한 것이 아님** |
| release blocker | W06/W08 private 이미지 연동·W15 서버 정책/비용, W19 실기기/후보 전달 환경, W03/RC 검증, D03~D06. D02 Web-only 승인. D01 과거 test 공개 승인은 확보·원복했으며 새로운 원격 변경은 정확한 범위로 구분 |
| 마지막 실제 작업 기록 | 2026-09-26 private→public: unit353·공개Chromium23(문구 최종2 재검사)·public PG267·private PG47+병렬2·build18 PASS / evidence/2026-09-26-private-public-representation.json |

현재 표는 9/25 검토 적용 후 실제 실행·원복 결과까지 반영했다. 아래 날짜별 실행 로그는 당시 사실로 보존한다. 과거의 “없음/미제공/미커밋” 문구를 현재 지시로 다시 실행하지 않는다. 최종 DONE 수는 새 실제 증거 없이 올리지 않는다.

## 고정 milestone 현황
### 2026-09-26 W20 간이 테스트용 배포 승인
- 사용자 요청으로 현재 Web 코드를 Git master에 배포해 폰·지인에게 링크로 테스트한다. `WEB-SMOKE-DEPLOY-01`, 기존 ExecPlan에 범위 반영. 정식 release 상태/미완료 W를 PASS로 바꾸지 않는다.
- `.env.production`: Web 로컬 이미지 입력1; private image sync/public publication·minihome·follow·moderation UI 및 private→public source0. 서버 API는 기존 default-off 유지, 운영 DB migration0. 새 private/source-rights migration은 소스에만 포함.
- 이번 재실행: unit353, catalog256/skip2(Windows symlink), 핵심 Chromium+mobile78/skip1(private source flagoff), public PostgreSQL267, build18 PASS. flag-on intake+mobile은 별도 검사. 기존 모바일 테스트의 첫 action 가정을 local-image flag에 맞춰 검사하며 화면 크기/좌표 assertion을 완화하지 않는다.
- 로컬 handoff ZIP/deliverables는 보존하되 Git에서 제외. 캐시·자격증명·raw 사용자 데이터 업로드 없음. 최종 Git/SHA/실 URL 검증은 배포 증거에 기록한다.

### 2026-09-26 W08 사본별 공개 권리 결속 승인·로컬 구현

- 사용자 승인: 연결한 “공개 권한 기준 검토”의③을 진행하도록 승인. 최상위 Decision Log `PRIVATE-REPRESENTATION-PUBLIC-RIGHTS-01` 반영. 아래 같은 날짜의 결정 대기 기록은 당시 이력이며 현재 차단이 아니다. 원격 적용/실제 권리 승인/운영 Public 승인으로 확대하지 않는다.
- 구현: additive `20260925164126_private_representation_public_rights.sql`의 trusted 사본 권리 테이블 및 public asset 입력 사본 ID/hash. 기존 원본 checksum/source rights/권한/quota/미리보기 동의 유지, 일반사용자 사본 승인 쓰기 금지. 새 RPC가 owner·sourceVersion·사본ID/hash·policy·operation을 결속하고 complete·preview/build·publish/read가 철회를 확인한다. 정상 공개 이후 private copy만 제거한 것은 공개 철회와 구분한다.
- UI/HTTP: 사용자가 연동한 사본을 선택해 실제 bytes를 본 뒤 별도 공개 사용에 동의. ID/hash만 전송하면 서버가 owner 전용 private Storage에서 읽고 bytes/hash를 검사한다. 원본 업로드 경로는 기존 원본 hash 비교를 유지. `PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1` 및 `MOEMOA_PUBLIC_IMAGE_PRIVATE_SOURCE_ENABLED` 기본off. 원본/사본별 operation 구분, READY/불명 응답 및 실패 정리 계약 유지.
- 이번 PASS: 전체unit353(공개 이미지HTTP22 포함), public SQL267(기존248+신규19), private SQL47+병렬2, Chromium 공개회귀23, build18. 정확한 명령/최종 문구 검사/제한은 [이번 증거](evidence/2026-09-26-private-public-representation.json). 정상 private 사본·변조bytes·처리중 취소·미승인/타계정/익명·policy/hash 불일치·권리철회 중 complete/preview/publish/read 거부 검증. 원본 없는 제품 UI의 사본 선택→명시 동의→공개preview→게시→새 방문자 실제 이미지 decode는 HTTP/Auth 모형이며 hosted 성공 아님.
- 검사 이슈: 첫 개발서버 sharp 의존성 재최적화 reload로 원본 UI 검사 실패; API route fixture를 화면 진입 전 등록했다. 후속 두 실행의 서버 공유 종료 충돌은 중단하고4355 독립서버 전체23 PASS. 실패를 제품 성공 근거로 사용하지 않으며 로그에 남겼다.
- 잔여: 실제 test Supabase 적용·private/public Storage 통합·실휴대폰, 작은 교체 quota/사본 복구/예산·운영 역할 근거, D06 정확한 후보. 새 migration 두 개 모두 hosted 미적용, 운영/배포/유료 변경0. 새 기능을 닫아 rollback하고 원본/권리·철회 이력을 보존한다.

### 2026-09-26 W08 private→public 입력 신뢰 검토

- 실제 private processor의 정상 최적화 사본과 관계없는 다른 합성 이미지 사본을 기존 공개 HTTP handler로 각각 전송했다. 두 경우 모두 원본 sourceHash 불일치로 거부, 공개 READY0/객체0/확정 실패 예약 해제. 신규 회귀 포함 publicImages unit18 PASS. **현재 공개 우회가 확인된 것이 아니라, 단순 adapter 연결로 기존 안전장치를 제거하면 안 된다는 구현 차단을 재현했다.**
- 근거: `src/server/privateImages/processImage.js`는 수신 rendition만 attest, `src/server/publicImages/handler.js`는 원본 checksum 강제, `private.memory_public_image_rights`는 user/asset/sourceVersion의 신뢰된 권리 근거를 사용. private main을 원본으로 위장하거나 source_hash를 새 값으로 덮는 접근은 제외.
- 구체 검토안(아직 승인 전): 기존 원본 경로·checksum 유지 + 공개할 정확한 private representation ID/mainHash별 trusted 권리 근거 추가, owner/version/operation/policy 결속과 publish/read까지 철회 재검사. private 저장 자체나 브라우저 자기 선언으로 승인하지 않음. D04의 승인 모델 확장이므로 AGENTS.md의 제품결정 변경 승인 조건에 따라 사용자 결정 필요. D06 운영 활성/배포와 별개.
- 이번 변경은 회귀검사·기존 ExecPlan/작업판뿐이며 제품 코드/DB/원격/공개 설정 변경0. hosted·실휴대폰 검증 미수행. 다음1개는 위 승인 범위 결정 후 같은 W08에서 구현. 근거: [검증 기록](evidence/2026-09-26-private-public-provenance-audit.json).
### 2026-09-26 W06/W08 Archive·Board private 썸네일

- 기존 ArchiveView/MemoryBoardView의 로컬 visual이 MISSING일 때만 private wrapper에서 인증된 thumb를 읽는다. 서버 manifest의 별도 thumbnail bytes/hash(최대120KB)를 검증한다. viewport 근처만 요청하고 동시에4개까지 읽으며 영구 캐시/자동 업로드 없이 unmount·계정변경 시 abort 및 object URL revoke. 기존 카드 DOM·로컬 디자인/표지 경로 보존.
- 이번 PASS: 실제 Chromium에서 로컬 원본이 없는 Archive·Board 썸네일 및 detail main 표시, 기존 same-operation 재시도/원본 보존,390px Archive 넘침 없음.12카드 중 첫 viewport만 읽고 확대 후 최대4개의 thumb 요청, A→B 전환 시 대기8건 취소/이전 A 이미지 미노출. 신규 thumbnail hash/120KB 거부 unit 포함 전체348, private browser3+기존 Board3, build18 통과. 별도 기본off 회귀 결과는 [이번 증거](evidence/2026-09-26-private-image-list-preview.json)에 기록.
- 범위: 실제 브라우저/UI/IndexedDB/이미지 bytes 처리, Auth/metadata sync/HTTP는 모형. hosted·실휴대폰 PASS 아님. DB/의존성/운영/배포 변경0. 이전 private PG47+병렬2·public248은 과거 PASS로 유지하며 이번에는 DB 변경 근거가 없어 재실행하지 않았다.
- 잔여/다음1개: 기존 W08 공개 representation adapter. `prepareSelectedPublicImage`는 현재 원본만 허용하고 서버 원본hash를 검사하므로 private thumb/main을 원본으로 위장해 보내지 않는다. 실제 hosted/실휴대폰·복구/교체 quota·합산 예산·D03~D06은 계속 남는다. 기능 flag off로 복구 가능하며 원본/전송 journal/과거 검증 이력은 삭제하지 않는다.

### 2026-09-26 W06/W08 private Web 명시 연동 로컬 검증

- 카드 상세에서 명시 동의한 사본만 최적화/전송한다. 1600px·최대3회 인코딩·품질 하한, owner/asset/version별 IndexedDB 전송본·operation 보관, 응답 유실 뒤 reload 재시도에도 같은 bytes/ID. 원본 bytes/hash/localRef는 유지한다. 인증된 read의 hash/bytes 검증 후 임시 object URL 표시, 계정 전환·unmount에서 abort/revoke.
- 신규 PASS: 실제 Chromium file picker·큰 합성 PNG·canvas·IndexedDB·제품 화면으로 동의 전POST0, 실패/reload/같은 요청 retry, 원본hash 유지, 로컬 bytes 없는 detail에서 원격 사본 표시, 390px 가로 넘침 없음, 지연 이미지 응답 중 A→B 전환 후 A 이미지/제목 미노출. 별도 journal 경합/owner key·삭제 검사. **Auth/metadata sync/HTTP 응답은 모형이며 실제 hosted/실휴대폰 PASS 아님.**
- DB 보완: 기존 로컬 카드 삭제 fence를 private read/retire에 연결해 metadata tombstone 전 접근 차단. 공개철회는 private 사본 유지. 취소가 reservation보다 먼저 도착해도 owner+operation fence로 늦은 저장 차단(알려진 예약 취소는 계속 허용; 미예약 fence는 계정당1000행 기술적 상한). 신규 migration은 아직 어느 hosted 환경에도 적용하지 않았다.
- 발견/수정: local imageType은 rights 분류 UNKNOWN이고 서버 asset_type USER_IMAGE와 다르므로 기존 도메인 값을 바꾸지 않고 판별 연결을 수정했다. 첫 취소 SQL fixture는 B 세션이 남아 A 요청 검증에 실패했으며 A로 명시한 뒤 통과. 과거 PASS를 덮지 않고 [이번 명령·파일·제한](evidence/2026-09-26-private-image-web-client.json)에 분리했다.
- 현재 검증: unit347, Chromium 신규2 + Web intake3 + 기존 composer/owner19, private PG47+실제 병렬2, 기존 public SQL248, build18. 운영/remote 변경·배포·유료변경0. 새 의존성0. 기존 W06/W08/W15 DOING 유지.
- 실제 잔여: Archive/Board 원격 표시·공개 representation 연결, hosted private API/Storage 왕복·실휴대폰, 작은 교체의 quota 여유, private bytes 복구, 합산 비용/정책·운영 승인. 코드 잔여를 외부 차단으로 표시하지 않는다. 실제 외부 확인은 D01의 새 private test 적용 범위, D03~D05 운영값/실기기 및 D06 정확한 후보 승인이다.

### 2026-09-26 W06/W08/W15 private 서버 경계 로컬 검증

- 실제 변경: `api/private-image.js`, `src/server/privateImages/` 및 `20260925152859_memory_private_image_boundary.sql`. 원본 checksum/LOCAL_ONLY metadata는 유지하며 private owner/asset/version/수신hash/확정 사본hash·bytes/operation을 별도 manifest에 보관. default-off API·미승인/한도0 정책, source·계정 삭제 시 열람 차단/유예 정리·실제 삭제 후 quota 해제. [명령·source hash·제한](evidence/2026-09-26-private-image-server-boundary.json).
- 이번 PASS: HTTP/실제 decode7, 전체unit340, 실제 local PostgreSQL 역할/경계40 및 병렬2, 기존 공개 SQL248, Web build18. 49MB+800KB 동시2건에서1건만 허용/49.8MB. 동일operation 중복 예약·준비 차감0, B/anon 및 permissive 기존 Storage 정책 우회 차단, 과거동의/관측만료/전송제한·삭제/취소·응답유실·정리 예약 보존. 첫 SQL fixture의 삭제 status 누락은 고친 뒤 통과.
- 검증 범위: HTTP Auth/Storage backend는 모형, DB는 disposable local PostgreSQL/합성 auth.uid·Storage 테이블이다. hosted Auth/Storage나 실제 기기 성공을 뜻하지 않음. 신규 운영/테스트 원격 적용0, 앱 화면 수정0, 배포/유료변경0. 기존 공개 회귀는 새 삭제 trigger 영향 확인을 위한 것이며 기초 hosted72table 복원을 다시 실행하지 않았다.
- 잔여: client 최적화·명시 선택/계정 전환 방어·원격 표시/사용량 UI, hosted private 연결 및 실휴대폰, 사본 bytes 복구, 공개 representation 연결·교체시 quota 처리, 합산 원화비용/경보·정책 변경 감사. 외부 차단으로 뭉뚱그리지 않고 구현 잔여로 유지. 현재 CODE_COMPLETE_FOR_WEB_RC 아님. 다음 Web 카드→private API 연결.

### 2026-09-26 W06/W08 무료 private 연동의 Web 로컬 입력

- 승인 첨부의 13개 hash 대조 및 FREE-PRIVATE-IMAGE-SYNC-01 결정/기존 ExecPlan 반영. 추가 운영비5만원·무료50MB/1MB 후보 구분. 단일진행판과 과거 공개/복원 근거 보존.
- Web adapter의 실제 파일선택·decode 전 byte/pixel/format 제한, 원본 bytes/hash 보관과 preview, 같은 operation의 원자적 ticket 승격/재시도·삭제를 연결. 기본 flag off. 기존 metadata DB와 Android/public 포트 보존, 새 local media DB만 additive 생성. 새 선택 시 local-use 동의를 초기화하고 취소 때 design 선택을 유지.
- [이번 명령/파일hash/결과](evidence/2026-09-26-web-local-image-intake.json): 단위4·Chromium3(실제 file input/IndexedDB)·전체unit333·기존 composer18·build18페이지 PASS. 시작 timeout/누락된 테스트 확인버튼/Fetch 금지 port로 인한 중간 실패를 포함해 기록. 포트 범위를 지정한 테스트 harness 수정은 제품 변경과 구분. 합성 PNG만 사용, 업로드 요청0.
- W06/W08 미완료: private remote manifest/reservation·client 최적화·서버 검증/quota·동기화 및 owner격리/삭제/복구·사용량 UI, 실물 휴대폰↔PC. 이들은 외부 차단이 아니라 남은 구현이다. 실제 기기와 D03~D05 운영값/근거·D06 후보 승인은 별도. 신규 migration/운영 변경/배포/유료변경0. 새 source 미커밋. 다음 서버 정책 기반 private representation 저장·읽기 경계.

### 2026-09-25 D02 Web-only 확정 / W20 후보 검사 보완

- 사용자 첫 Web-only 후보 확정. 최상위 Decision Log RELEASE-CHANNEL-WEB-FIRST-01 및 [승인 근거](evidence/2026-09-25-d02-web-only.json) 기록. Android는 후속 출시, 제품 범위/코드 보존. 새 계획판 없음.
- 후보 guard: WEB_ONLY+Android NOT_APPLICABLE일 때 같은 HEAD/0건/사유/VERIFIED D02 동일 유효 evidence 요구. 승인누락·변조·다른 채널·다른 Web 검사 N/A·D06미승인 모두 거부. 기존 후보 기본값 Web+Android 유지. [변경/명령/검증](evidence/2026-09-25-w20-web-only-validation.json): 전용3PASS, 전체unit329PASS/0fail, Web build18페이지PASS. 이번 서버/DB/제품 UI 변경없음.
- 과거 후보 보존, [최신 초안](evidence/2026-09-25-w20-web-draft-candidate.json)에 승인과 새 unit/build 근거 연결. guard 실제 ready=false/14blockers: source 미고정/dirty·검사 HEAD 결속 부재(승인된 Android 제외도 HEAD 미결속)·D01 최종환경 잔여·D03~D06·catalog hash. D02 승인 항목은 통과. 과거 catalog/browser/SQL 근거는 날짜 그대로, 최신 재검사로 주장하지 않음.
- 운영비 상한/초기 규모·운영자/지원 및 경보 담당·보존/복구 목표 D03~D05 사용자 입력 요청. 이는 기존 게이트의 실제 미확정 값이며 테스트 계정/키 재요청 아님. 공개 전달 최종 후보/실제 만료·지원환경 잔여 유지. 다음 운영값 반영과 최종 후보 결속. master merge/push/배포/Public 변경0. git diff --check PASS.

### 2026-09-25 W19/Q11·Q19 필수 경계 연속 검증 — 이번 실행 PASS

- 기존 ExecPlan/계약·image/resource migration 및 기존 helper를 확인. 기존 A/합성 WebP checksum을 대조 후 실제 SDK+local 제품 image handler→hosted Storage로 READY. 한도1에서 두 번째 준비 IMAGE_QUOTA_EXCEEDED. preview13 후 권리 철회→게시 PUBLIC_VISUAL_NOT_READY/anon null/이미지404. 같은 합성 권리 복구·새preview14·게시15→이미지200/60bytes. 게시 후 권리 철회→공개 cards0/같은URL404. owner철회16. [전체 증거](evidence/2026-09-25-w19-rights-quota.json).
- 이어 실제 image 준비2건 동시 시작→READY1/IMAGE_QUOTA_EXCEEDED1, DB active1/reserved118. owner취소 후 지정 파생본2개 DELETED/예약0. 모든 flagsfalse/quota0/policy UNAPPROVED/rights0/moderator0/home private/감사8 보존. 원본 변경/새 migration/운영 변경0. 임시 파일/서버/탭 정리.
- 최신 product UI Chromium **22PASS/0fail**(1.2m). hosted DB authenticated 역할+transaction A claim 검사에서 일일한도/유효override/만료/정지 통과, 성공2회만 차감 후 전체 ROLLBACK. 첫 준비는 closed gate 오류로 rollback, 두 번째는 같은 transaction 내부 test gate 포함 후 통과. 실제 JWT/HTTP429와 구분. [명령·경계](evidence/2026-09-25-w19-current-regression.json). 과거 PASS를 이번 PASS로 바꾸지 않음.
- 새 제품 결함 없음. 기존 W19 미완료는 최종 후보 환경/실제 만료·지원환경, Q19 실제429/경보 인수 및 D03 등. D02 최종 Web-only 여부를 사용자에게 요청(이번 Android 제외는 유지). 다음 D02 결정에 따라 기존 W20 후보 검사 확정; 운영 배포·Public 승인은 D06로 유지. git diff --check PASS.

### 2026-09-25 W19/Q11 policy 변경 — 이번 실행 PASS

- 기존 계약/진행판/publish 함수와 ExecPlan을 대조하고 기존 계획에 좁은 검증 범위를 추가했다. 합성 디자인2개와 실제 A SDK RPC 재사용. baseline 공개→review20(TEST_ONLY_20260925)→서버 policy V2 변경→이전 동의 게시 CONSENT_MISMATCH. 익명 전체 JSON hash 90475b8f… 불변. 새 preview21/V2→게시 revision22 성공, 익명 새 제목 및 hash823810b3… 확인. [명령·전체 hash·제한](evidence/2026-09-25-w19-policy-consent.json).
- cleanup: REVOKED/revision23, 원본 title/version3 보존, all flagsfalse/quota0/policy UNAPPROVED/moderator0/rights0/감사8/home private. 임시 파일·탭·서버 제거. 제품 코드/새 migration/운영 변경0, 기존 자동검사 PASS 재사용 주장 없음. git diff --check PASS.
- 임시 진단 버튼의 실제 API 검증이며 제품 체크박스 E2E 아님. 다음 이미지 권리 승인 철회 경계. W19/Q11 전체 종료 및 D02~D06 승인 아님. Android 제외 유지.


### 2026-09-25 W19/Q11 실제 동시 게시 — 이번 실행 PASS

- 기존 계약/QA/ExecPlan/source-status publish 함수와 합성 fixture를 확인하고 기존 계획에 범위를 추가했다. 실제 A 세션 SDK RPC를 임시 진단 버튼에서 Promise.all로 시작했다. 같은 operation 두 요청은 review13→둘 다 revision14, owner14/재전송14. 다른 operation 두 요청은 review15→하나 revision16/하나 PUBLICATION_CONFLICT, owner16/재전송16. 각 경우 입력 hash가 다른 같은 operation은 OPERATION_MISMATCH. 익명 공개 제목/디자인 카드2개 일치. 두 요청의 client 실행 구간은 겹침; 서버 내부 스케줄 강제나 부하 시험/제품 double-click UI 증거는 아니다.
- [실행 명령·타이밍·익명 hash](evidence/2026-09-25-w19-concurrent-publish.json). 제품 코드/새 migration/운영 변경0. 과거 PASS와 분리. npm 인자 전달 누락은 검사 전 서버 종료 후 Astro 직접 실행으로 수정했다.
- 종료 보드 REVOKED/revision17, 원본 title/version3 보존, flags 모두false/quota0/policy UNAPPROVED/권한0/rights0/감사8. 임시 파일 제거·서버 종료. diff check PASS. Q11 전체 종료 아님; 다음 미리보기 이후 policy 변경 거부. 기존 D02~D06·Android 제외 유지.


### 2026-09-25 W19/Q11 hosted 미리보기·동의 경계 — 이번 실행 PASS

- AGENTS/시작·확정 결정, 기존 Q11/ExecPlan, source-status migration의 publish 검사를 대조. 참조 대화는 배경 자료이며 실제 오류명/계약은 코드로 확인했다. 기존 ExecPlan에 범위 추가, B 보드/합성 디자인2개 재사용. 임시 버튼은 실제 A JWT의 기존 RPC이며 제품 체크박스 UI E2E 아님.
- baseline 공개→review9→합성 원본 title/version1→2 변경→같은 review/operation 게시 PREVIEW_CHANGED. 익명 JSON hash **90475b8f…** 그대로. 새 review10 생성 뒤 구 review9 게시 PUBLICATION_CONFLICT, 익명 hash 다시 동일. 최신 review10 게시만 성공/revision11, 익명 hash **fc794378…** 및 변경 제목 일치. [전체 hash·명령·범위](evidence/2026-09-25-w19-preview-consent.json). 변경 내용이 이전 동의로 공개되지 않았음을 실제 hosted에서 확인.
- cleanup: 보드 REVOKED/revision12, 합성 제목 원복/version3(버전 되감기 없음), all public flags false/quota0/policy UNAPPROVED/roles0/rights0. 원본·감사8 보존. 임시 JS/HTML 제거/서버·탭 종료. 제품코드/새 migration/운영 변경0, 과거 자동검사 재실행 아님. diff check PASS.
- Q11 전체 종료 아님: 실제 동시 요청·권리/policy 변경 조합 잔여. 다음 실제 동시 게시; D02~D06/정확한 후보·지원환경/Android 제외 유지.


### 2026-09-25 W19/Q15 재개 — 제품 home 비공개/보드 유지 PASS

- 기존 pending 증거와 ExecPlan에 따라 재개. 초기 UI는 결과 불확실, DB는 home published/revision17이어서 이전 철회 성공으로 간주하지 않았다. 제품 재조회 후 비공개 확인창을 다시 열고 사용자가 확인 클릭을 보조했다. reads/home을 켠 상태(writes off)에서 owner private 메시지, 방문자 home unavailable, anon HTTP home null/별도 board2 유지, DB home private/revision18 확인. [완료 증거](evidence/2026-09-25-w19-representative-private.json).
- 실행: q15-resume-check.sql/read-enable.sql, q15-multi-read.mjs after, q15-multi-cleanup.sql, test-public-restore.sql. 이후 home private/보드 B REVOKED, 모든 server flags false/quota0/policy UNAPPROVED/role0/rights0. 기존 감사8·합성 private 원본 보존. client flags off/서버 종료/임시 탭 닫음. 제품 코드/새 migration/운영 변경0. diff check PASS; 과거 자동검사 재실행 아님.
- Q15 해당 잔여 완료. 전체 W19/D02~D06·최종 후보 전달환경은 미완료 유지. 다음 Q11 hosted 미리보기 뒤 변경 거부 검증. 대기 로그는 당시 이력으로 보존한다.


### 2026-09-25 W19/Q15 다중 대표 확인 — 비공개 확인창 대기

- 기존 ExecPlan/현재 Q15·SQL visual 계약을 대조했다. 같은 B test 보드에 합성 SYSTEM_DESIGN 카드2개를 fixture로 준비(제품 작성 UI 증거 아님). 첫 design 필수값 누락은 PUBLIC_VISUAL_NOT_READY로 transaction rollback, 명세대로 보완한 두 번째 준비 성공. 제품 owner UI에서 두 번째 카드만 선택·미리보기·게시. 실제 방문자 화면 및 apikey만 사용하는 anon HTTP에서 board2/home1(두 번째 카드만) 확인. [현재 실행 증거](evidence/2026-09-25-w19-representative-private.json). 제품소스/migration/운영 변경0.
- 제품 Make public home private 클릭으로 native confirm이 열렸으나 도구 click timeout/getJsDialog undefined. 사용자 확인 클릭 요청 대기이며 UI 비공개 PASS 아님. 대기 중 서버 public flags 전체false/quota0/policy UNAPPROVED/권한0으로 닫았다. home/B board의 published snapshot은 비교용으로 남아 있지만 reader는 닫힘. 프런트/서버와 확인창은 재개를 위해 유지.
- 재개: 확인 클릭 후 test reads/home만 일시 활성해 home null + B board2 확인해야 한다. flag-off 자체의 null을 철회 PASS로 세지 않는다. 이후 .cache/q15-multi-cleanup.sql 및 기존 restore로 정리/client flags off/서버 종료. 기본 DB/A-B/복원 반복 없음.


### 2026-09-25 W20 현재 후보·Q/D 대조 — 출시 미승인

- 기존 지침/결정/진행판/후보·설정 JSON/check-release-candidate 및 전용검사를 읽고 기존 ExecPlan에 범위 추가. 과거 null 후보 파일/실행 로그는 변경하지 않았다. 최신 W19 증거5개를 hash로 참조하고 현재 요약·W14/Q04/Q07/Q08/Q12/Q13/Q17/D01의 오래된 미검증 문구만 보정했다.
- 실제 명령: `node scripts/check-release-candidate.mjs docs/moemoa/release-v2/evidence/2026-09-24-w20-candidate.json` → ready=false/exit2/15 blockers. `node --test tests/unit/releaseCandidate.test.mjs` → 2PASS/0fail. [결과·현재 증거 참조](evidence/2026-09-25-w20-gap-audit.json). CHECK_INCOMPLETE는 이번 테스트 실패가 아니라 해당 후보 SHA에 결속된 근거 부재다. 과거 후보 D01 PENDING도 현재 키/권한 부재라는 뜻이 아니다.
- 실제 잔여: hosted 만료/거절·다중카드/전체철회·동시성/한도/최종 전달환경; 정확한 clean 후보와 해당 CI/checks, migration/source-remote 매핑/catalog hash/config/rollback 결속. D02 최종 채널, D03 예산/한도/경보, D04 주체/정책/지원 담당, D05 운영 사본/journal/보존·복구 목표, 마지막 D06 정확한 후보 승인.
- guard 발견: android가 필수 목록에 고정돼 있다. D02 Web-only 확정 시 기존 W20에서 승인 근거를 검사하는 N/A 경로가 필요하며 지금 가짜 PASS/임의 제외를 넣지 않는다. 현재 실행 Android 제외 유지.
- 문서·감사 증거만 변경, 제품/DB/환경/원격/commit/push/배포 변경0. 과거 unit/build/SQL 종합 PASS를 이번에 재실행한 것처럼 쓰지 않는다. 완료수 유지. 다음 W19/Q15 좁은 실제 잔여를 마감하며 D02~D05 결정은 기존 표로 병행한다.


### 2026-09-25 W19/Q18 이의·공개 쓰기 제한/해제 — 이번 실제 실행 PASS

- 지침/확정 결정/현재 진행판과 public-moderation 운영 절차, MemorySafety/SQL을 확인하고 기존 ExecPlan에 범위 추가. 승인된 A moderator만 임시 부여, 기존 사건 재사용. 임시 로컬 버튼은 실제 A JWT로 기존 운영 RPC를 호출하며 제품 운영콘솔 검증으로 포장하지 않는다. reads/images/home/follows/reports off 유지, writes와 TEST_ONLY policy만 일시 활성. 처음 UNAPPROVED로 PUBLICATION_DISABLED였으므로 policy를 맞춘 뒤 비교했다.
- 제한 조치 revision6 → 동일 prepare probe PUBLICATION_RESTRICTED. 실제 owner 제품 알림에서 이의 제출/Appeal received, 사건 APPEALED/revision7. 이전 revision6 검토는 PUBLICATION_CONFLICT. 제한 중 이미 private인 home의 revoke RPC 성공. 최신 사건 재조회 후 RELEASE_ACCOUNT/revision8, 제품 해제 알림 확인. 동일 empty-card probe는 INVALID_SELECTION으로 바뀌어 제한 판정 통과를 확인했으며 정상 재게시 성공으로 주장하지 않는다.
- 원복 후 moderator0, active sanctions0, 모든public flags false/quota0/policy UNAPPROVED/rights0/home private/board REVOKED. 실제 같은 JWT의 queue 조회 MODERATOR_REQUIRED. 감사5→8(RESTRICT_ACCOUNT/APPEAL/RELEASE_ACCOUNT), appeal1 보존. 임시 HTML/JS 제거·client flags off·서버/탭 종료. 새 migration/제품 소스/운영 변경0. [실행 명령·범위·증거](evidence/2026-09-25-w19-appeal-restriction.json). 과거 자동검사는 이번 재실행 아님.
- W19 전체 DONE 아님. 승인 A가 운영자이자 소유자인 test, 실제 별도 담당자/지원채널/정책·SLA는 D04. 다음 W20 기존 후보검사/Q/D 잔여 대조. D02~D06 및 Android 제외 유지.


### 2026-09-25 W19/Q15 실제 미니홈 편집 — 이번 실행 PASS

- 기존 지침·결정/진행판/C11·C12·MemoryMinihome 편집 코드와 기존 SQL 계약을 확인하고 ExecPlan에 범위 추가. 합성 A 보드는 실제 제품 UI로 게시, B는 같은 합성 카드의 별도 private Board fixture 및 기존 owner RPC로 준비했다. fixture 준비를 사용자 UI PASS로 세지 않는다. 첫 준비는 게시 후 비워진 selection 때문에 INVALID_SELECTION으로 transaction rollback; 두 번째 명시 selection 성공.
- 실제 owner UI에서 A 대표 카드 선택/B 전체 보드 선택, 아래로 이동해 B,A 게시. 익명 화면 순서와 실제 이미지2개(16px) 확인. 소개 수정 및 위로 이동해 A,B 미리보기 동안 anon은 이전 소개/B,A 유지; 재동의·게시 후 새 소개/A,B 반영. 태그 모양 소개는 문자로 표시되고 해당 script DOM0. DB published_selection의 A.cardId/B 전체 선택 대조. [명령·증거·한계](evidence/2026-09-25-w19-minihome-edit.json). 보드당1카드이므로 다중 카드 제외를 새 PASS로 주장하지 않는다.
- cleanup은 기존 owner RPC로 home private/두 보드 REVOKED, 합성 derivative DELETED/예약0·원본 checksum 보존. test flags 전부false/quota0/policy UNAPPROVED/moderator0/rights0/감사5. B private fixture는 재사용 가능하게 보존. frontend flags off/proxy 종료/임시 탭 닫음. 제품코드·새 migration·운영·배포 변경0. 과거 자동검사 결과는 재실행하지 않음.
- W19 VERIFY와 완료수 유지. 다음 실제 이의/계정 제한 검증(Q18), hosted 만료·후보 전달 환경 및 D02~D06 잔여. Android 제외 유지.


### 2026-09-25 W19/Q05 만료·복귀 — 이번 로컬 실행 PASS

- 문서/소스: AGENTS, CODEX_START_HERE, 최상위 결정, PLANS, QA07/변경관리09, V2 진행판/C11·C12/기존 ExecPlan, webOAuth/authRepo/AuthCallbackClient/useAuthSession/MemoryRelationships 및 기존 callback 검사를 대조했다. 기존 ExecPlan에 범위를 추가하고 새 진행판 없이 진행.
- 새 검증: tests/publication-ui.spec.ts에 설치된 실제 Supabase SDK를 사용하는 만료 session 회귀1개 추가. SDK를 가짜 객체로 대체하지 않고 Auth HTTP만 합성한다. 만료 저장세션→refresh400 1회→세션 제거→로그인 요구→PKCE challenge/verifier→교환1회→원래 home 복귀, 자동 팔로우0, return context 소비, console 토큰/코드 marker0 PASS. 기존 거절/교환실패2개와 함께 Chromium **3/3, 4.6초**. [정확한 명령·hash·범위](evidence/2026-09-25-w19-auth-return.json).
- 실제 Google/hosted 만료 성공으로 승격하지 않는다. 과거 unit328/SQL248/build는 이번 재실행 아님. 새 제품 결함 발견0, 제품 소스 변경0, 새 DB migration0, remote flags/역할/권리 변경0. 테스트·문서만 되돌릴 수 있으며 원본/비밀값/로그 수집 정책 변경 없음.
- 남은 W19: hosted 만료 재인증, 실제 대표 정렬/이의·계정제재, 정확한 후보 전달환경. 다음 Q15 실제 미니홈 편집. D02~D06/Android 제외/운영 무변경 유지.


### 2026-09-25 W19 제품 UI 철회 후속 — 이번 실행 PASS

- 기존 ExecPlan §17의 합성 fixture만 재사용. 제품 화면 재게시→미니홈 전시→익명 실제 이미지16x16 확인 후 철회 확인창 취소 시 board/home/이미지200 유지. 다음 확인창 수락 후 소유자 철회 완료, 익명 보드 unavailable, home 전시1→0, 직접 이미지200→404/no-store를 **공개 flags가 켜진 상태에서** 확인했다. native confirm은 도구가 인식하지 못해 사용자가 취소/확인 클릭을 보조했다. RPC 대체가 아니다.
- [실행 증거](evidence/2026-09-25-w19-withdrawal-ui.json)에 실제 HTTP 결과/명령/범위 기록. 이번 제품 코드·migration 변경0. 과거 unit328/browser21/SQL248/build PASS는 재실행하지 않았으며 이번 PASS와 구분한다.
- 정리: 기존 owner RPC로 남은 home 비공개, 합성 derivative 취소→서비스 정리로 DELETED/예약0. 원본 checksum 보존. test public flags false/quota0/policy UNAPPROVED, moderator0/active rights0, 감사5 보존. frontend flags off·임시 proxy 종료·검증 탭 닫음. 운영·Git push·배포 없음.
- W19는 VERIFY 유지: 만료/로그인 복귀, 대표 정렬/이의·계정정지, 정확한 후보 전달 환경 잔여. D02~D06과 Android 제외 유지. 새 계획판이나 완료 수 증가 없음.


### 2026-09-25 검토 적용 및 실제 공개 흐름 — 이번 실행 증거

- 기준: AGENTS/CODEX_START_HERE/최상위 결정/PLANS 및 기존 V2 00~03·이미지/QA/변경관리, 현재 HEAD bbff3d4와 clean diff를 먼저 비교했다. ZIP의 과거 검토 patch18hunk를 문맥 일치로 반영하고 제공 review/unit/retry 원본은 evidence에 보존했다. 새 계획·작업판 없음.
- 코드: W08 owner 상태 조회·service 실패 정리 확인 후만 새 operation; READY/불명 완료는 같은 ID. 취소된 늦은 재시도 응답도 현재 ID를 지우지 않음. W13 별도 공개 author RPC는 home ID/닉네임만 반환하며 기존 home→board reader 순환 호출을 피함.
- 새 hosted 발견/수정: USER_IMAGE DTO designSpec:null이 JSONB null로 저장되어 source_metadata_check(23514)가 실패. hydration trigger의 null 정규화만 추가했고 실패한 동일 pending operation이 SYNCED로 회복했다. 일반 object 거부는 유지. 기본 DB 연결·A/B 격리·hosted72table 복원은 반복하지 않았다.
- 이번 로컬 PASS: npm run test:unit **328**, publication-ui Chromium **21**(합성 RPC, 최종 stale recovery guard 이전), PostgreSQL16 계약 **248 PASS markers**, npm run build PASS. targeted image/controller33 PASS 이후 늦은 recovery guard1건 추가는 전체328에 포함. 최초 retry 회귀 실패, 기본 PG14 경로 부재, CRLF patch check 실패도 숨기지 않으며 실제 최종 명령/hash는 [증거 JSON](evidence/2026-09-25-review-apply-public-flow.json)에 기록.
- 이번 실제 UI PASS: A 선택 게시→새 익명 origin의 WebP16x16/60bytes decode→공개 mini home→B 공유보드 author link/팔로우/목록 재방문→신고접수→차단/해제·팔로우 미복원, A 조치 통지. 잘못된 원본 실패 operation은 DELETED/예약0, 같은 화면 정상 retry는 새 ID/READY118bytes, 원본 checksum 유지.
- 실제 RPC PASS: A 실토큰·임시 moderator로 공개 home HIDE→익명 null/author 링크 null→RESTORE→owner board/home revoke→이미지404→RESTORE해도 owner 철회 비부활, 감사5건. 기존 익명 제품 화면도 refetch 시 unavailable. 운영자/마지막 owner 철회는 임시 버튼→기존 RPC이며 제품 운영 콘솔·철회 확인창 E2E로 포장하지 않는다. native confirm 자동화가 일시 중단됐고 사용자 확인 요청 후 해제되어 차단 검증은 완료됐다.
- 환경/마이그레이션: 테스트 ref에만 source 20260924193626→remote20260924194322, 20260924194059→20260924194325, 20260924195510→20260924195621. source SHA256은 JSON. 자동 db push/reset 없음. 운영 DB/master/push/deploy/유료 변경 없음.
- 원복: 모든 public flags=false, quota0, policy UNAPPROVED, moderator0, active rights0, board REVOKED/home private, 관계 false/false. 합성 공개 사본full/thumb는 취소→service claim→Storage remove→complete로 정리해 두 operation 모두 DELETED/예약0. 원본/신고/감사/권리 철회 이력 보존. 임시 HTML 제거·4321/4325 API proxy 중단·frontend flags off. schema rollback은 호출 코드 이전본 복원, 이력/원본 삭제 없는 방식; 세 additive migration은 테스트에 유지.
- 보안/제한: service secret/token은 로그/Git/브라우저 결과로 추출하지 않음. Supabase advisor는 private RLS/no-policy 및 의도한 공개/인증 SECURITY DEFINER 경고, leaked password protection disabled를 남김. [advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password 설정](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). 정책/권리 확대·완전 보안 통과 선언 없음.
- D03~D05: 위 측정값은 작은 합성 입력만의 결과. 운영 정상규모/월예산/경보 수신·대응자(D03), 법적주체/정책/연령/지원주소·권리/신고/삭제 담당(D04), 운영 canonical/이미지 사본·최신 철회 journal 보존/복구목표·복구담당(D05)만 미확정. 기존72table 복원 증거는 과거 근거로 유지. Android 실행 제외는 D02 최종 Web-only RC 승인과 구분.

### 2026-09-25 Pro 검토 반영 — 문서만, 실행·승인 아님

- 근거: [출시 잔여 검토서](evidence/pro-review-bbff3d4-2026-09-25/review.md), [이미지 재시도 모형 재현](evidence/pro-review-bbff3d4-2026-09-25/upload-retry-result.json), [외부 검토 환경 unit 결과](evidence/pro-review-bbff3d4-2026-09-25/unit-summary.json). 이 증거의 “이번 실행”은 각각의 원래 검토 시점이지 이 문서를 반영한 세션이 아니다.
- M0~M5/W01~W20/C01~C12/Q01~Q24/D01~D06 유지. 별도 진행판 없음. 기본 DONE W01/W02/W04/W05, M0 종료 수를 이 문서 변경으로 늘리지 않는다.
- 다음 실제 수정은 W08의 확정 실패/불확실한 완료를 구분한 이미지 재시도. W13의 공유 보드→공개 작성자 미니홈 경로를 확인하며 실제 공개 통합 검증으로 복귀한다.
- 테스트 기본 환경·A/B·키·기초 격리·72 table 복원은 확보 근거가 있다. 공개 활성화 승인/실제 이미지 전달·철회 성공까지 확보한 것으로 해석하지 않는다.
- Android는 이번 실행 제외이며 D02의 최종 후보 채널 승인과 구분한다. 운영 Public·DB·master·배포 변경은 이 문서 반영의 승인 대상이 아니다.
- D03~D05의 측정/정책/담당/경보/사본만 병행 수집하고, 정확한 RC의 Git/CI/migration/catalog/flags 및 D06을 마지막에 닫는다. 새 기능·범용 관리자/DR·기본 테스트 인프라 재구축은 범위 밖이다.

### 2026-09-25 Pro 중간 검토 Git 인계

- 사용자 요청: Git 최신화·링크·검토 문서 정리. 운영 자동 배포를 유발하는 master 대신 `review/pro-interim-2026-09-25` 브랜치를 만들었다. 새 계획을 만들지 않고 [검토 안내](../reports/2026-09-25-pro-interim-review.md)에 읽기 순서/소스 지도/검증 범위/출시 잔여/Pro 질문을 모았으며 시작 문서의 진입 링크를 갱신했다.
- 현재 소스 재검사: `npm run test:unit`320/320 PASS, `npm run build`18 pages/postbuild PASS. 전체 브라우저/SQL/원격 CI를 이번 인계에서 재실행했다고 하지 않는다. 과거 테스트는 해당 evidence의 당시 소스 범위로 구분했다.
- stage120개 파일에 대해 로컬 실제 server key/DB URL/password 일치, secret key/접속문자열/private key/non-anon JWT 패턴 검사 발견0. staged diff check PASS. env·DB dump·로그·개인 이미지 미포함. 기존 Android 관련 소스 변경은 누적 개발본 보존을 위해 포함하지만 Android 추가 구현/검증은 하지 않았다.
- 이번 변경은 검토용 commit/push만 허용하며 운영 DB/migration/Public/master merge/운영 배포는 수행하지 않는다. 브랜치 push 뒤 원격 SHA를 대조한다. 원격 Actions 실행은 별도 확인 없이는 PASS로 표시하지 않는다.

### 2026-09-25 출시 잔여 범위 재정렬

- 사용자 질문에 따라 Pro V2 실행 패키지·문서 검증·W목록·최신 증거를 대조했다. 문서 구조/25개 기존 지적 매핑 완료와 기능의 출시 완료는 구분한다. 4/20은 엄격한 작업 종료 판정이며 구현20%라는 의미가 아니다. 과거 W행의 환경 없음/미검증 설명은 당시 이력이며 위 최신 상태와 후속 증거를 우선한다.
- 최근 작업이 테스트 인프라에 집중됐다. 이미 확보한 연결·A/B 기본 격리·백업 복원은 새 변경/실패가 없으면 반복하지 않는다. 테스트 DB 자체를 추가 개선하는 작업을 새 출시 선행조건으로 늘리지 않는다.
- 남은 순서: (1) 실제 공개 보드/이미지/미니홈/팔로우·신고/차단/철회 통합 검증 및 발견 결함 수정, (2) 기존 원장 D03~D05의 최소 운영값·담당/정책·보존/비용/경보와 자료 인계 확정, (3) 최신 후보 회귀·보안 검토·Git/CI·빌드 provenance 및 운영 migration/rollback 준비, (4) 정확한 후보 D06 승인 후 Git 연동 배포·운영 smoke. Android는 사용자 지시대로 이번 실행에서 제외하며 영구 platform 축소/자동 통과로 해석하지 않는다.

### 2026-09-25 D05 hosted 테스트 DB 백업 → 격리 PostgreSQL17 복원

- 사용자 `ㄱㄱ`에 따라 기존 ExecPlan에 hosted 복원 범위를 먼저 추가했다. 기존 시작/확정 결정/QA/변경 통제/복구 인수인계와 local harness·restore script를 기준으로 진행했다. 공식 [PostgreSQL Ubuntu 도구](https://www.postgresql.org/download/linux/ubuntu/)와 [Supabase 백업·복원](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)을 확인했다.
- 공식 서명 apt 저장소에서 PostgreSQL17.11 server/client 및 libpq 패키지를 다운로드·추출해 WSL `/opt/moemoa-pg17`에 격리했다. 기존 PostgreSQL16/시스템 apt sources/앱 dependency/lockfile은 변경하지 않았다. 새 DB는 Unix socket 전용, TCP listener 없음, 완료 후 중지했다.
- 원격은 테스트 ref `nmgkhknponvzcwliajyk`/Session pooler5432 guard 및 `default_transaction_read_only=on`으로 고정했다. 전체 custom pg_dump PASS: **708,697bytes**, SHA256 `d6af268a6b839a2f9782c04cf7b7775921a7be35aad4c971e8e137f61f8507c5`, source17.6/tool17.11. 실제 dump는 WSL `/var/lib/postgresql/moemoa-hosted-recovery-20260925/hosted.dump`에 mode600, 상위 folder700으로 보관. 테스트 Auth 데이터가 포함되므로 Git/일반 로그에 복사하지 않는다.
- 격리 DB 복원 PASS: `public/private/auth/storage/supabase_migrations` **72개 테이블**의 건수·전체 행 digest가 원격과 일치. UTC 및 C 정렬을 고정하고 비교 전후 원격 데이터 불변 확인. 원문과 개별 digest는 출력하지 않았다. RLS enabled/forced, policy 정의, anon/authenticated/service_role 테이블 권한도 원본과 일치. 두 계정, COMPLETE_PRIVATE1/DELETED1, Storage metadata1 보존; 원격·복원본 Public flags 모두 closed.
- 첫 로컬 복원은 schema 필터가 CREATE SCHEMA 항목을 포함하지 않아 실패했다. local 스키마를 먼저 준비한 후 전체 선택 schema 복원은 exit0. 첫 행 비교는 UTC/JST 표현 차이로16테이블 불일치였으며 시간대/정렬을 정규화한 최종72개 비교는 모두 일치했다. 데이터 수정으로 결과를 맞추지 않았다.
- 한계: 전체 dump 확보와 **선택5schema 복원**을 구분한다. Supabase cron/vault/realtime 플랫폼 객체·Auth HTTP/Storage service·외부 OAuth 설정은 로컬에 재구성하지 않았다. 원래 DB owner는 local postgres로 매핑했다. Storage bytes는 앞선 별도60bytes 사본이며 DB dump에 포함된다고 하지 않는다. 운영 백업/PITR/보존·RPO/RTO·배포/CDN 검증은 여전히 남는다.
- 변경: ExecPlan/이 원장/[복구 결과 JSON](evidence/2026-09-25-hosted-db-recovery.json), ignored 진단 scripts 및 WSL 격리 도구/사본. 앱 코드·원격 데이터·schema migration·공개 활성화·Android·commit/push/deploy 변경 없음. rollback은 local DB 중지와 도구 사용 중단이며 원격 자료를 되돌릴 작업은 없다. D05 부분 증거 추가이며 모든 W 완료/출시 승인으로 승격하지 않는다.

### 2026-09-25 서버 연결·Storage 사본 확인

- 사용자 입력 완료 후 `.env.moemoatest.server.local`의 값은 출력하지 않고 존재·대상 ref·포트·형식만 검사했다. `moemoa-test` ref 일치, Session pooler5432, secret key 형식 확인. env 및 `.cache` 사본은 gitignored다.
- 실제 psql 연결 PASS: TLS require, PostgreSQL17.6/postgres 응답. 첫 inline Python 호출은 WSL 실행 구성 문제로 결과가 없어 성공으로 세지 않았고, 파일 기반 probe로 실제 연결 성공을 확인했다. 비밀번호는 프로세스 인자나 일반 로그로 출력하지 않았다.
- 실제 서버 키로 private bucket의 기존 합성 `d01-probe.webp` 다운로드 PASS. 로컬 백업 사본60bytes와 재다운로드 SHA256이 기존 기준과 모두 일치하며 sharp 실제 decode16x16 PASS. Storage 복원/공개 이미지 전달/CDN 성공을 뜻하지 않는다.
- 읽은 기준: AGENTS/시작 문서/확정 결정/PLANS/QA/변경 통제/기존 ExecPlan·복구 인수인계 및 Supabase·verify-before-claiming skill. 변경은 ExecPlan/이 원장/[결과 JSON](evidence/2026-09-25-server-connection.json)과 ignored 진단 파일/합성 사본뿐이다. 제품 코드·DB migration·운영/Public/배포 변경 없음, rollback은 진단 실행 중단이다.
- 다음: hosted DB17에 맞는 dump 도구와 격리 복원 준비. 현 WSL에는 PostgreSQL16 도구만 있으므로 hosted 전체 dump/restore는 아직 실행하지 않았다. D01/D05 전체 완료 아님. Android 제외 유지. 키 재입력은 필요 없다.

### 2026-09-25 D05 오래된 백업 복원 및 이미지 처리 로컬 재검증

- Android 제외 지시 유지. ExecPlan D01 후속을 먼저 추가하고 restore-roundtrip/resource-contract 및 이미지 handler/backend/검사를 읽었다. Supabase 공식 백업 문서에서 DB 백업에 Storage 파일 bytes가 포함되지 않는 점을 확인했다: https://supabase.com/docs/guides/platform/backups .
- 기존 최신 pg_dump→별도 DB pg_restore 검사에 오래된 백업 시나리오를 추가했다. 실제 로컬 PostgreSQL16에서 별도 recovery DB의 합성 게시물1개 노출 확인→dump→카드 retire→최신 fence CSV 추출→stale DB로 restore→삭제 전 노출이 재현되는 대조군 확인→공개 gate 닫기→최신 fence 중복2회 병합→reads만 열어도 카드0개→다시 닫기를 검증했다. hosted/운영 서버에는 적용하지 않았다.
- 발견/수정: resource-contract의 전날 fixture가 서버 timezone current_date-1을 사용해 JST 자정~UTC 자정 사이에 UTC 오늘로 남는 테스트 오류. 제품 budget은 UTC를 사용하므로 fixture도 `(now() at time zone 'UTC')::date-1`로 수정했다. 제품 quota 동작/schema는 바꾸지 않았다.
- 최종 전체 SQL harness PASS, 추가 stale 복원 검증 PASS. `.cache/d01-stale-restore.log`, WSL artifact `/tmp/moemoa-publication-test.LSOuuq`에 실제 dump/restore/journal 사본. 서버 격리는 Unix socket + listen_addresses=''이며 합성 데이터만 있다. `node --test tests/unit/publicImages.test.mjs` 14/14 PASS: 실제 sharp 바이트 변환/metadata 제거/실제 loopback HTTP, backend RPC/Storage는 모의이므로 hosted 이미지 처리 성공으로 세지 않는다.
- 변경 파일: restore-roundtrip.sh, resource-contract.sql, ExecPlan/진행판. rollback은 추가 리허설만 되돌리며 운영 원본/삭제 이력에 영향 없다. 테스트 DB schema/운영/Public/의존성/배포 변경 없음.
- 실제 hosted 전체 DB dump 및 서버 전용 이미지 backend 연결은 로컬 DB URL·service key가 없어 대기. 값은 읽거나 노출하지 않았고 존재하는 env의 해당 키 유무만 확인했다. 무시되는 `.env.moemoatest.server.local`에 빈 입력란을 준비했다. 필요한 값은 moemoa-test Session pooler DB URL과 서버 전용 service_role/secret key이며 운영 값 사용 금지. 아직 공개 이미지 활성화나 D05 완료 판정은 하지 않는다.

### 2026-09-25 D01 실제 API·Storage 검사 — Android 제외

- 사용자 범위: 나머지 진행, Android 제외. 기존 ExecPlan D01에 실행 계획을 추가하고 Supabase/검증 skill과 실제 source/migration을 확인했다. 공식 changelog 및 Storage access-control 문서 확인. 대상 test ref 고정, 운영/정책/공개 권한 변경 없음.
- 방법: 무시되는 `.cache` loopback HTML/JS에서 기존 실제 Google A/B 세션으로 정상 Supabase client를 사용했다. 토큰은 메모리에서 API Authorization에만 사용하고 화면/로그/파일에 내보내지 않았다. 익명 검사는 publishable key만 사용했다. MCP SET ROLE 우회/권한 확대 없음.
- 실제 결과 **33/33 PASS**: A12/B12/anon9. 본인 카드 조회200, 상대 UUID 조회200/빈 배열, 무필터 조회도 본인1개만, 상대 직접 PATCH403·직접 INSERT403(anon401), 실제 private 스키마 접근406. 실제 JWT/HTTP 검증으로 이전 앱 UI 격리 근거를 보강한다. 모든 RPC 조합의 완전한 공격 감사는 아니다.
- Storage: 직접 생성한 단색16x16 WebP60 bytes를 관리자 대시보드로 test private bucket에 업로드하고 미리보기 색상 렌더를 확인했다. SQL로 파일 실존·크기·MIME 확인. A/B/anon 모두 목록빈배열·서명 URL 발급거부·public/authenticated 다운로드거부·업로드 및 덮어쓰기거부(HTTP400/body statusCode403). 누락 파일의404를 접근차단으로 잘못 판단하지 않도록 fixture 존재 확인 후 최종 재검사했다. 최초 schema 검사 이름 오류를 실제 private 스키마로 정정하고 최종33회 모두 재검사했다.
- 무결성: 실패한 쓰기 뒤 저장소 파일1개/60bytes, A카드DELETED/version4·B카드COMPLETE_PRIVATE/version2 유지. 개인 사용자 이미지/운영 데이터 사용 없음. 재검증용 합성 fixture는 비공개에 보존한다. source/결과/파일 해시는 [실제 HTTP 검증 증거](evidence/2026-09-25-hosted-api-storage.json)에 기록.
- Security Advisor ERROR0. INFO18(private RLS/no policies), WARN anon definer2/authenticated definer35 및 leaked-password protection1. 의도된 RPC 진입점 경고는 기존 설계와 연결되지만 전부 무해 판정하지 않는다. [RPC 경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [비밀번호 보호 설명](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Google 로그인 경로 검사와 이메일/비밀번호 보안 설정 검사는 별개다.
- reads/writes/images/minihomes=false, policy UNAPPROVED 재확인. 공개 이미지 변환·게시·철회 전달/CDN·실제 백업복구는 미검증으로 유지. Android는 이번 작업 대상 제외이지 출시 gate 자동 통과가 아니다.
- 변경: ExecPlan/진행판/증거 JSON, 임시 진단 도구만. 앱 제품 코드/DB schema/의존성/commit/push/deploy 없음. 진단 HTML은 완료 후 제거하고 탭을 닫는다. rollback은 테스트 실행 중단이며 운영 원본 변경 없음. D01 전체 완료/모든 W 완료로 승격하지 않는다.

### 2026-09-24 D01 두 실제 Google 계정 격리 및 삭제 검증

- 사용자가 승인한 B Google 계정의 직접 인증 완료 후 앱에서 B 이메일 및 동기화 성공을 확인했다. hosted 집계는 auth.users=2, Google identities=2, user_devices=3. 비밀번호/토큰을 읽거나 저장하지 않았다.
- A 합성 카드 `4bbeab73-58ee-4458-b9d0-a1c0d7b06b34`는 B 로그인·동기화 후 보이지 않았고 직접 상세 URL도 Card not found. B에서 합성 SYSTEM_DESIGN 카드 `4b44bc17-e417-4ea8-96ba-588cd392e5c7`를 작성·동기화했다. DB에서 cards=2/distinct owners=2 확인. A로 동기화 후 B 상세 URL 역시 Card not found. 이는 실제 OAuth/앱 동기화/로컬 owner 경계 증거이며 공격자가 임의 REST 필터를 만드는 검사는 아니다.
- 추가 hosted 역할 검사 시 관리 MCP 연결이 SET ROLE authenticated를 거부했다. 권한을 확대하거나 우회하지 않았으며 해당 검사 PASS로 세지 않는다. 실제 사용자 JWT의 공격 REST/Storage 검증은 잔여다.
- A 합성 카드의 앱 삭제·동기화 성공: hosted status DELETED, tombstone=true, version4. B 카드는 COMPLETE_PRIVATE/tombstone=false/version2로 보존. 삭제한 데이터는 이번 테스트에서 생성한 합성 카드이며 실제 사용자 기록/이미지는 대상이 아니다.
- B→A 재로그인에서 계정 선택 화면과 정상 callback 복귀 확인. 복원 origin은 재로그인 직후 이미 Memory 0개여서, 뒤의 재동기화는 삭제 카드 비부활 검사로 한정한다(캐시된 카드 제거 전파 증거로 과장하지 않음).
- 재동기화 완료 후 실제 Archive의 No cards saved yet를 확인했다. A 삭제 카드가 복원되지 않았고 B 카드도 A 목록에 유입되지 않았다.
- 앱 코드 추가 수정/운영 migration/배포/Public 활성화 없음. D01은 부분 검증이며 실제 공격 REST·Storage/Android·기존 사본 삭제 전파 및 D02~D06은 남아 있다.

### 2026-09-24 D01 실제 기록 복원 오류 수정 및 왕복 검증

- 기준: AGENTS/기존 시작·확정 결정·아키텍처·QA 문서 및 ExecPlan D01 상세. 실제 테스트만 승인된 범위이며 prod schema/배포/Public 변경 없음.
- 실제 흐름: 테스트 앱 127.0.0.1에서 합성 SYSTEM_DESIGN 카드 생성→Sync now→hosted memory_cards 1개 확인. 정확한 localhost callback을 추가하고 별도 origin의 빈 저장소(0개)에서 같은 Google 계정 로그인→동기화했다. 개인 사진/운영 자료는 사용하지 않았다.
- 발견: sync_changes가 PRIVATE_TITLE seq1, CARD seq2, VISUAL seq3, CARD seq4인 경우 pull의 최신 엔티티 압축으로 visual이 card보다 먼저 저장됐다. 카드의 visualAssetId가 null로 남아 Archive에서 IndexedDB DataError가 발생했다. 동기화 성공 문구만으로 복원 성공이라 판단하지 않았다.
- 수정: memorySyncStore가 카드 수신 시 기존 owner_state 인덱스의 같은 owner/current visual을 연결한다. IndexedDbMemoryRepository는 과거 누락 연결을 조회 transaction에서 복구해 읽기와 후속 수정 모두 가능하게 한다. owner 경계와 원본 bytes 유지, DB 버전/schema 변경 없음. 임시 진단 로그는 제거했다.
- 실제 검증: 복원 측 Archive 1개·동일 card UUID `4bbeab73-58ee-4458-b9d0-a1c0d7b06b34`·합성 제목/감상/시스템 디자인 확인. 복원 측 감상 수정→hosted version3/update_matches=true→원래 origin Sync now→변경 감상 표시까지 확인했다. 서로 다른 실제 기기가 아니라 같은 PC의 origin별 별도 저장소임을 구분한다.
- 자동 검증: IndexedDB Chromium 8/8(신규 순서 역전/과거 연결 복구/후속 수정), account/owner Chromium 9/9, 동기화 계약·엔진·runtime unit37/37 PASS. 최초 인덱스 선택 실수는 테스트 실패로 확인 후 기존 owner_state 사용으로 수정했다. 계정 합성 테스트를 hosted 모드에서 실행한 첫 시도는 fixture 실패(1 pass/1 fail); 합성 전용 별도 4322 서버에서 최종9 PASS. 운영 통과 근거로 사용하지 않는다.
- 웹 Google 로그인은 이전 계정 자동 선택을 피하도록 select_account prompt만 추가했다. 실제 Google 계정 선택 화면 확인. 사용자가 승인한 B 계정 로그인은 비밀번호 화면까지 준비했으며 직접 인증 대기. B/anon 실 JWT·REST 공격 검증 및 삭제 전파는 아직 완료 아님.
- 변경 파일: 위 adapter 2개, authRepo, memory-indexeddb.spec.ts, ExecPlan/진행판. rollback은 이 수정만 되돌리고 원본·서버 기록은 보존. 마이그레이션/의존성/commit/push 없음. 남은 D01 및 D02~D06 gate 유지.

### 2026-09-24 D01 실제 Google 로그인 첫 계정 검증

- 사용자가 생성·활성화한 테스트 Google OAuth client를 사용. 본서버 Google client 수정 없음. 테스트 Auth settings HTTP 응답 googleEnabled=true 확인.
- 테스트 Supabase Site URL을 `http://127.0.0.1:4321`, 허용 redirect를 정확히 `http://127.0.0.1:4321/auth/callback/`로 설정하고 저장된 UI 확인. 와일드카드/운영 callback 추가 없음.
- Windows npm 인자 전달 과정에서 `npm run dev -- --mode moemoatest ...`의 옵션이 유실됨을 발견. 해당 프로세스를 중단하고 `node node_modules/astro/astro.js dev --mode moemoatest --host 127.0.0.1 --port 4321`로 시작. 앞으로 이 PC에서는 이 직접 명령 사용.
- 실제 테스트 앱 `/data/`의 Continue with Google → callback → `/data/` 복귀 → Signed in 확인. Sync now 실행 후 Metadata sync is complete 확인. 빈 계정 동기화이며 기록의 업로드/복원 검증은 아님.
- 대상 test ref에 읽기 전용 집계 SQL로 auth.users=1, Google identities=1, user_profiles=1, user_devices=1 확인. 비밀번호/토큰/원본 개인 데이터는 증거에 기록하지 않음.
- D01은 부분 진전: 두 번째 실제 Google 사용자, A/B 데이터 격리, 기록 생성·수정·삭제·재동기화, 실제 Storage/Android 검증은 여전히 대기. 공개 기능과 운영 DB 변경 없음. 테스트 앱은 다음 검증을 위해 loopback 4321에서 실행 중.

### 2026-09-24 D01 테스트 DB 초기화 실제 결과

- Supabase 플러그인 연결 후 `moemoa-test` ref/조직/ACTIVE_HEALTHY 및 public tables=0, migration history=0을 확인하고 저장소 migration 17개를 이 테스트 프로젝트에만 적용했다. 이전 ExecPlan D01 상세 범위이며 운영 project 쓰기 없음.
- 11번째 적용에서 MCP의 초 단위 version 중복으로 transaction 실패. history와 public asset table/bucket 미존재로 rollback을 확인한 뒤 순차 재실행하여 17개 완료. MCP 생성 version은 원본 파일 timestamp와 다르므로 [bootstrap 증거](evidence/2026-09-24-hosted-test-bootstrap.json)의 원본 이름·SHA256·remote version 매핑을 유지한다. 이후 CLI db push 전 이력을 정렬해야 하며 자동 재적용하지 않는다.
- 실제 SQL 검사: public 테이블18개, RLS 미설정0, anon/authenticated private schema USAGE=false, 공개 읽기/쓰기/이미지/미니홈/팔로우/신고 모두 false, policy UNAPPROVED, Auth 사용자0. catalog bucket은 승인 표지용 public(empty), memory derivatives bucket은 private. 기존 migration의 30일 tombstone 정리 cron이 테스트에 생성됨.
- 실제 HTTP 검사5개 통과: 빈 catalog read200, 비회원 memory_cards 조회401, 닫힌 보드/미니홈 RPC 각각200/null, Auth settings200·Google=false. `.cache/check-hosted-test.mjs`와 `.cache/hosted-test-http-results.json`은 로컬 검사 자료다. 실제 로그인·A/B 격리·Storage 파일 전달 검증을 대체하지 않는다.
- Security advisor: ERROR0, INFO18(private tables deny-by-default RLS), WARN37(anon2/authenticated35 SECURITY DEFINER callable) 확인. 기존 의도된 제한 RPC이지만 이번 결과를 보안 감사 전체 통과라고 선언하지 않는다. 실제 역할별 인가 검증은 잔여. [익명 RPC 점검](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [인증 RPC 점검](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- 로컬 `.env.moemoatest.local` 생성: account/catalog 모두 테스트 URL + publishable key 사용, account sync on, Public UI flags off. git ignore 확인. 사용 명령 `npm run dev -- --mode moemoatest`; 기존 운영 env/link/배포를 덮어쓰지 않음. 아직 이 설정의 앱 실행 검증은 하지 않음.
- 변경: 진행판/증거/무시되는 테스트 env·HTTP 검사 파일. 의존성 추가 없음. migrations 원문 변경 없음. rollback은 테스트 앱 중단 및 closed flags 유지; hosted reset/drop/운영 데이터 복제 없음. 잔여: Google OAuth client 설정·허용 callback·A/B 실계정·빈 테스트 카탈로그의 합성 fixture·Storage/Android 검증. D01 및 출시 gate 유지.

### 2026-09-24 Supabase 조직 이전 및 테스트 프로젝트 생성

- 사용자 승인: 기존 MOEMOA 본서버를 새 계정의 MOEMOA 조직으로 이전하고 같은 조직에 테스트 서버를 분리. 기존 `tteumsae` 유지. 실제 이전 버튼 실행 직전 승인 및 사용자 직접 DB 비밀번호 설정·생성 완료.
- 확인한 자료: AGENTS, CODEX_START_HERE, 확정 결정, PLANS, V2 ExecPlan/진행판, 아키텍처/변경 보고 규칙, Supabase 공식 project-transfer/billing/access-control 문서, 실제 대시보드와 운영 웹.
- 운영 project `okchpyagfucpzpyrfgol` (`moemoa-preview`)를 Newrred 조직에서 MOEMOA 조직 `jdomtzpoqpyfinazdnpi`로 이전 완료. ID·Singapore 리전 유지, 새 계정 Owner/기존 계정 Developer 확인. 기존 조직에는 `tteumsae`만 남음. 복사본이 아니므로 삭제할 이전 MOEMOA 프로젝트는 없음.
- 실제 검증: `https://www.moemoa.xyz/`에서 프리렌 검색→작품 상세의 28화/스튜디오/장르 표시→표지 naturalWidth=460, complete=true, 원본 host `okchpyagfucpzpyrfgol.supabase.co` 확인. HTTP 200만으로 DB 연결 완료를 주장하지 않음. 로그인·계정 sync·쓰기/삭제는 미검증.
- 테스트 project `nmgkhknponvzcwliajyk` (`moemoa-test`) 생성 확인: Healthy, NANO, Singapore, No migrations, No repository connected. 생성 양식에서 Data API on, Automatically expose new tables off 확인. 비밀번호는 사용자 직접 생성·제출; 수집/기록하지 않음.
- 변경 파일: 이 진행판과 기존 ExecPlan의 D01 후속 계획만 갱신. 앱 환경값·운영 DB schema·Public flags·Git 배포 변경 없음. 생산 데이터 복제/삭제 없음.
- 연결 차단: 로컬 `supabase projects list --output json`은 Access token not provided로 실패. Supabase 플러그인 설치/연결 안내를 제공했으나 아직 연결 확인 전. 테스트 DB schema 적용은 실행하지 않음.
- 후속/복구: 아래 ExecPlan D01 상세에 따라 테스트 project ref를 명시하고 migrations/권한/Auth/Storage 검증. 운영 재이전은 기존 계정의 현재 Developer 권한으로 불가하므로 새 조직 Owner의 명시 승인과 접근 확인이 필요. D01 및 출시 gate 유지. 이전 증거 JSON의 문서 hash는 당시 snapshot이며 이 기록 이후 최신 문서 hash로 간주하지 않음.

| 단계 | 사용자에게 보이는 완료 결과 | 상태 | 남은 완료 조건 | 증거 |
|---|---|---|---|---|
| M0 | 현재 위치·범위·다음 작업이 명확함 | DONE | 없음; 미검증 항목은 담당 W로 연결 | 아래 기준점·25개 매핑·결정 로그 |
| M1 | 기록·계정·복원을 신뢰할 수 있음 | DOING | W03 최신 후보/보호 검증, W06의 승격·기존 캐시 삭제 전파·지원 복원 등 실제 잔여 | 로컬 기록/sync 종료 + 실제 OAuth A/B·별도 origin 왕복·API33·선택 DB 복원 근거; 전체 계약 완료 아님 |
| M2 | 선택 보드를 타인이 보고 철회할 수 있음 | DOING | 후보 전달환경/다기기 조건 | W08 retry/hosted 게시·익명 이미지 및 owner RPC 철회 PASS; 전체 C/Q 완료 아님 |
| M3 | 미니홈에서 소개하고 팔로우해 재방문함 | DOING | W13 보드→작성자 연결 및 실제 A/B 게시/팔로우/재방문 | W11~W13 로컬 근거; 기본 OAuth는 확보, 공개 관계 흐름은 별도 |
| M4 | 운영자가 조치·제한·갱신·복구함 | DOING | D03~D05 실제 정책/경보/담당/사본·승인 경로·카탈로그 게시/복구 | 로컬 운영 계약·실제 test DB 복원·합성 Storage 사본; 운영 서비스 전체 복구 아님 |
| M5 | 실제 역할·기기에서 검증한 후보가 출시됨 | DOING | W18/W19 공개 한 바퀴·지원 Web 검사·동일 RC CI·D02/D06·배포/운영 확인 | unit320/build18 인계 근거 및 과거 종합 검사; 현재 RC_VERIFIED 아님 |

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
| W03 | M1 | CI·health·빌드/SW 검증 기반 | C10 | W02 | BLOCKED_EXTERNAL | 기존 CI/health·로컬 SW 증거 유지. 최신 정확한 RC의 checks/보호·실제 경보·운영 dirty 원인만 잔여(D03/D06). 검토 브랜치 push를 PASS로 간주하지 않음 |
| W04 | M1 | 기존 기록의 취소·저장·복귀 마감 | C01,C11 | W02 | DONE | 제목/보드 dirty·QuickLog 닫기·저장 실패/경합·출발점/필터/스크롤 복귀 검증; 종료 기록 참조 |
| W05 | M1 | 계정 동기화 완료·재개 계약 | C02 | W03 로컬 검증 | DONE | 로컬 sync 계약 구현·unit269/browser26/build PASS; 실제 A/B·기기 및 서버 한도는 W06/W15/W19 |
| W06 | M1 | 계정 격리·승격·private 이미지 연동 | C01,C02,C10 | W04, W05 | DOING | 무료 private 최적화 사본·실휴대폰↔PC 연동 추가, 로컬 파일 유입3검사, private 서버 및 Web 상세 client 신규2/회귀19·unit347·PG47+병렬2 PASS. Archive/Board thumb 로컬 검증 추가. hosted/실기기·공개 연결 미완료. 실제 A/B OAuth·별도 origin 왕복·기초 REST/Storage33 확보. 승격/만료/기존 캐시 삭제 전파/지원 백업의 미실행 조건만 검증. 계정·키 없음 표시는 폐기. 72 table 복원은 일부 근거이며 기기/공개 전체 성공 아님 |
| W07 | M2 | 공개 표현·권한·철회 경계 | C03–C05 | W06 로컬 검증 | VERIFY | hosted 실제 A 게시·익명 읽기 및 소유자 RPC 철회 PASS. 운영 Public은 off. 전체 역할·갱신/기존 캐시/기기 조합은 W19 잔여 |
| W08 | M2 | private 최적화 사본 및 공개 준비·전달 | C02,C04 | W07 로컬 검증 | DOING | 원본hash 보존 private 서버 및 Web 상세 명시 전송/원격 표시·재시도 로컬 검증. Archive/Board remote thumb 및 사본별 trusted 권리 결속 공개 준비 로컬 통과. 실제 hosted/실휴대폰·운영 근거 미완료. R0925-B01 수정: 실제 같은 화면 wrong source→예약0 정리→정상 준비 PASS. hosted Storage+실제 handler 익명16x16/60bytes, 철회404. 모호한 READY/취소·중복은 로컬 검증. 운영 CDN·정책/보존·실제 fault injection 잔여 |
| W09 | M2 | 보드 미리보기·게시·방문자 읽기 | C03,C04 | W08 로컬 검증 | VERIFY | 실제 UI 선택/preview/게시 및 작성자 저장소 없는 새 origin 이미지 decode PASS. image intake fixture는 합성 adapter로 준비; Web 가져오기/Android PASS 아님. 확인창·전달 후보 환경 잔여 |
| W10 | M2 | 공개 갱신·철회·삭제·동시성 | C05 | W09 로컬 검증 | VERIFY | 로컬 다중 위치·삭제·동시성 근거 유지. 실제 전달/캐시/철회 및 stale 상태의 공개 비부활만 추가 확인. 기초 stale 복원 결과를 hosted 전체 완료로 확대하지 않음 |
| W11 | M3 | 공개 미니홈의 선택 전시 | C06 | W10 로컬 검증 | VERIFY | 실제 UI 보드 선택/닉네임/미니홈 게시 및 익명 읽기, 실제 owner RPC 철회 PASS. 대표 선택/정렬/소개·확인창 전체 조합 잔여 |
| W12 | M3 | 팔로우·해제·내 목록 | C07 | W07/W11 로컬 검증 | VERIFY | 실제 B 팔로우→내 목록→재방문·차단→해제 후 팔로우 미복원 PASS. 최종 관계 false/false. 만료·동시 기기 조합 잔여 |
| W13 | M3 | 공유 링크·로그인 복귀·재방문 | C06,C07,C11 | W11, W12 로컬 검증 | VERIFY | R0925-U01 수정·실제 보드→공개 작성자 미니홈→B 팔로우/재방문 PASS. 공개 home ID/닉네임만 전달하며 숨김 링크 null PASS. 로그인 거절/만료·공개 복귀 잔여 |
| W14 | M4 | 신고·차단·관리자 조치 | C05,C07,C08 | W10, W11, W12 로컬 검증 | VERIFY | B 실제 신고·차단/해제, A 실제 JWT HIDE/RESTORE·제한/해제, owner 제품 이의·통지, stale 거부·권한 회수 거부·감사8건 PASS. 운영 조치는 진단 버튼→기존 RPC. 정책/담당·별도 운영 역할 D04/D05 잔여 |
| W15 | M4 | 서버 한도·비용·중단 통제 | C09 | W05, W08, W12, W14 로컬 검증 | DOING | private 계정/물리량·예약/변환·준비·월 전송 한도 및 병렬 검사 로컬 PASS. 합산 원화 예산/정책 감사는 구현 잔여. 기존 서버 자원/한도 로컬 SQL 근거 유지. 실제 정상 부하·우회/429·정지 검사는 승인된 test에서 진행 가능. 운영 수치·예산·경보 수신 D03 및 보존 D05 잔여 |
| W16 | M4 | 카탈로그 후보 게시·복구 루프 | C10 | W03 로컬 검증 | BLOCKED_EXTERNAL | catalog/전환 로컬 검사 근거 유지. 실제 canonical·표지 파일·작은 후보 승인 게시→복구와 설정/담당 인계 D05/D06 잔여. 기초 DB 연결 재구축 없음 |
| W17 | M4 | 복구·정책·연락처·운영 인수인계 | C08–C10 | W06, W14, W15, W16 로컬 검증 | BLOCKED_EXTERNAL | hosted dump→선택5schema72table 로컬 복원, 합성60bytes 사본·stale fence 대조 확보. 실제 운영 이미지/canonical 사본·최신 철회 journal·보존·복구 목표·담당 D04/D05 잔여 |
| W18 | M5 | 전체 노출 화면·행동 계약 검증 | C11 | W04, W10, W13, W14, W15 로컬 검증 | VERIFY | 18 route/action·기존 Chromium 증거 재사용. W08/W13 변경과 활성 Public 화면의 성공/실패/취소/권한/복귀, 지원 Web·사람 검증만 영향 범위 확인. Android 자동 선행조건 금지 |
| W19 | M5 | 실제 역할·기기 end-to-end 검증 | C12 | W17, W18 로컬 검증 | VERIFY | hosted 공개 이미지/미니홈/팔로우·신고/차단·운영자 조치·owner RPC 철회 검증. 제품 UI 철회 취소/확인 PASS(사용자 확인창 조작 보조). 만료/복귀/후보 endpoint 조합 미완료. 별도 origin≠물리 기기, Android 제외 및 D02 유지 |
| W20 | M5 | 후보 고정·승인 배포·운영 확인 | C10,C12 | W19 | BLOCKED_EXTERNAL | bbff3d4 검토 커밋은 RC 아님. 과거 null 후보는 거부용 원본 보존. 최신 후보/CI/provenance/migration 매핑/catalog·설정·rollback·D02/D06 잔여. 앱 배포나 모든 gate 승인 없음 |

### 작업 수의 변화와 진행률

기본 20개 완료 수와 추가 필수 작업 수를 별도로 표시한다. 보류된 개선은 출시 분모에 넣지 않는다. 추가 작업이 있다고 기존에 검증한 완료 결과를 지우지 않는다. 최종 기준은 task 숫자가 아니라 M완료 계약과 필수 QA다.

## 현재 작업 카드 — 새 파일 대신 이 위치를 갱신

```text
ID / M: W06/W08 / M1·M2 — DOING (승인된 무료 private image sync 추가)
이미 동작: metadata sync·공개 동의/권리/hash/철회, hosted 공개 흐름은 과거 검증 보존.
이번 변경: default-off private HTTP·owner manifest·서버 정책/예약·전송 한도·source 삭제/정리. Web 로컬 입력은 전회 근거 보존.
이번 새 PASS: HTTP/이미지7·전체unit340·local PG40+병렬2·기존 public SQL248·build18. 원격 미적용/제품 UI 새 PASS 없음.
미완료: client 최적화/명시 선택·원격 표시·계정 전환 방어·hosted private 연결/복구·사용량 표시·실휴대폰↔PC 연동. CODE_COMPLETE_FOR_WEB_RC 아님.
다음 1개: Web 카드 화면에서 명시 선택한 사본의 최적화·private API 전송/표시 연결.
D01: 테스트 승인은 확보, 종료 flags/역할/권리 원복. 이미 받은 권한/키 재요청 금지.
D02: 첫 Web-only 후보 확정. D03~D06 운영값/담당·정책/보존·정확한 후보 승인 잔여. Android 후속 출시.
```

이 카드는 적용 시 현재 코드·증거에 맞춰 갱신한다. 이미 W08이 해결돼 있다면 중복 수정하지 않고 관련 실제 검증으로 이동한다. 긴 출력은 기존 evidence를 참조하고 진행판을 또 만들지 않는다.

## 검증 기록 방식

### 2026-09-24 W16~W20 연속 실행 기록

- 사용자 승인/범위: W 단계 종료까지 멈추지 않고 진행하라는 지시에 따라 단계별 확인 요청 없이 로컬 작업을 연결했다. 운영/Public 활성화나 D01~D06을 임의 승인한 뜻으로 해석하지 않았다. 기존 W09~W15 변경을 보존했다.
- 읽은 기준/계획: AGENTS/PLANS·시작 문서·확정 결정, V2 C10~C12/Q01~Q24, catalog/QA 운영 명세, 기존 최소 운영/DB activation/preview uploader, 복구·브라우저/native 검사 및 이전 React Doctor 진단. ExecPlan의 W16~W20 상세와 발견 기록에 파일 지도·검증·rollback을 먼저 기록했다.
- W16 구현: `20260924121214_catalog_release_transitions.sql`의 checked activation은 predecessor 비교·전역 직렬화·빈/불완전/잘못 연결된 후보 거부·같은 성공 재시도·RETIRED 복구를 제공한다. 기존 2인자 RPC 호환은 유지하되 신규 uploader는 checked RPC를 사용한다. 재개 upload는 ACTIVE를 STAGING으로 덮어쓰지 않고 같은 ID의 hash/건수 충돌을 거부한다. 기존 표지 객체 충돌 시 길이뿐 아니라 bounded GET의 SHA256을 검증한다. 신규 수집/원격 upload 없음.
- W16 검증: catalog **256 PASS, 2 Windows symlink skip**, SQL catalog **14 assertion+동시성1 PASS**. A→B→A, 같은 요청 재시도, 후보 실패 시 ACTIVE 유지, 익명/일반 계정 거부, season ID 분리·immutable cover revision/모든 release 행 보존, 경쟁 게시 충돌을 확인했다. HTTP 응답 모형으로 ACTIVE/RETIRED 재개 보존·hash/건수 실패·기존 표지의 동일 길이 손상/초과를 검사했다. 실제 Storage bytes/catalog 전체 후보는 D01/D05/D06 미검증이다.
- W17 검증/운영: 현재 합성 PostgreSQL을 pg_dump→별도 DB pg_restore하고 Memory/Board 관계·cover revision·delete fence·public card control·제재/신고/감사 행을 비공개 hash 비교했다. 복원된 설정의 Public 읽기/쓰기를 닫는 검사까지 **2 PASS**, 전체 SQL **235 PASS**. 이는 현재 snapshot 리허설이며 오래된 백업 뒤 철회나 Storage 파일 본문 복원을 입증하지 않는다. 기존 Help 연락처만 확인했고 실제 책임자/응답시간/정책을 새로 확정하지 않았다. 일반 공개 전 상태·명시 보드 선택을 도움말에 반영했다.
- W18 소스/검사: [18개 route/action 지도와 정적 진단 분류](../reports/2026-09-24-release-surface-audit.md). Library 캐릭터 선택 updater의 다른 state 변경과 null 대표 처리, 모달/이탈 ref의 render 중 갱신을 수정했다. 과거 UI/주소/권리 단계/시청 기록 영역 기대를 현재 계약으로 정정했다. image picker의 실제 pending 이탈 차단과 취소 실패 정리 재시도를 검증한다. Playwright가 Node suite를 수집하지 않도록 설정했고 서버 준비 요청에 제한 시간을 적용했다. unit **320 PASS**. 전체 브라우저 최종 결과는 아래 evidence에 남긴다.
- W18 최종 결과: Chromium 전체 **174 PASS / 3 SKIP / 실패0**, `.cache/w18-browser-confirmed.log`. skip은 외부 AniList/Wikidata live 시나리오2개와 별도 isolated runner 전용1개다. 첫 전체 실행165 PASS/8 FAIL/3 SKIP, 수정 후173 PASS/1 FAIL/3 SKIP, 남은 storage-hydration 기대 수정 후 해당 suite8 PASS 및 전체174 PASS 순서다. 중간 실패를 삭제하거나 최종 성공으로 바꿔 기록하지 않았다. 도움말320px/작성1440px 캡처를 직접 열어 확인했다. React Doctor는 재실행 점수를 만들지 않고 기존 진단의 소스를 분류했다.
- W19 최종 결과: 기존 JDK21에 Android platform36/build-tools36 설치, 연결된 `adb devices`는 0대. 웹 build/postbuild **18 pages PASS**, Capacitor sync 후 **실제 packaged 경로18 PASS**, `gradlew testDebugUnitTest assembleDebug` **성공/native31 failures0**. 마지막 APK는 `android/app/build/outputs/apk/debug/app-debug.apk`이며 local/dirty build-info를 포함하는 테스트용이다. 새 UI 수정 이후 다시 웹 빌드·패키징·APK를 만들었다. 자동 생성 assets/Gradle output은 android/.gitignore로 제외했다. 실제 사진/공유/키보드/OAuth/기기 검증 아님.
- W20 최종 결과: `check-release-candidate.mjs`의 잘못된 SHA·dirty tree·실패/미설명 skip·변조/누락 증거·외부 gate 거부 단위검사를 추가했다. [후보 점검 JSON](evidence/2026-09-24-w20-candidate.json)은 로컬 PASS를 아직 commit에 결속하지 않아 sourceCommit=null, D01~D06 PENDING, catalog hash=null로 기록하며 실행 결과 ready=false/exit2를 확인했다. 로컬 guard는 GitHub/Vercel 보호 설정을 대신하지 않는다. client bundle 제한 패턴 scan/diff 검사 PASS. 후보·설정·로그·APK 및 source hash는 [연속 검증 증거](evidence/2026-09-24-w16-w20-validation.json)에 기록한다.
- 읽기 전용 원격 확인: [기존0330a54 Service quality](https://github.com/Newrred/anime-collector/actions/runs/35886372539) 성공, [최근 catalog health](https://github.com/Newrred/anime-collector/actions/runs/35942737379)와 freshness 성공/최근11.1시간 확인. 운영 build-info commit=0330a54/source=vercel-git이나 **workingTreeDirty=true**다. 원인을 확인할 Vercel 빌드 내역 없이 정상 생성물/소스 변조 중 하나로 단정하지 않는다. 이번 소스의 원격 CI/배포 증거가 아니며 운영 설정은 수정하지 않았다.
- 보안/관측/rollback: migration은 격리 DB에만 적용, source/Storage/동의/철회/제재 이력 삭제0, private 로그 추가0, 앱 의존성 변경0. SQL 전환 장애는 이전 catalog를 checked RPC로 복구하며 표지 revision/자료를 삭제하지 않는다. 코드 rollback도 안전 이력을 역삭제하지 않는다. [복구·후보 운영 인계](../operations/2026-09-24-recovery-and-release-handoff.md) 참조.
- 남은 게이트: 실계정/기기/Storage/CDN, 실제 bytes/canonical 사본과 최신 철회 journal, 수치 예산/WAF/경보, 정책/담당자, 깨끗한 후보 SHA와 CI/승인 배포. 테스트용 모델을 실환경 성공으로 올리지 않는다. W16/W17/W19는 BLOCKED_EXTERNAL이며 운영 적용 없음.

### 2026-09-24 W15 로컬 실행 결과

- 읽은 기준: AGENTS·시작 문서·확정 결정·V2 C09·ExecPlan, 기존 sync/publication/image/moderation SQL·gateway·이미지 HTTP·SQL harness, 과거 `docs/deploy/supabase-social.sql`/`supabase-showcase.sql`. 구현 전 ExecPlan W15 상세와 발견 사항을 기록했다.
- 계획/가정: 승인되지 않은 상품 숫자를 정하지 않고 disabled 정책을 추가했다. 성공한 저장 변경량과 이미지 변환/전달 예약을 계수한다. 실패한 모든 ingress 요청의 rate limiter가 아니며, 정상 삭제를 차단하지 않는다. 삭제 fence/retained ledger 보존·압축 및 WAF·비용 경보는 D03/D05 미완료다.
- 소스 변경: additive migration의 private 정책/사용량/만료 override와 실제 행 trigger, 자기 사용량/운영 집계 RPC, 이미지 handler의 변환 전/Storage 읽기 전 RPC와 안전한 429 매핑, HTTP·SQL 권한/동시성 검사. 알려진 legacy social/showcase 직접 권한을 존재할 때만 회수하고 행을 보존한다. 진행 중 공개 쓰기와 사건 제재를 계정 잠금으로 직렬화한다.
- DB/복구: `20260924115258_memory_resource_controls.sql`은 격리 PostgreSQL에만 적용했다. 운영 절차의 `enabled=false,paused=false`로 예산을 해제할 수 있다. 삭제 fence·자료·동의·신고/감사 이력과 legacy 행은 삭제하지 않는다. 새 이미지 서버는 새 RPC migration과 같은 후보로 배포해야 한다. 신규 의존성 없음.
- 검증: Node24.19.0/npm11.17.0 unit **318 PASS**. 실제 로컬 Chromium + 합성 Auth/RPC로 publication/release-sync/account-sync/service-worker **30 PASS**. PG16.15 실제 역할·합성 Auth/Storage schema SQL **218 PASS**(새 자원 계약35, 별도 연결 동시성3 포함). 예산초과 시 저장 rollback, replay, 삭제/철회 예외, override 만료, 다른 계정/익명/서비스 경계, UTC 전환, 일일·용량 경쟁 및 제재와 진행 중 게시 경쟁을 확인했다. HTTP 검사에서 초과한 이미지 시도는 변환/쓰기 전에, 전달은 Storage 읽기 전에 막힌다.
- 빌드/실패 기록: `npm run build` **18 pages PASS**, `verifyAndroidStaticRoutes()` **dist 경로18 PASS**, client bundle 제한 패턴 scan와 `git diff --check` PASS. 기본 Android route 명령은 패키징 assets가 없어 실패했으며 APK/실기기 통과로 바꾸지 않았다. 브라우저 초기 실행은 서버 readiness 실패2회 및 첫 화면 5초 로딩 실패1회였다. 직접 시작한 개발 서버가 준비된 뒤 동일 30개 suite를 변경 없이 재실행해 통과했다. 초기 환경 시간초과 원인을 완전히 해소했다고 주장하지 않는다. 개발 서버를 종료한 뒤 최종 build를 실행했다. 기존 정적 분석 미해결은 이번에 재검사/해소하지 않았다.
- 보안/관측: 일반 사용자의 정책 변경·타인 usage 조회·직접 테이블 우회와 익명 집계 접근을 막는다. 집계에 private 본문/검색어/원본 bytes를 추가하지 않는다. image 전달 bytes는 최대 2MiB 예약량이며 실제 청구량이 아니다. 익명 페이지/catalog 요청 빈도·기존 표지 전달, 삭제 fence/retained ledger 성장은 별도 운영 통제가 필요하다. 운영 원격 객체/미등록 RPC 감사, 실제 한도/경보 담당자, Google·Storage·Android는 미검증이다.
- 상태/다음: OWNER_APPROVED는 로컬 작업 진행에 한정. W15 **BLOCKED_EXTERNAL**, W16 로컬 후보·복구 루프 **READY**. 미커밋·미배포·Public 비활성 유지. [운영 절차](../operations/2026-09-24-resource-controls.md), [source/artifact SHA256 증거](evidence/2026-09-24-w15-validation.json) 참조.

### 2026-09-24 W14 로컬 실행 결과

- 읽은 기준/소스: AGENTS·시작 문서·확정 결정·V2 C08/C09·ExecPlan, 이미지 UGC 정책, publication/minihome/relationship/image SQL, bootstrap·기존 역할 검사, owner/visitor/gateway/runtime/auth/unsaved-navigation UI. `verify-before-claiming` 기준으로 로컬 DB/브라우저 증거와 실제 운영 미검증을 분리했다.
- 계획/가정: ExecPlan W14 상세를 구현 전에 추가했다. 별도 관리자 대시보드 대신 인증된 운영자용 queue/review/audit RPC와 [운영 절차](../operations/2026-09-24-public-moderation.md)를 제공한다. 실제 담당자·외부 지원 채널·보존 기간/한도는 임의 확정하지 않았다. 차단과 신고는 독립이며 제한된 계정도 자기 철회·신고·이의제기가 가능하다.
- IMPLEMENTED YES: `MemorySafety.jsx`의 신고 양식·접수 확인·내 알림·이의제기를 public board/home와 내 미니홈에 연결했다. 중복 submit 잠금, payload 변경 전까지 operation 유지, 세션 재확인/계정 remount/취소/20초 요청 제한, 실패 시 입력 유지, 미저장 이탈 보호를 적용했다. 원문 서버 오류는 표시하지 않는다. 운영 알림은 공개 대상 링크·조치·소유자용 사유만 전달한다.
- DB/보안: `20260923213901_memory_moderation.sql`은 server-only moderator allowlist, private reports/notices/audit/target version/case sanctions를 추가한다. 일반 계정·익명·metadata로 승격 불가. 신고 flag 기본 off, 일일 한도 기본 0; 사용자 잠금으로 병렬 한도 초과 방지. 사건/대상 revision으로 다른 운영자·다른 사건·이의제기와 충돌하는 변경 거부. HIDE/RESTORE는 공개 동의와 private 원본을 바꾸지 않는다. 사건별 계정 제한은 기존 flag와 독립이며 다른 사건 해제에 영향받지 않는다. 신고자 계정 삭제는 익명화한 사건/감사를 남겨 계정 삭제 자체를 막지 않는다.
- AUTO_TESTED PASS: `npm run test:unit` **317**, `node scripts/run-e2e.mjs tests/publication-ui.spec.ts tests/memory-board.spec.ts tests/service-worker.spec.ts --project=chromium --workers=1 --reporter=line --max-failures=1` **24**. 실제 로컬 Chromium + 합성 Auth/RPC로 신고 취소·취소 거절·실패 재시도 operation 유지·접수·인앱 알림·이의제기·로그아웃 격리 및 기존 공유/관계/보드/SW 회귀를 확인했다. 320px 알림 캡처를 열어 확인했다.
- SQL PASS: PostgreSQL16.15 합성 Auth/Storage 역할 harness 전체 **180 PASS**, 신규 moderation **34 + 실제 두 연결의 동시성 2**. 일반/익명 권한, 직접 테이블/자기 승격 차단, 계정 격리, 신고 중복·한도, 가림/동의 유지 복원/철회 후 재공개 금지, 소유자 이의제기·오래된 revision 거부, 다른 사건 sanction 유지, 실제 publication RPC 및 이미지 준비 완료 차단, 감사, 신고자 삭제를 확인했다. `npm run build`/postbuild **18페이지**, Android dist route **18개**, diff/bundle 검사 PASS. 증거: `evidence/2026-09-24-w14-validation.json`, `.cache/w14-*`.
- 데이터/권리/관찰/롤백: 새 이미지 업로드·분석 이벤트·private 원본 읽기 없음. 신고 설명은 명시 입력한 내용만 private 사건에 보관하며 알림에 신고자 신원을 전달하지 않는다. 롤백은 reports flag off/client 복원; 안전 가림·제재·감사 자료를 역삭제하지 않는다. API 호출/이미지 전달 실환경·retention 배치는 수행하지 않았다. 보존/익명화 상세 정책은 D05에 남는다.
- REAL_ENV_VERIFIED BLOCKED: 실제 Supabase/PostgREST/Google A·B·운영자, Storage/CDN 전달 차단, Android APK/기기, 실제 운영 담당자/지원 채널·보존/정책 미확인. 원격 계정 권한을 부여하거나 운영 DB를 적용하지 않았다. 기존 정적 분석 미해결도 이번에 해소했다고 하지 않는다. OWNER_APPROVED: 로컬 진행 승인만 적용; 미커밋·미배포·Public 비활성 유지. W14는 외부 게이트 대기, 다음 W15 READY.

### 2026-09-24 W13 로컬 실행 결과

- 기준/읽은 파일: AGENTS·시작 문서·확정 결정·V2 C06/C07/C11와 ExecPlan, 기존 owner/visitor·관계 UI, authRepo·webOAuth/nativeOAuth·AuthCallbackClient·BaseLayout, native navigation/route manifest와 기존 검사. ExecPlan W13 상세에 범위/검증/롤백을 먼저 기록했다.
- 가정/발견: 공유는 공개 UUID와 명시 경로만 포함한다. Android에서 외부에 전달하는 주소는 기존 운영 웹 `https://www.moemoa.xyz`이며 앱 내부 방문은 packaged index.html을 사용한다. 검증된 App Links 자동 앱 실행을 새로 제공한다는 뜻은 아니다. 초기 소스에는 복사 버튼·로그인 실패 후 원래 페이지 복귀가 없었고 native OAuth가 directory URL로 이동했다.
- IMPLEMENTED YES: `publicShareLink.js`와 `PublicLinkCopy.jsx`를 공개 보드/미니홈 owner 및 visitor에 연결했다. clipboard 성공 안내와 실패 시 선택 가능한 44px 입력칸을 제공하며 private query/hash는 복제하지 않는다. owner 방문 링크는 앱 내부 이동으로 통일했다. `AuthCallbackClient.jsx`는 원래 안전한 페이지 복귀·다시 로그인, callback 주소에서 provider 정보 제거, 실제 session 없는 교환 결과 거부를 처리한다. `webOAuth.js`는 외부 host·credentials·callback 재진입·토큰 포함/과도한 next를 거부한다. `nativeOAuth.js`는 로그인 완료 시 packaged 경로로 이동한다.
- 검증: unit **317 PASS**, 새 share-link/공격 next 계약 및 기존 native cold/warm callback 경로 검사 포함. Chromium 실제 로컬 UI + 합성 Auth/RPC로 보드/미니홈 복사, clipboard 거부, 취소·교환 실패·시작 실패 복구, 성공 교환 1회와 자동 팔로우 없음, 기존 관계·보드·SW·서비스 마감 회귀를 실행했다. provider 교환 성공/실패는 테스트에서 Supabase client 모듈 응답을 대체했으며 실제 Google 계정 인증으로 간주하지 않는다. 320px 직접 복사 화면을 캡처해 열어 확인했다. 최종 실행 수/빌드/해시는 `evidence/2026-09-24-w13-validation.json`과 `.cache/w13-*`에 기록한다.
- 데이터/롤백: DB migration·의존성·환경값 변경 없음. W13 client 변경을 복원하면 되며 관계/공개 상태/원본 데이터는 건드리지 않는다. 보안/개인정보/관찰: 링크에 공개 ID만 포함하고 callback 토큰/오류·provider 원문을 사용자 메시지/새 분석 이벤트로 전송하지 않는다. 기존 bounded 오류 코드 로깅만 유지한다. 공개 이미지 자동 업로드 없음.
- REAL_ENV_VERIFIED BLOCKED: 실제 Google/Supabase PKCE, Android APK/실기기 및 외부 링크의 기기별 동작은 D01/W19. 기존 정적 분석 미해결과 운영/CI 검증은 이번에 해소했다고 하지 않는다. OWNER_APPROVED: 로컬 다음 단계 승인만 적용; commit/push/배포/운영 Public 활성화 없음. W13은 외부 검증 대기이며 다음 W14는 신고·운영자 조치 로컬 구현, 실제 운영 담당자/정책/통지 채널은 D04에 남긴다.

### 2026-09-24 W12 로컬 실행 결과

- 읽은 기준/소스: `AGENTS.md`, `CODEX_START_HERE.md`, 확정 결정, `PLANS.md`, V2 ExecPlan/C07/진행판, W11 미니홈 SQL·gateway/runtime·owner/visitor, `useAuthSession`, `webOAuth`, `authRepo`, legacy profileRepo/social gate, 기존 SQL 및 브라우저 harness. `verify-before-claiming` 기준으로 실제 검사와 외부 미검증을 분리했다.
- 가정/계획: 승인된 C07과 ExecPlan의 W12 실행 상세. 전체 공개 관계 그래프·뉴스피드·DM은 범위 밖이다. 로그인은 기존 안전한 내부 next 주소 처리에 연결하며 자동 팔로우하지 않는다. 실제 OAuth 제공자 복귀는 W13/D01/W19에서 확인한다.
- IMPLEMENTED YES: `MemoryRelationships.jsx`를 `PublicMinihome.jsx`와 `MemoryMinihome.jsx`에 연결했다. 공개 홈에서 팔로우·해제, 내 목록 재방문·페이지 추가, 차단 목록·해제, 재시도, 계정별 remount/AbortSignal/세션 검사와 20초 제한. 비공개·제한 대상은 사유와 닉네임을 숨기고 해제할 수 있다. 삭제 계정 관계는 FK cascade로 제거된다. 차단해도 익명 공개 열람은 가능하며 해제 후 자동 복구하지 않음을 안내한다.
- DB/롤백: additive `20260923192300_memory_relationships.sql`, RLS private table + authenticated 전용 get/set/list RPC. auth.uid만 소유자를 결정하며 public home UUID 외 계정 ID/사유는 반환하지 않는다. 새 follows flag는 기본 off, 쓰기 제한과 공개 reader를 재사용한다. 팔로우와 반대 방향 차단은 정렬된 사용자 쌍의 트랜잭션 잠금으로 직렬화한다. 중단 중에도 해제/차단 RPC는 가능하다. 롤백은 flag off 및 클라이언트 복원; 관계/차단 기록·private 원본을 파괴하지 않는다. 운영 DB 적용 없음.
- AUTO_TESTED PASS: Node24.19.0/npm11.17.0에서 `npm run test:unit` **315개**, `node scripts/run-e2e.mjs tests/publication-ui.spec.ts tests/memory-board.spec.ts tests/service-worker.spec.ts --project=chromium --workers=1 --reporter=line --max-failures=1` **20개**. 실제 로컬 Chromium + 합성 Auth/RPC로 팔로우→내 목록→재방문→차단→해제, 로그아웃 시 목록 제거, 비회원 관계 요청/자동 팔로우 없음, 기존 공개/보드/SW 회귀를 확인했다. 320px 캡처를 열어 가로 넘침 없는 빈 목록을 확인했다. 첫 회귀 실행은 기존 RPC mock이 새 목록 응답을 제공하지 않아 실패했으며, mock 계약 추가 후 최종 전체 통과했다.
- SQL PASS: WSL PostgreSQL16.15 합성 역할 harness 전체 **144개 PASS**, 그중 신규 관계 **22개 + 동시성 1개**. 중복·본인 금지·직접 table/익명 권한 거부·B/A 목록 격리·차단 양방향 제거·차단 해제 무복구·불가 대상 해제·kill switch 중 해제·실제 두 연결의 block/follow 경합을 확인했다. `npm run build`/postbuild **18페이지 PASS**. 증거: `evidence/2026-09-24-w12-validation.json`, `.cache/w12-*` 로그/캡처.
- 보안/개인정보/권리/관찰: 팔로우는 private 자료 권한을 부여하지 않고 새 이미지 업로드나 분석 이벤트를 추가하지 않는다. 관계 RPC는 no-store이며 응답 오류의 원문을 UI에 노출하지 않는다. 기존 legacy `user_follows`는 재사용·재개하지 않았다. 원격 legacy schema/REST 권한 감사는 D01/W15에서 별도로 필요하다.
- REAL_ENV_VERIFIED BLOCKED: 원격 Supabase/PostgREST/A·B 계정, 실제 OAuth, Storage, Android APK/기기 미검증. 기존 정적 분석 미해결은 이번에 재실행·해소한 것으로 간주하지 않는다. 요청별 quota/차단 남용 제한은 W15/D03, 신고 통로와 관리자 조치는 W14/D04의 출시 필수 게이트다. OWNER_APPROVED: 로컬 다음 단계 진행 승인만 적용. commit/push/배포/Public 활성화 없음. W12는 외부 게이트 대기, 다음 로컬 W13 READY.

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
| R0925-B01 | [모형 재현](evidence/pro-review-bbff3d4-2026-09-25/upload-retry-result.json): 확정 실패 후 같은 operation 거절 / C04,Q10 | 현재 W에 흡수 | 실패/불확실 완료 분리, 같은 화면 회복·중복/원본/예약량 검증 | W08,W09 | W09/W19 실제 공개 검증 | FIXED — 로컬 재현 후 수정, hosted 같은 화면 재시도·예약/원본 보존 PASS |
| R0925-U01 | [검토서](evidence/pro-review-bbff3d4-2026-09-25/review.md) §5: 공유 보드→공개 작성자 연결 부재 / C06,C07,Q04,Q16 | 현재 W에 흡수 | 안전한 공개 home 링크; 없음/가림/철회 시 생략; 자동 follow 금지 | W13 | W19 공개 재방문 검증 | FIXED — SQL/DTO/UI 및 hosted 보드→home→follow/revisit PASS |
| R0925-O01 | 같은 검토서 §5: private.memory_public_image_rights의 승인 경로 필요 / C04,C08 | 외부차단 D | 기존 asset/version별 승인·철회 경로를 실제 담당·test 권한에 연결; 검사 제거 금지 | D04,W08,W14 | W09/Q09 공개 이미지 전달 | TEST VERIFIED / 운영 D04 잔여 — 합성1자산 버전 승인/철회, 실제 담당 정책 미확정 |

허용 분류: `현재 W에 흡수 / 필수 형제 W / 외부차단 D / PARKING`.
차단 요청은 필요한 권한·파일·결정의 정확한 범위와, 그것 없이 완료할 수 없는 테스트를 적는다. 보안 문제를 재현하기 위해 운영에 위해를 주지 않는다.

## 사용자/운영자 결정 대기열

| ID | 필요한 결정 | 상태 | 현재 기본안/대기 중 행동 | 마지막 필요 시점 | 실제 승인/증거 |
|---|---|---|---|---|---|
| D01 | 격리 환경·테스트 계정/Storage 권한·비밀값 경로 | PROVIDED / PUBLIC_FLOW_PARTIAL_VERIFIED | 테스트 한정 임시 활성/합성 권리/A 운영자 사용자 승인 확보. 실제 공개 흐름 실행 후 flags/한도/정책/역할 원복; 키·기초 환경 재요청 금지 | hosted 만료·후보 전달환경의 남은 조합만; 다중카드/동시성/정책·권리 및 image quota 실제 증거 확보 | [이번 실행 증거](evidence/2026-09-25-review-apply-public-flow.json); 운영 Public 승인 아님 |
| D02 | 최종 배포 채널/순서 | VERIFIED — 첫 후보 WEB_ONLY | 사용자 9/25 확정. Android는 Web 출시·개선 후 후속; 코드 보존/첫 후보 NOT_APPLICABLE. Web 검사·D03~D06 유지 | 최종 후보에 승인 evidence·HEAD 결속 필요 | evidence/2026-09-25-d02-web-only.json / RELEASE-CHANNEL-WEB-FIRST-01 |
| D03 | 예산·정상 규모·quota·경보 | INPUT_PARTIAL / TEST_MEASURED | FREE-PRIVATE-IMAGE-SYNC-01: MOEMOA 추가 운영비 월50,000원 목표(기존 Vercel 기본료·도메인·홍보 제외, 초과료/세금/백업 포함). 50MB/1MB는 후보. 실제 공급자 청구·사용량·전송/전역 한도·비상 차단/경보 미완료. 과거 $25 입력은 이력 보존 | 유료/공급자 변경 미승인 | 최상위 Decision Log 및 evidence/storage-closeout-source-2026-09-25/ |
| D04 | 운영주체/정책/권리·연령/지원 | INPUT_PARTIAL / TEST_ROLE_VERIFIED | 개인 운영 sinong, 공개 지원 godburgundy@gmail.com. 본인 신고·삭제 대응 하루2~3회. 한국·동남아 우선(국가 미특정). 연령/공개 이미지 범위는 추천 요청·미승인. 사본별 trusted 공개 권리 결속 방식9/26 승인·로컬 검증. 실제 담당/권리 근거·private 안내·연령/이미지 정책 잔여 | 운영 정책 확정 전 | evidence/2026-09-25-operations-inputs.json |
| D05 | 공개 철회 지연·보존/복구 목표·사본 | PROPOSAL_PENDING / PARTIAL_VERIFIED | 72table/합성 복원 과거 증거 유지. 매일 암호화 사본·7일 보관·RPO24h/RTO48h는 제안만. 새 private 사본/manifest·운영 Storage/canonical/철회 journal·자동 백업 위치·실제 복구 검증 필요 | 백업 약속 승인 전 | evidence/2026-09-25-operations-inputs.json |
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
| Q01 | LOCAL PASS + 실제 일부 / PRIVATE SYNC 미완료 | Web/동일 계정 별도 origin의 합성 카드 복원·수정 | 기존 tests + 9/24 실제 기록 왕복 로그 | 동일 RC의 해당 기능 회귀; Android 이번 실행 제외, D02 후보 구분 |
| Q02 | LOCAL PASS | Web 기존 편집 흐름 | release-editing/service-finishing | 지원 Web의 미실행 입력/키보드 조건; Android 이번 실행 제외 |
| Q03 | LOCAL PASS + 실제 일부 | 실제 A/B 분리·기록 왕복 | memory-account-sync/owner-boundary + 9/24 최신 로그 | 지연/중복/전환의 실제 미실행 조합과 최신 영향 회귀 |
| Q04 | LOCAL PASS / HOSTED PARTIAL PASS | 실제 보드→작성자 home→B 팔로우/내목록 재방문 | public-flow JSON, auth-return JSON | 실제 만료/거절 후 공개 복귀·최종 후보 경로 |
| Q05 | LOCAL PASS + 실제 일부 | 과거 Google A/B 성공. 9/25 실제 SDK+합성 Auth 만료 refresh 거절→PKCE 복귀·자동 follow0 | w19-auth-return JSON, Chromium3 PASS. 실제 계정 만료와 구분 | hosted 만료/거절 및 승격 preview·취소의 해당 미실행 조건. A/B 없음 아님 |
| Q06 | LOCAL PASS + 실제 일부 | 소량 기록 복원·수정·삭제 비부활 | release-sync + 실제 왕복 로그 | hosted 큰 배치·page/cursor·기존 캐시 삭제 전파 등 미실행 경계 |
| Q07 | LOCAL ROLE PASS + HOSTED BASIC PASS | 실제 JWT HTTP/Storage A12/B12/anon9 | evidence/2026-09-25-hosted-api-storage.json | 실제 public 일부와 moderator 회수 거부 검증. 나머지 RPC/공격 조합은 잔여 |
| Q08 | LOCAL PASS / HOSTED PARTIAL PASS | 실제 합성1카드 명시 선택·미동의 기본 필드 제외 게시 | public-flow JSON + 기존 publication-ui/SQL | private 다수 중 미선택 자료 전체 비노출의 hosted 비교 |
| Q09 | HOSTED PARTIAL PASS | 실제 Storage+loopback 제품 handler, 새 익명 origin | 9/25 public-flow JSON: WebP16x16/60bytes·no-store·철회404 | 후보 Vercel/CDN·복수 위치/기기 (제품 UI 철회는 w19-withdrawal-ui JSON PASS) |
| Q10 | LOCAL PASS / HOSTED PARTIAL PASS / PRIVATE SYNC 미완료 | 과거 공개 wrong-source 복구 보존. 신규 private HTTP7/PG40+병렬2에서 용량·해시·응답유실/만료·삭제 정산 검증 | 2026-09-26-private-image-server-boundary.json 및 과거 public-flow JSON | 실제 private hosted/client 연결·교체/복구·후보 전달 환경 |
| Q11 | LOCAL PASS / HOSTED PARTIAL PASS | 원본 title/version 변경 후 PREVIEW_CHANGED; 새 prepare 후 구 revision CONFLICT; 실패 전후 anon hash 동일; 최신 검토만 게시 성공; 동시 동일 operation revision1회/서로 다른 operation 하나 충돌; policy 변경 CONSENT_MISMATCH/새 동의 성공; 이미지 권리 철회 게시거부/이미지404 | w19-preview-consent / w19-concurrent-publish / w19-policy-consent / w19-rights-quota JSON + 기존 SQL races | 최종 후보 결속·진단 RPC와 제품 UI 조합 구분 |
| Q12 | LOCAL PASS / HOSTED PARTIAL PASS | 보드 철회→home 전시0, 동일 카드 보드2개 전시·정리·원본 보존 | withdrawal-ui/minihome-edit JSON | 다중 공개 위치 중 하나/전체 철회의 hosted 경계 비교 |
| Q13 | LOCAL PASS / HOSTED PARTIAL PASS | 실제 Storage+local handler 직접 URL200→404/no-store, 익명 UI unavailable | withdrawal-ui/public-flow JSON | 정확한 후보 CDN/SW·기존 캐시·철회 지연 |
| Q14 | LOCAL PASS / HOSTED 일부 | stale local 복원+최신 fence2회, hosted 삭제 비부활 일부 | local-stale-recovery JSON + 실제 삭제 로그 | 운영 최신 journal 사본/복원 인계, 실제 관리 차단·기존 캐시 삭제 전파 |
| Q15 | LOCAL PASS / HOSTED PARTIAL PASS | 대표 선택 저장·B,A→A,B 정렬·소개 재게시·익명 이미지2개 decode PASS | w19-minihome-edit JSON | 대표 제외·제품 home 비공개/보드2 유지 PASS; 최종 후보 지원 Web/기기 조합 잔여 |
| Q16 | LOCAL PASS / HOSTED PARTIAL PASS | 실제 A/B 보드→작성자→팔로우→목록 재방문 | public-flow JSON + author DTO/SQL/UI 회귀 | 만료/로그인 거절·공개 복귀/다기기 조합 |
| Q17 | LOCAL PASS / HOSTED PARTIAL PASS | B 신고·차단/해제, A moderator live HIDE/RESTORE·통지/감사 | public-flow JSON; owner 철회 뒤 RESTORE로 부활하지 않음 | 이의·공개 쓰기 제한/해제는 Q18 PASS. 삭제/기기 조합 및 운영 담당 인수 잔여 |
| Q18 | LOCAL PASS / HOSTED PARTIAL PASS | 실제 JWT 운영 RPC 제한/해제, owner 제품 이의·통지, stale 거부·권한 회수 거부 | w19-appeal-restriction JSON | 운영자=owner인 승인 A 테스트; 실제 별도 담당자/지원채널·정책/SLA D04 |
| Q19 | LOCAL PASS / HOSTED PARTIAL | 실제 handler 병렬 image 준비 성공1/QUOTA1, DB active1/정리0. hosted rollback-only daily/override만료/정지 PASS | w19-rights-quota / w19-current-regression JSON + W15 기존 evidence | 실제 HTTP429·경보 수신/담당 및 D03 운영 수치·예산·후보 결속 |
| Q20 | PARTIAL_VERIFIED | hosted dump→선택5schema72table 로컬 복원·합성60bytes 사본 | hosted-db-recovery/server-connection/local-stale-recovery JSON | 운영 공개 이미지/canonical 실제 사본·최신 journal·지원 JSON 잔여·RPO/RTO; 플랫폼 전체 복원 아님 |
| Q21 | LOCAL PARTIAL | catalog256·전환/rollback SQL | W16 validation JSON | 실제 canonical/bytes 후보 검증·승인 게시→복구/health |
| Q22 | LOCAL PARTIAL | 기존 운영 SHA 관찰만 | 기존 CI/health + 0330a54 제공 기록 | 최신 RC checks/배포 보호·dirty 원인·실제 경보. 이번 재조회 아님 |
| Q23 | LOCAL PASS | 로컬 실제 SW·저장소 | service-worker/index | 최종 운영 후보 업데이트/롤백과 공개 캐시 경계 |
| Q24 | LOCAL PARTIAL | 18 route 지도·과거 Chromium/캡처 | surface audit/당시 browser log | 실휴대폰 Web→PC private 이미지 연동/품질 및 최신 공개/수정 경로의 지원 Web·스크린리더·사람 이해. Android 이번 실행 제외; 최종 후보 D02 |

## route/action coverage 증거 위치

- 현재 route inventory: 현재 `src/pages` 18개 경로. 위 15개 기준점은 과거 기록이다.
- 역할·flag·상태별 action→handler/API→결과·취소·실패·복귀 지도: [W18 surface audit](../reports/2026-09-24-release-surface-audit.md).
- UI evidence: W18 Chromium 로그, `.cache/w18-help-320.png`, `.cache/w18-composer-1440.png` 직접 열어 확인. 200% 검사는 320 CSS-pixel reflow 대리 검사이며 실제 OS/browser zoom 모든 조합이나 실기기 검증이 아니다.
- 위 LOCAL/MOCK는 실계정·실기기 PASS가 아니다. 근거는 연속 실행 evidence 및 각 test source에 연결하며 이전 HEAD를 미커밋 후보 SHA로 사용하지 않는다.
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

### 2026-09-24 · W09 종료 기록 — BLOCKED_EXTERNAL (공개 UI 로컬 검증 통과)

- 기준: AGENTS/CODEX_START_HERE/확정 결정/PLANS, 제품·이미지·구조·QA·변경통제 명세, V2 ExecPlan/C03·C04/진행판, Title Hub UI 규칙을 확인했다. 기존 W07 gateway·SQL, W08 이미지 endpoint/helper·SQL, Board/visual/owner/auth/runtime·SW·테스트를 실제 코드로 대조했다. 계획은 01의 W09 실행 상세에 구현 전에 추가했다. 시작 HEAD `0330a54`, 작업 전 clean.
- IMPLEMENTED YES: `MemoryBoardView.jsx`의 기존 갤러리에 `MemoryPublicationPanel.jsx`를 추가했다. 공개 제목/설명은 빈 값으로 시작하고 카드·6개 선택 필드는 기본 미선택. 같은 작품 카드는 기존 visual·감상·날짜와 순번으로 구분한다. 서버에는 선택한 ID/필드와 사용자가 입력한 공개 제목/설명만 전달한다. 계정 owner·Board/카드/관계/asset의 동기화 확인 없이 준비/게시하지 않는다.
- 공개 흐름: `createPublicationController.js`가 현재 revision 조회→prepare DTO→명시 동의→publish를 직렬화한다. prepare 취소·계정 전환·unmount 뒤 응답은 버리고 다음 prepare에서 서버 revision을 재조회한다. 게시 응답 유실은 동일 operation/hash/revision으로 재시도하며 검토 후 source 변경·정책/서버 충돌 시 preview를 폐기한다. 요청 제한시간20초. 게시/철회 요청을 보낸 뒤 취소 성공으로 표시하지 않는다. 보드 철회는 다른 공개 위치가 남을 수 있음을 안내하고 원본을 유지한다.
- 방문자: `/public/board/?id=<publication UUID>`는 계정/IndexedDB에 의존하지 않는 익명 RPC reader를 사용한다. `publicationView.js`가 허용된 DTO 필드만 복사하고 `PublicBoardSnapshot.jsx` 하나를 preview/visitor에서 공유한다. approved cover revision·기존 디자인 token·서버 이미지 URL을 사용하며 private localRef/원본 ID/seed를 방문자 렌더러에 전달하지 않는다. 실제 이미지 로드 실패는 표시하고 게시를 막는다. 비공개/철회는 unavailable, 네트워크 실패는 retry 가능한 오류로 구분한다. 페이지 재방문·탭 복귀 때 재조회하고 메모리 Blob URL은 cleanup한다.
- 이미지: 사용자 파일은 선택 카드에서 원본 파일을 다시 제공하고 별도 업로드 동의한 때만 기존 W08 helper로 전송한다. 서버 checksum/권리 승인/한도를 우회하지 않고 self-claim으로 승인하지 않는다. 인증 preview는 no-store Blob, visitor는 publication/asset/variant URL이다. 취소는 업로드 완료 사본의 즉시 삭제를 보장하지 않으며 기존 비공개 staging 정리 계약을 따른다. native 원본 자동 읽기는 연결하지 않았다(W19).
- flags/환경: `PUBLIC_MEMORY_PUBLICATION_V1=1`일 때만 새 UI/reader가 준비되며 기본 off. writer에는 기존 account sync와 Auth 설정이 필요하다. `PUBLIC_MEMORY_PUBLICATION_POLICY_REVISION`은 이미지 준비 동의를 위한 공개 정책 revision이며 서버 설정과 같아야 한다. 없으면 업로드를 막고 서버가 최종 판정한다. 운영/로컬 env 파일에는 이 값을 설정하지 않았다. 합성 브라우저 adapter는 DEV에서만 사용하며 최종 dist에서 해당 식별자 부재를 확인했다.
- AUTO_TESTED PASS: Node24.19.0/npm11.17.0, `npm run test:unit` 306/306(신규 controller/DTO10). `node scripts/run-e2e.mjs tests/publication-ui.spec.ts tests/memory-board.spec.ts --project=chromium --workers=1 --reporter=line --max-failures=1` 11/11(신규8+기존Board3). 실제 로컬 Chromium/IndexedDB에서 선택→게시→새 비로그인 context→철회, 취소 후 늦은 응답, 동일 게시 재시도, stale 재검토/재동의, 세션 전환, 동의 전 업로드0, 실제 파일 bytes/인증 preview/방문자 이미지 decode, 이미지 실패/재시도, 320px/한영을 검증했다. 320px full-page capture를 직접 확인했다. Auth/게시 RPC/Storage 응답은 명시한 합성이므로 실제 서버 권한 증거는 아니다.
- AUTO_TESTED PASS: `npm run build` 16 pages+postbuild. 새 public route를 Android static manifest에 추가하고 `verifyAndroidStaticRoutes()`로 dist16개와 기존 native composer 연결을 확인했다. 새 주소의 index.html 매핑은 단위 검사에서 검증했다. APK assets는 생성하지 않았으므로 packaged 경로 검사/실기기는 미검증. dist에서 W09 mock adapter 및 privileged server 설정 문자열 미포함, git diff --check PASS. package/lock/env/SQL 변경0. 기존 quality CI의 Chromium 실행 목록에도 신규 publication-ui 검사를 추가했으며 원격 실행은 아직 하지 않았다.
- 검사 중 수정: 최초 신규 브라우저 fixture의 메뉴 문구 불일치를 실제 Board 도구 selector로 수정. public route 추가에 따른 기존 manifest 기대값15→16을 갱신했다. build와 브라우저 서버를 동시에 돌린 실행에서 기존 Composer가 빈 화면으로 timeout한 1건은 원인 확정하지 않았으며, 서로 분리한 최종11개 재실행은 PASS. 오래된 미설치 npx 경로 대신 실제 설치된 React Doctor0.9.14 경로로 실행했다.
- React Doctor0.9.14: 전체39/100, errors21/warnings125로 전체 PASS 아님. 신규 파일 error0. 남은 신규 warning6 중 controller/selection UI 복잡도1은 유지보수 항목, async 상태/Blob revoke2는 AbortSignal 확인·effect cleanup의 revoke 루프를 소스/브라우저 테스트로 확인한 정적 탐지 한계, readiness callback3은 실제 이미지 로드가 게시 버튼을 제어하기 위한 의도적 상태 전달(경고 3종)이다. 규칙 억제/설정 변경 없음. 전체 error 경로는 변경하지 않은 기존 코드·SQL·package다. schema RLS는 후속 security migration에 존재하고 image-contract의 넓은 정책은 restrictive policy 우회 방지 시험용이다. dependency advisory와 기존 React 오류는 W18 검토에 남기며 이번 작업에서 업그레이드하거나 전체 안전을 주장하지 않는다. 이전 도구 점수49와 버전/규칙이 달라 직접 회귀 비교하지 않는다.
- REAL_ENV_VERIFIED BLOCKED: 실제 Supabase17/Auth UID/PostgREST/Storage/서버 policy·권리 승인/원격 Vercel headers·CDN·Android 미검증. DB/Storage 테스트 환경 D01 미제공, 새 PC psql 없음, Docker engine 비실행. SQL 변경이 없어 기존 W07/W08 SQL 계약은 재실행하지 않았다. 정책/보존/운영값 D03~D06 및 W19 gate 유지.
- 보안/개인정보/관찰: Public 기본 off 유지. 사용자 입력을 React text로 렌더하고 upstream 오류 원문은 화면/로그로 내보내지 않는다. 신규 analytics/개인 note·파일 로그 없음. 테스트는 합성 계정/파일만 사용했다. 선택하지 않은 사용자 사진 업로드·운영 DB 접근·migration·Public 활성화·commit/push/배포0.
- rollback: 이번 W09 파일·Board 진입점·static route manifest·관련 tests/docs만 이전 Git 기준으로 복원. 서버/원본/철회 이력 변경이 없으므로 DB 복구 불필요. package/lock 변경 없음.
- 증거: [W09 검증·파일 hash](evidence/2026-09-24-w09-validation.json), `E:/web/anime/.cache/w09-{unit-final,browser-final,build-final,react-doctor-final}.log`, `.cache/w09-preview-320.png`.
- 선택/변경: W10 선행은 W09 전체→W09 로컬 검증으로 한정. 실제 환경 gate를 지우지 않으며 W09는 DONE에 세지 않는다. 완료 M1/6, W4/20, 추가 필수0 유지. 다음 W10 READY. 현재 M2 잔여는 C05 통합과 실제 사용자/이미지/철회 검증이다.

### 2026-09-24 · W10 종료 기록 — BLOCKED_EXTERNAL (로컬 갱신·철회·삭제·동시성 검증 통과)

- 기준/계획: AGENTS/CODEX_START_HERE/확정 결정/PLANS, 기존 제품·이미지·구조·QA·변경통제 명세, V2 ExecPlan/C05와 진행판을 따랐다. W07/W08 SQL·gateway·이미지 전달, W09 controller/panel/visitor, private 삭제 command/runtime/detail, IndexedDB sync·SW·기존 테스트를 읽었다. 구현 전에 기존 ExecPlan W10 범위를 갱신했다. W09 미커밋 변경을 보존했으며 HEAD는 `0330a54` 그대로다.
- IMPLEMENTED YES: 공개본의 source version을 server-private column에 보존하고 owner RPC에 `hasPublished/sourceChanged`만 추가했다. 공개본과 다른 원본/미확인 버전은 재검토를 안내한다. 갱신 미리보기 중 기존 공개본·주소를 유지하며 취소/실패로 자동 교체하지 않는다. 새 동의 후에만 갱신한다. 보드 선택 목록과 카드 상세에 모든 위치의 공개 중지와 영향 설명을 연결했다. 원본은 보존하며 기존 영구 revoke를 일반 재게시로 해제하지 않는다.
- 발견/수정: (1) 기존 로컬 삭제는 서버 sync 전 공개본을 남길 수 있었다. `deleteMemoryCard` 이전에 플랫폼 adapter가 서버 retire 확인을 요구하고, 실패 시 로컬 bytes/metadata 삭제 없이 KO/EN 재시도 안내를 보인다. (2) 로컬 remoteVersion=0도 서버 응답 유실 상태일 수 있어 모든 계정 카드에 owner-scoped 삭제 fence를 기록한다. 늦은 최초 sync/복원에도 reader/prepare가 접근을 거부한다. Guest 오프라인 삭제는 유지한다. (3) global revoke 뒤 과거 publish operation 재시도가 PUBLISHED를 반환하던 경로는 공개 가능성 재검사로 거부한다.
- migration: CLI2.101.0 `migration new`로 생성한 `20260923182210_memory_publication_source_status.sql`. published_sources column, 내부 source capture trigger, owner status RPC, replay 검증, RLS가 켜진 private 삭제 fence, authenticated retire RPC, 기존 visual builder/reader를 재사용하는 fence wrapper다. 기존 원본/공용 표지/이미지 bytes 삭제나 production 의존성 변경 없음. Supabase changelog와 [공식 함수 권한 문서](https://supabase.com/docs/guides/database/functions)를 확인했고 private helper·테이블 접근을 명시 회수했다. 운영 적용 0건.
- AUTO_TESTED PASS: Node24.19.0/npm11.17.0에서 `npm run test:unit` **310/310**. `node scripts/run-e2e.mjs tests/publication-ui.spec.ts tests/memory-board.spec.ts tests/release-editing.spec.ts tests/service-worker.spec.ts tests/release-sync.spec.ts --project=chromium --workers=1 --reporter=line --max-failures=1` **25/25**. 정확한 갱신/새 동의/취소/기존 버전 유지/전체 철회/원본 보존/실패 후 재시도 삭제/페이지 복귀 재검증, 기존 Board·편집·sync·SW 회귀 포함. source/userimage endpoint는 합성 RPC이며 실제 Chromium/IndexedDB를 사용했다. 새 두 흐름을 화면 증거용 재실행 **2/2** 후 screenshot을 열어 확인했다.
- SQL PASS: WSL Ubuntu24.04 PostgreSQL16.15를 설치하고 비특권 postgres 사용자·일회성 unix-socket 전용 DB에서 `PG_BIN=/usr/lib/postgresql/16/bin bash tools/publication-boundary/run-local-postgres.sh` 실행. 기존57(기본51+retire6)+이미지31 = **88 assertions**, 동시성 **6건**(prepare/quota 기존2 + publish와 global/retire/delete/board 경합4) 통과. 원본 복원 후에도 읽기 거부, 다른 owner의 fence 격리, 비회원 RPC 거부 확인. 합성 auth.uid/Storage이므로 실제 Supabase 증거 아님. GitHub quality에 같은 SQL job을 추가했으나 원격 CI는 아직 실행/확인하지 않았다. Windows 재설치 시 shell CRLF 실패를 막도록 해당 script eol=lf를 지정했다.
- build PASS: `npm run build` **16 pages + postbuild**, dist Android route 함수 **16**. production bundle에 DEV publication hook/서비스 비밀키 이름이 없음. Android 패키지/실기기 검증 아님. 최종 `git diff --check` 검사 및 변경 source/log SHA256은 evidence 참조.
- 정적 검토/실패 기록: React Doctor0.9.14 **39/100, errors21/warnings126**으로 전체 PASS 아님. W10 신규 파일/SQL의 error0, 기존 detail complexity warning1 추가. 기존 package advisory 표시, Library/Backup/hooks/showcase 오류, separate RLS migration·의도적 테스트 정책 진단은 W18에서 실제 영향 판단. 신규 오류를 숨기도록 rule을 끄지 않았다. 초기 삭제 브라우저 검사는 합성 owner의 device_sync_state 누락으로 실패하여 실제 repository device 등록 fixture를 보완한 뒤 전체 통과했다. Supabase advisors는 임시 DB 수명/Windows→WSL 연결과 TLS 요구로 실행 실패하여 결과 없음; D01 실제 환경에서 재실행한다.
- 보안/운영 영향: 신규 응답은 익명 DTO를 넓히지 않고 private source manifest도 client에 보내지 않는다. retire는 Auth UID의 namespace에만 영향을 주며 flags off/게시 제한 상태에도 철회를 허용한다. 실제 관리/한도/중단/비용 gate는 그대로다. W15는 신규 retire 요청과 fence 용량도 제한해야 한다. 로그에 private 본문/원본 경로·credential을 추가하지 않았다. 이미 내려받은 사본 회수는 보장하지 않는다.
- rollout/rollback: W07/W08/W10 서버 migration과 실제 검증을 **계정 클라이언트 배포 전에** 마쳐야 한다. RPC가 없거나 오프라인이면 계정 삭제는 원본을 보존하며 중단한다. 서버 철회 후 로컬 삭제 실패는 철회를 되돌리지 않고 재시도한다. rollback은 public reads/writes를 잠그고 client만 검증된 이전 버전으로 복구한다. 삭제 fence/기존 revoke 이력은 삭제하거나 이전 DB로 덮어쓰지 않는다. DB 복원은 최신 fence 재적용 후 검증까지 공개 금지(D05).
- REAL_ENV_VERIFIED BLOCKED: 실제 A/B/anon Auth·REST/Storage, deployed API/CDN/Android, DB+Storage 복원·최신 fence 재적용·Public 중단과 관측은 D01/D05/W19에 남는다. 미니홈·향후 공개 카드 경로도 W11/W19에서 같은 reader fence를 반드시 사용한다. 운영 Public/DB/배포/commit/push 수행 없음. OWNER_APPROVED: 로컬 W10 진행 승인, 운영 D06 미승인.
- 증거: [W10 source/log hash와 검증 범위](evidence/2026-09-24-w10-validation.json), `.cache/w10-{unit-final,browser-final,sql-final,build-final,react-doctor-final,routes,visual}.log`, `.cache/w10-public-update.png`, `.cache/w10-card-withdrawal.png`. W09 evidence는 당시 파일 hash의 역사 기록이며 현재 소스는 W10 evidence를 사용한다.
- 진행: 완료 M1/6·W4/20 유지, 추가 필수0. M2 잔여는 실제 권한·이미지 전달·철회/복원 검증. W10을 DONE에 세지 않으며 W11은 로컬 선행만 충족한 READY로 이동했다. 다음 W11 공개 미니홈 선택 전시.

### 2026-09-24 · W11 종료 기록 — BLOCKED_EXTERNAL (미니홈 로컬 구현·검증 통과)

- 읽은 기준/계획: AGENTS, CODEX_START_HERE, 확정 결정 PUBLIC-LAUNCH-V2-01, PLANS, 기존 제품/이미지/구조/QA/변경통제 문맥, V2 C05/C06·ExecPlan·진행판을 확인했다. legacy showcaseRepo/Profile 경로, W09/W10 publication controller/gateway/DTO/renderer/owner runtime, server SQL·이미지 전달·SW·Android route contract와 테스트를 대조했다. 기존 ExecPlan에 W11 실행 상세를 구현 전에 추가했다. W09/W10 미커밋 소스를 그대로 보존했다.
- IMPLEMENTED YES: Board 화면의 `내 공개 미니홈` → `/minihome/` 편집 → 공개 닉네임/선택 소개 → 이미 공개한 보드 전체 또는 보드별 대표 기억 → 수동 순서 → 서버 DTO 미리보기 → 이미지 준비/명시 동의 → 게시 → `/public/home/?id=<public UUID>` 새 방문자 화면까지 연결했다. 새 사용자에게 보드 먼저 공개 안내, 비로그인에게 계정 경로, 방문자에게 현재 전시 없음/열람 불가/연결 오류를 구분한다. 한국어·영어 지원. 공개 이름은 Auth 이메일/계정 이름에서 자동 복사하지 않는다.
- 선택 모델: 첫 구현은 보드의 **공개 표현을 참조**한다. 최대10개 전시, 보드마다 전체 또는 대표 카드1개를 고르며 owner 후보는20개씩 cursor로 추가 조회한다(상품 quota가 아닌 bounded UI/RPC 한계). 공개 보드 갱신은 해당 전시에 반영됨을 명시한다. 보드 철회·카드 전체 중지·삭제·관리 차단은 기존 reader/fence를 통해 즉시 다음 요청에서 제외한다. 미니홈만 비공개로 전환하면 별도 공개 보드는 유지한다. 독립 카드 재게시/새 이미지 사본/legacy private 취향 위젯을 생성하지 않는다. 이름을 바꿔도 같은 public UUID를 유지하고 account UID·연락처·private 수량은 visitor DTO에 없다.
- 서버/migration: CLI로 생성한 `20260923183940_memory_minihomes.sql`: 기본 off `minihomes_enabled`, private RLS table, owner-only get/list/prepare/publish/revoke와 anon read, private DTO builder. Auth UID 소유권·서버 writes/policy/계정 제한·revision/hash/operation 검증. prepare만으로 공개되지 않으며 prepare/update 중 이전 공개본을 유지한다. 보드가 검토 이후 바뀌면 publish를 거부하고 새 동의를 요구한다. revoke는 쓰기 중단/계정 게시 제한에도 가능하고, 과거 성공 operation 재시도는 현재 private 상태를 반환한다. owner/visitor 모두 no-store. public image URL에는 기존 publication ID를 전달해 W08 권한/bytes 경계를 재사용한다.
- 클라이언트/파일: `createMinihomeController.js`, `minihomeView.js`, `MemoryMinihome/MinihomeSnapshot/PublicMinihome.jsx`, `minihomeCopy.js`, 두 Astro route, `SupabasePublicationGateway.js/platformPublication.js`, Board 진입점/CSS/route manifest/tests를 수정했다. controller가 중복 클릭을 직렬화하고 취소/unmount/계정 변경 후 응답을 폐기한다. 모호한 publish 실패는 같은 operation으로 재시도하며 stale consent는 폐기한다. 편집 재진입 시 복구된 서버 초안을 자동 선택·동의하지 않는다. 사용자 문자열은 React text로 렌더한다.
- AUTO_TESTED PASS: Node24.19.0/npm11.17.0 `npm run test:unit` **315/315**(W11 신규5). `node scripts/run-e2e.mjs tests/publication-ui.spec.ts tests/memory-board.spec.ts tests/service-worker.spec.ts --project=chromium --workers=1 --reporter=line --max-failures=1` **18/18**(publication14=기존10+미니홈4, Board3, SW1). 대표 선택→미리보기→미동의 차단→새 익명 context 방문→연결 오류/재시도→미니홈 비공개→보드 유지, 취소·stale consent·로그아웃 늦은 응답·빈 상태, 명시 순서, 320px KO 편집/EN visitor, 기본 flag off/guest 편집 차단을 검증했다. 실제 로컬 Chromium/IndexedDB이며 RPC/Auth는 합성이다. screenshot 두 장을 열어 확인했다.
- SQL PASS: WSL Ubuntu24.04 PostgreSQL16.15에서 전체 local publication harness 성공. W11 **27 assertions**(마지막 temp table count24 + rollback 격리 시나리오3), 기존88와 기존 동시성6 = **121 PASS notices**. A/B 소유권, anon 권한, DTO 동일성, 기본 off, 미게시 preview, policy/소스 변경 후 재동의, 동일 operation 멱등, revoke/과거 요청, 원본 retirement/보드 철회/계정 숨김/kill switch 전파를 확인했다. W11 전용 동시 연결 경합은 별도 추가하지 않았고 기존 publication 동시성6을 회귀 실행했다. 합성 auth.uid/Storage이며 실제 Supabase 실험은 아님.
- build/검토: `npm run build` **18 pages+postbuild PASS**, dist Android static route18 PASS, production bundle DEV adapter/서비스 비밀키 이름 scan no matches, `git diff --check` PASS. 원격 CI는 미커밋 변경이므로 실행하지 않았다. React Doctor0.9.14 **39/100, errors21/warnings131**: 기존 errors21 유지, W11 신규 error0/warning5(편집 복잡도, 이미지 준비 callback3, async state 경고1). async 응답은 AbortSignal과 effect cleanup으로 차단, readiness callback은 모든 실제 이미지 로드 완료를 게시 조건으로 전달한다. 경고를 숨기지 않았다. 초기 대표 select의 label 식별/이벤트 값 취급을 보완하고 최종 전체 브라우저 검사가 통과했다.
- 보안/설정: client `PUBLIC_MEMORY_PUBLICATION_V1=1`과 **`PUBLIC_MEMORY_MINIHOME_V1=1`**, server minihomes_enabled/reads/writes/policy 게이트가 모두 필요하다. 실제 env/DB/운영 flag를 변경하지 않았다. 공개 DTO 외 private 데이터 자동 전시·추가 사진 업로드·analytics/log payload 추가 없음. 의존성/lock 변경 없음. 새 RPC 호출 한도/비용·신고·복원/전달 지연 gate는 W14/W15/W17/W19 및 D01/D03/D05에 유지한다. 보드가 살아있는 동안 해당 보드 이미지 URL은 미니홈 비공개 후에도 유효할 수 있음을 안내하는 모델이다.
- rollout/rollback: 운영 적용0. W07~W11 migrations·실환경 검증을 먼저 마치고 client flag를 승인된 후보에만 설정한다. rollback은 minihomes_enabled=false로 reader/게시 중단 후 client 복원, 기존 게시·철회/삭제 fence 보존. 공유 원본·catalog·private DB/Storage 삭제 없음. 실제 DB 복원으로 과거 공개 상태가 부활하지 않는 운영 리허설은 D05/W17 잔여.
- REAL_ENV_VERIFIED BLOCKED: 실제 Supabase A/B/anon JWT·REST/Storage·배포 API/CDN, 미니홈 사용자 이미지 전송, Android 실기기·App Link, 실제 moderation/복원 미검증. 로컬 pass를 이 gate의 완료로 바꾸지 않았다. OWNER_APPROVED: 사용자 W11 로컬 진행 승인, 운영 D06 미승인. commit/push/deploy 없음.
- 증거: [W11 검증/source·artifact SHA256](evidence/2026-09-24-w11-validation.json), `.cache/w11-{unit-final,browser-final,sql-final,build-final,routes,react-doctor-final,diff-check}.log`, `.cache/w11-home-320.png`, `.cache/w11-editor-320-ko.png`. W09/W10 evidence는 당시 소스의 역사 기록이다.
- 진행: 완료 M1/6, 기본 W4/20, 추가 필수0 유지. M3 로컬 W11 결과를 확보했으나 실환경·W12/W13 남음. 다음 W12 팔로우·해제·내 목록은 W07/W11 **로컬** 선행 충족으로 READY이며 외부 게이트를 지우지 않는다.
