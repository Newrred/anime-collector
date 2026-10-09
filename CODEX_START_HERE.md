# CODEX START HERE — MOEMOA

> **2026-10-10 현재 재개점 — C02 고지 개정 검토:** 간단한 국가·DOB·약관→Google 흐름과 KR14/PH13/TH13 결정을 유지했다. DOB 앞의 최소 연령 유도 문구를 중립 안내로 교체하고, `/legal/review/`에 KO/EN 약관·개인정보 개정 검토본을 준비했다. 현재 동의 대상인10/9 문서/정책/영수증은 변경하지 않았다. 이번 합성 Google/API 기반 실제 가입 UI5·build25 PASS. 이전 실제 신규 C 가입 PASS와 구분한다. 국가별 조건·수령 법인/국외 이전·보존/삭제 기한은 아직 미완료이며 기존02 상단에 구체화했다. 이전fc71cd2 CI37966479741 두 job SUCCESS. 이번 변경은 테스트 Git Preview 대상, 운영/master/DB/Public 변경0. 다음1개는 실제 운영 처리 위치·보존/삭제 기준을 대조해 개정본의 빈칸 마감. 아래는 각 실행 시점 기록이다.

> **2026-10-10 현재 재개점 — 가입 시각 오차 보완:** 실제 신규 C 가입·동의 결속·로그인 PASS(add55d3)는 유지한다. start 요청에서 클라이언트가 서버보다1ms 빠르면503이 나는 별도 결함을 합성 재현했고, 최대60초 미래값만 서버 수신시각으로 낮추도록 보완했다. 과거30분 만료/10분 OAuth 만료·나이·약관·정책·계정 검증은 유지한다. 이번 unit479/가입 Chromium4/build24 PASS, 이전 add55d3 CI37965007645 전체SUCCESS. 최초 hosted503의 정확한 원인은 당시 진단 부족으로 미확정이며 이번 재현과 구분한다. 현재 보완은 테스트 Git Preview 반영 대상; 운영/master/Public/DB migration 변경0. 신규 시계오차의 실제 hosted 재현은 미검증이다. 다음1개는 C02 국가별 최종 가입 정책·고지 마감; 기존 D05 외부 복구/키 보관도 남는다. 아래 기록은 각 실행 시점의 근거다.

> **2026-10-10 테스트 배포 완료:** Git `codex/phone-test`의 `b79d50fc071c43e34f45afb3eb080d31abe1635a`를 Vercel Git Preview `4Jgeybthi6zgpxRjAZBeQnj8EaMG` Ready/Source와 대조했다. 실제 `/auth/start/`에서 국가·생년월일·약관·Google 버튼과 한국14세 정책 읽기 PASS. test policy/admission on, Auth Hook·시간별 purge 연결, Preview A/B allowlist 필수. 로컬 unit476/build24 PASS; GitHub37963376640 SQL job 성공/브라우저 job 진행 중. 다음은 열린 Chrome에서 사용자 직접 생년월일·약관 확인→Google A 로그인 후 서버 영수증/복귀 확인. 실제 Google 신규 경로 PASS는 아직 아님. 운영/master/Public 변경0. 아래 미등록/미배포/off는 당시 이력이다.

> **2026-10-10 테스트 가입 연결:** 교체된 키를 재조회하지 않고 Preview `codex/phone-test`의 signup 설정을 등록했다. 기존 Supabase 서버 설정은 중복 거부로 보존했다. Google callback 추가 저장, test Before User Created Hook 활성, 시간별 만료 임시정보 정리 예약 완료. Google 프로젝트는 외부/프로덕션 게시 상태라 Preview 서버에 승인 A/B 계정 해시 제한을 추가했다(누락·타 계정은 fail-closed). unit476/build24 PASS. DB 가입 policy는 아직 off이며 다음은 Git Preview 배포 확인→test policy 활성→사용자 직접 생년월일/동의 후 실제 Google 왕복이다. 운영/master/Public 변경0. 실제 신규 가입 PASS는 아직 아니다.

> **2026-10-10 키 교체 검증 완료 범위:** 사용자 직접 새 test Google 키 생성·Supabase/Vercel 저장 및 이전9/24 키 사용 중지 완료. 날짜별 Google 관리 상태에서 이전 키 중지/새10/10 키 활성 확인. 그 뒤 Chrome 테스트 배포에서 로그아웃→새 Google 로그인→`/data/` 복귀·A 계정 일치·Sign out 표시 PASS. 새 키 원문 재조회/운영 변경0. 신규 signup API는 아직 미배포이며 그 성공으로 기록하지 않는다. 다음은 기존 테스트 Preview의 나머지 서버 설정·callback·임시정보 정리 예약 마감. 아래 교체 대기·Google 화면 오류는 과거 이력이다.

> **2026-10-09 test DB 적용 후 재개점:** 간편 가입 migration 두 개를 moemoa-test에 기본 off로 적용하고 실제 익명 정책 읽기/권한 거부를 확인했다. 운영 미변경. Google Secret을 Preview 전용으로 등록하는 중 도구 응답에 노출되어 교체 전 새 배포를 중단했다. Google Cloud 설정 페이지도 로딩 오류. 키 값은 문서/Git에 없으며, 기존 ExecPlan의 「Hosted 테스트 연결 재개」와 작업판 맨 위에서 사용자 직접 키 교체 후 재개한다. 로컬 검증과 실제 Google 가입 완료를 구분한다.

> **2026-10-09 가입 서버 연결 로컬 후보:** 국가·생년월일·약관→Google의 화면 단계는 유지하고, 서버 Google 왕복·신규 Auth INSERT 경계·계정별 영수증·암호화 일회 로그인 전달을 연결했다. 이번 unit475/모의 Google·실제 UI Chromium4/격리 SQL 및 두 연결 경합2/build24 PASS. migration `20261009130000`·`20261009143000`은 기본 off, 운영 미적용. 실제 hosted Google/Hook·국가별 최종 정책/고지·정기 임시정보 정리 설정은 남아 있다. 기존469/23 결과는 이전 후보 증거이며 전체 출시 PASS가 아니다. 기존 ExecPlan과 단일 작업판의 현재 카드를 따른다.

> **2026-10-09 현재 출시/가입 기준:** 사용자 승인으로 한국·필리핀·태국에 미국·유럽을 추가(US/EUROPE-LAUNCH-SCOPE-01). 기존 제품 최소 KR14/PH13/TH13, 생년월일 자가 입력·간단한 Google 가입·최소 약관/개인정보 안내 방향 유지. PASS/보호자 이메일/KWS 제외. 국가별 조건은 기존 C02·D04에서 관리하며 미국·유럽 전역의 동일 연령/적합성 완료를 뜻하지 않는다. 가입 구현·배포는 미완료, 아래 KWS/12세 기록은 과거 이력이다. 현재 작업은 release-v2 단일 작업판의 현재 카드와 C02 최신 절을 따른다.

> **10/9 로그인 후 확인:** Epic 조직 대시보드와 KWS 진입을 확인했다. 보호자 인증은 시작하기, 사용자 권한(동의 관리)·가족 관리·Age Gate·연령 인증은 문의하기로 표시된다. Age Gate는 셀프 서비스 불가, 연령 인증은 셀프 서비스 활성화 문의 안내다. 미등록 개인의 최종 이용 승인은 확인되지 않았다. 문의 초안을 포털에 준비했으며 미발송/약관 미수락이다. 다음은 KWS 문의 발송의 사용자 명시 승인이다. 아래 로그아웃/로그인 요청 상태는 이 확인으로 대체한다.

> **2026-10-09 동의 방식 후속:** 보호자 회신·운영자 수동 검토 방식은 사용자가 거절했다. 12세·KR/PH/TH 유지, 무료 KWS 가능성 조사 승인. 무료/Web 지원은 확인했지만 개인 등록·CM 실제 제공 조건은 Epic 포털 로그인 후 확인 필요. 가입 후보 SQL 확장·운영 적용은 보류한다. [C02 조사 결과](docs/moemoa/release-v2/02_ACCEPTANCE_CONTRACTS.md#2026-10-09-kws-실현-가능성-조사)를 먼저 읽는다.

> **2026-10-09 출시 마감 최신:** Safari 추가 검사 제외/PASS 아님,12세·한국/필리핀/태국과 보호자 동의 준비 재확정. 실제 운영 private 저장/삭제는 배포됐고 Public은 off/schema 미설치다. 용량 경보·지원 연락처 보완과 private-only→Public 로컬 보존 검사를 진행했다. Drive/One5TB 확인. 사용자 비밀번호 재설정 후 운영 연결 복구, DB·이미지4304개 암호화 및 독립 byte 복원4308파일 확인. 승인된 Drive 비공개 폴더 업로드는 완료했다. 외부 재다운로드 무결성/별도 키 보관/실제 DB 재구동은 미완료이며 Windows 복원 최종 rename 오류를 별도 기록했다. 현재 작업/남은 차단은 [단일 작업판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)과 [C02 동의 계약](docs/moemoa/release-v2/02_ACCEPTANCE_CONTRACTS.md#2026-10-09-보호자-동의-준비--w06w14w20-d04)을 따른다. 아래 Safari 후속·Drive 서비스 미정·예전 미배포 표시는 당시 기록이다.

> **2026-10-09 두 화면 직접 검증 후속:** 운영의 비공개 전용 DB에 빠진 카드 삭제 RPC를 migration `20261009090000`으로 추가했고, 사용자가 지정한 오늘 테스트 카드의 삭제·fence·사진 retirement를 확인했다. 열려 있던 반대 상세가 삭제 결과를 무시하는 문제도 발견해 `MemoryCardDetail.jsx`에서 삭제 수신 시 카드/미리보기/편집을 비우도록 보완했다. Public·정책·일반 개인 기록은 변경하지 않았다. 실제 iPhone 오프라인 검사는 사용자 요청으로 제외했고 PC 두 브라우저 결과와 구분한다. [기존 계획의 후속 결과](docs/moemoa/plans/2026-10-09-private-photo-reliability-and-handoff.md#19-두-화면-직접-검증과-삭제-경계-마감), [DB release 증거](docs/moemoa/release-v2/evidence/2026-10-09-private-retirement-production.json)를 먼저 읽는다. 최신 운영 소스는 Git `master`와 [build-info](https://www.moemoa.xyz/build-info.json)를 대조한다.

> **2026-10-09 인계:** 신규 사진의 첫 계정 전송이 일시적으로 실패할 때 같은 카드·업로드 작업으로 1회 자동 재시도하고, 여전히 대기 중이면 안전한 문제 코드를 표시하도록 보강했다. 과거 건너뛴 로그인 사진 검사 10건을 현재 정책에 맞게 다시 활성화했고, 합성된 두 브라우저 기기의 저장·오프라인 수정·삭제 왕복을 회귀 검사에 추가했다. 실제 iPhone Safari에서 수정·삭제·오프라인 왕복을 확인했다는 뜻은 아니다. 이번 작업의 최종 검증·운영 배포·Git SHA는 [2026-10-09 사진 저장/인계 계획](docs/moemoa/plans/2026-10-09-private-photo-reliability-and-handoff.md)을 확인한다. 다른 PC에서는 `git fetch origin` → `git switch master` → `git pull --ff-only origin master` → `npm ci` 순서로 받는다. 개인 로컬 기록·사진 원본·비밀 설정은 Git에 포함되지 않는다.

> **2026-10-08 현재 운영 상태:** 새 카드·사진의 계정 자동 저장은 운영 Git `master`에 반영돼 있고 운영 사진 설정 `PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1=1`이다. 기존 iPhone 카드의 저장 재시도 뒤 사용자가 PC에서 카드와 사진을 확인했다. 이는 새 카드 작성·오프라인 복구까지 실기기 전수 검증했다는 뜻은 아니다. 환경 변수·DB 정책·관리 화면의 위치와 변경 절차는 [운영 설정 지도](docs/moemoa/operations/2026-10-08-configuration-map.md), 남은 검증과 CI 현황은 [마감 계획](docs/moemoa/plans/2026-10-08-operations-closeout.md)을 따른다. 아래 날짜별 ‘로컬 후보’ 및 ‘off’ 표기는 당시 기록이다. 정확한 운영 버전은 [빌드 정보](https://www.moemoa.xyz/build-info.json)로 확인한다.

> **2026-10-08 운영 iPhone 사진 카드 저장 복구:** 운영 카드 전송의 `MEMORY_GATEWAY_FAILED`는 사진 업로드 전에 이미지 metadata RPC가 DB의 `memory_visual_assets_source_metadata_check`에서 거절된 결과였다. 비디자인 이미지에 들어온 JSON `null`을 SQL `NULL`로 정규화하는 migration `20261008093000`을 운영에 적용하고 이력·트리거·함수 각 1건을 확인했다. 복구 UI는 기존 기기 카드 ID로 계정 저장을 재시도한다. 구현 커밋은 `f9ea8915b6402b14eb871a59236377c91f26634a`이며 최신 Git `master`와 운영 Web SHA는 `build-info.json`을 대조한다. **사용자가 기존 iPhone 카드 재시도 후 PC에서 카드와 사진이 모두 잘 보인다고 확인했다.** 아래의 ‘운영 미반영’ 문구는 당시 기록이다. [계획/검증](docs/moemoa/plans/2026-10-08-save-to-account-on-save.md).

> **2026-10-08 당시 로컬 후보(이후 운영 반영):** 사용자는 로그인 상태의 기록·카드·보드·신규 비공개 사진 자동 저장, 비로그인 공식 표지 카드·작품/감상 기기 저장, 개인 사진의 로그인 요구, 시스템 디자인 신규 작성 종료를 확정했다. [결정](docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md#decision-log--automatic-save-and-guest-cover-01-2026-10-08)·[ExecPlan](docs/moemoa/plans/2026-10-08-save-to-account-on-save.md)을 참조한다. 당시에는 사진 flag가 off이고 Git push·운영 배포 전이었다. 현재 상태는 이 문서 맨 위를 따른다.

> **2026-10-07 현재 운영 구조 읽기:** [현재 구조와 화면 흐름](docs/moemoa/CURRENT_STRUCTURE_AND_FLOW.md)에서 실제 `master` 기준 라우트·기록/동기화 경계·옛 서재의 호환 경로를 확인한다. [화면 혼재 감사](docs/moemoa/reports/2026-10-07-live-flow-consolidation-audit.md)는 당시 문제 원인과 개선 순서이며, 완료 상태는 [단일 작업판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)의 맨 위를 따른다. 운영 소스 SHA는 [build-info](https://www.moemoa.xyz/build-info.json)와 Git `master`를 대조한다. 아래 날짜별 ‘최신’ 문구는 당시 이력이다.

> **2026-10-07 다른 PC 인계:** 감상 관리 통합·옛 서재 기능 연결은 `6565c5e`·`83cdf49`를 `master`에 push해 Web 운영에 반영했다. 기존 저장소에서 `git fetch origin` → `git switch master` → `git pull --ff-only origin master` → `npm ci` 후 이어서 작업한다. [이번 배포·검증·미확인 범위](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md#2026-10-07-git-운영-배포다른-pc-인계)를 먼저 읽는다. Git은 개인 로컬 기록·원본 이미지·비밀 설정을 옮기지 않는다.

> **2026-10-07 최신32차 — 작품 기록 다기기 동기화:** 운영 PC의 저장 작품 51개·감상 기록 22개가 같은 계정의 iPhone Safari에서 0개로 보였던 원인을 수정했다. 작품·감상 기록·컬렉션 선반을 계정별로 동기화하고, 기존 로컬 기록 보호·삭제/충돌·계정 경계를 둔다. 테스트/운영 DB에 migration `20261007093000`을 적용했고 사용자 승인으로 master Git 배포 `ad1995a`를 진행했다. 운영 DB는 51개 작품·22개 감상 기록·선반 1개, iPhone Safari는 51개 작품·22개 감상 기록을 확인했다. 원본 이미지·Public·Android와 기존 티어/캐릭터 고정의 동기화 범위는 변경하지 않았다. [ExecPlan](docs/moemoa/plans/2026-10-07-title-state-account-sync.md)과 [운영 증거](docs/moemoa/release-v2/evidence/2026-10-07-title-state-sync-production.json)를 따른다. 아래31차 이하의 ‘최신’ 표기는 당시 이력이다.

> **2026-10-07 최신31차 — Web/운영 DB 마감:** 사용자 직접 승인으로 기존20~29차를 유지하고 배포 버전06d2e38과 핵심 기능을 대조했다. 감상 기록·별점·시청 상태·정주행/이력 관리와 이미지/Archive/Board·백업·계정 기능을 연결·검증했다. 카드별 태그·캐릭터 migration은 test/production 적용 및 권한/구클라이언트 호환 검증 완료, 새 classification sync만 활성화했다. 취소된30차·Android 제외, 운영 Public/private-image flags는 기존off 유지. 자체 catalog WatchLog 전체 원격 모델/실물폰·공개 출시 잔여는 완료로 만들지 않는다. 운영 Web 코드 후보 `0f46310`은 master/Vercel Git/source SHA 일치 및 CI37502913118 성공, 실제 표지·캐릭터/감상 분기/기존 이력 관리·새 태그 설정 읽기 확인까지 완료했다. 최종 문서 인계도 master에 반영하며 최신 master/deployed SHA는 배포 증거의 조회 절차와 이번 종료 보고를 따른다. Git/Vercel 최종 SHA와 이번 검사는 [31차 보고](docs/moemoa/reports/2026-10-05-v84-web-application.md#31차--핵심-기능-비교와-webdb-운영-반영-2026-10-07) 및 [배포 증거](docs/moemoa/release-v2/evidence/2026-10-07-web-design-deployment.json)를 따른다. 아래 날짜별 상태는 당시 이력이다.

> **2026-10-07 요청 취소/원복:** 30차의 ‘컬렉션 실험적 취향 배치·작품 Poster View로 선반/펼침 이전’은 사용자 취소로 제거했다. 실제 현재 화면/소스는 아래29차까지의 컬렉션 선반·옆 펼침/작품 두 보기/감상 기록 복원을 유지한다. 이번 원복 검사 unit424/관련 Chromium16/build20 PASS, 실제4363 기존 표지5개/선반과 클릭 펼침 확인. 취소된30차를 재개하지 않는다. [원복 기록](docs/moemoa/reports/2026-10-05-v84-web-application.md#30차-요청-취소와-원복-2026-10-07). 과거 실행 로그와25~29차 미커밋 자료는 보존했다.

> **2026-10-07 현재 로컬 작업（29차）:** 공통 ‘기억 남기기’는 `/record/`에서 감상 기록/장면 저장을 나눈다. 감상은 내 작품·기존 검색→같은 Title Hub 감상 탭에서 시청 상태/별점/재시청·날짜/감상 이력을 명시 저장하며 이미지 없이 가능하다. 기존 긴 메모·WatchLog·캐릭터/태그와 Memory를 보존한다. 자체 catalog 로그의 로컬 identity/백업도 연결했다. 최종 unit424/관련 Chromium16/build20 PASS; 전체 회귀99PASS/2실패/2환경 skip 및 보정은 [29차 보고](docs/moemoa/reports/2026-10-05-v84-web-application.md#29차--감상-기록과-장면-저장-동선-복원-2026-10-07)에 보존한다. 실제4363의 기존 작품/빈 감상 폼은 읽기만 확인했고 합성 저장 검증과 구분한다. **25~29차 로컬 미커밋**, 기준2c1811d·신규 remote sync/DB/Public/배포/Android 변경0. 다음1개는 새 감상 기록 동선 사용자 검토. 아래28차 이하의 ‘현재’는 당시 이력이다.

> **2026-10-07 현재 로컬 디자인（28차）:** 실제 Collection 선반 편집을 선반 목록+활성 선반의 표지/작품명/기억 개수 선택으로 정리했다. 검색/선택됨·선반 전환·추가/제거는 draft에만 반영하고 기존 적용/취소·owner 저장을 유지한다. 28차 관련 Chromium5 PASS: 두 선반 독립 선택·검색 복귀·삭제 취소/적용·재로드·저장 실패의 draft 보존·새 작품 자동 갱신·동일 Memory/Title/Board,1440・390・320/테마/fallback. 실제4363 카탈로그 표지5개는1440・390에서 정상 표시/no-overflow 확인했다. unit/build 및 실제 명령·한계는 [28차 보고](docs/moemoa/reports/2026-10-05-v84-web-application.md#28차--선반-편집-정리와-실제-표지-2026-10-07). 26・27차의 표지 뒤 같은 작품 기억 최대3개와 클릭 시 PC 옆/모바일 아래 펼침은 유지하며 과거 실패·PASS를 보존한다. **25~28차 로컬 미커밋**, Git 체크포인트2c1811d/DB/Public/운영배포 변경0. 다음1개는 새 선반 편집 배치 사용자 검토. 아래 필름·서로 다른 작품 겹침·행 아래 설명은 당시 이력이다.

> **2026-10-06 최신 Git 인계:** `codex/phone-test`의 개발 체크포인트에서 V8.1~V8.4 디자인 자료와 실제 Web 적용20~23차·카드별 분류/상세 개선을 이어간다. [최신 다른 PC 절차](docs/moemoa/operations/2026-10-05-design-handoff.md#최신-git-인계--2026-10-06--실제-web-적용2023차), 기존 interface-rebuild24차 참조. 실제 앱은 `npm run dev`, 최신 시안은 **`npm run design:preview:v84`**, 격리 회귀는 `npm run test:e2e:channel`. 비밀 환경 설정/개인 브라우저 기록/원본은 Git 이전되지 않는다(기존 공개 client `.env.production`은 유지). 태그·선반은 현재 기기 보관, 새 SQL은 미적용 후보다. 다음1개는 기존 실제 기억 상세 배치 사용자 검토. Android 제외와 운영 DB/Public/master 배포의 D06 승인 유지. 아래 ‘미커밋’ 표시는 Git 인계 이전의 실행 이력이다.

> **2026-10-06 최신 마감:** 기존 interface-rebuild23차에서 실제 기억 상세를 기본 읽기→명시 수정, 기억/관리 탭, 검색 가능한 별도 캐릭터 선택창으로 정리했다. 실제 프리렌 표지/30명 카탈로그 캐릭터와1440·390·320/dark 확인. 이번 unit416/고유 Chromium66/build19 PASS. [23차 결과](docs/moemoa/reports/2026-10-05-v84-web-application.md#23차-후속--상세-읽기수정관리-분리-2026-10-06), [인계](docs/moemoa/operations/2026-10-05-design-handoff.md) 참조. **현재 카드 태그는 이 기기에 저장**된다.22차의 migration 후보/SQL19는 당시 근거이며 이번 DB 재검사/hosted·운영 적용/flag 변경/배포는 없다. 이전61/64 및 반복 검사와 합산하지 않는다. 브랜치 `codex/phone-test`,4363 실제 앱 소스 반영/로컬 미커밋. 다음은 기존 실제 기억의 상세 배치 사용자 검토다. 실폰·운영 배포/DB/Public 승인 D06 별도. 아래 날짜별 ‘최신’은 당시 기록이다.

> **2026-10-05 최신 디자인 작업:** 최신 개발 브랜치는 계속 `codex/phone-test`다. 사용자 승인으로 **V8.4의 공통 메뉴·핑크 주요 버튼, 실제 책장 선반/행 아래 필름, 작품 두 보기, 기억 기록 기반 분류와 원본 비율 목록, 이미지 상세**를 `src/`에 적용했다. 후속으로 테마 선택 메뉴·검색 초점·로고 hover·적은 기억의 좌측 필름을 마감했다. 기존 익명 카탈로그 읽기로 실제 표지5개를 확인했고 로컬4363의 ‘디자인 확인’ 선반에 실제 작품5개를 선택했다(기억 생성0). unit410/build19 routes/Chromium 고유64개 PASS, 실제폰은 미검증. [실제 Web 적용 결과](docs/moemoa/reports/2026-10-05-v84-web-application.md), 기존 interface-rebuild 계획20·21차와 [10/5 인계](docs/moemoa/operations/2026-10-05-design-handoff.md) 참조. 시안은 `npm run design:preview`, 실제 앱은 `npm run dev`다. **Hero 금지, 로고2안 유지. 이번 적용은 아직 로컬 미커밋이며 운영 배포·공개 활성화 승인이 아니다.** 아래 날짜별 미커밋/최신 표기는 당시 이력이다.

> **2026-09-29 다른 PC 재개:** 최신 개발 브랜치는 `codex/phone-test`이며 master가 아니다. [최신 인계](docs/moemoa/operations/2026-09-29-desktop-handoff.md)를 먼저 읽는다. 비공개 사진 다기기/목록 연결은 확인했으며 공개 준비·게시/철회 검증과 UI 전반 정리는 남아 있다. 아래 master 이전 안내는 날짜별 과거 이력이다.

> **2026-09-27 최신 범위 확정:** `GENERAL-PUBLIC-POSTMODERATION-01` — 성인 인증·성인 이미지 공개는 보류. 비공개 업로드와 일반 이미지의 간단한 공개 확인·신고·관리자 사후 검토로 첫 Web 후보를 좁힌다. 성인 공급자 문의/계약·추가 인증 개발을 출시 필수 작업으로 진행하지 않는다. 12세 목표의 보호자 동의와 KR/PH/TH 조건은 별도 D04 잔여. 기존 사전심사 코드와 새 목표의 차이는 W08/W09/W11/W14에서 마감한다. 실행 지시는 [단일 진행판의 현재 작업 카드](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md) 하나만 따른다. 아래 재개·일시정지·다음작업 표시는 날짜별 이력이며4ead72b는 검토 checkpoint, 운영 RC가 아니다.

> **2026-09-27 Pro 재검토 인계:** 사용자 요청으로 구현을 일시정지하고 현재 변경 전체를 기본 브랜치 `master`의 검토용 커밋으로 보존한다. [최신 인계 문서](docs/moemoa/reports/2026-09-27-pro-release-progress-review.md)에서 실제 진도·미완료·검증 한계·검토 질문을 먼저 읽는다. 이 커밋은 출시 승인이나 운영 반영이 아니다. 아래 날짜별 상태는 과거 이력이며 현재 상태는 release-v2 단일 진행판을 따른다.

> **2026-09-26 간이 Web 배포:** 사용자가 폰·지인 테스트용 Git 배포를 승인했다. 기존 계정·기록 및 브라우저 로컬 이미지 선택만 제공하고 private 이미지 연동/Public은 닫는다. 정식 출시 완료 아님. 최신 배포 SHA/검증은 [단일 진행판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)과 해당 배포 증거를 따른다. 아래 미배포 표기는 당시 이력이다.

> **2026-09-26 현재 범위:** 사용자 승인 `FREE-PRIVATE-IMAGE-SYNC-01`에 따라 첫 Web-only 출시에 무료 비공개 최적화 이미지 연동을 포함한다. 기존 W06/W08/W15에서 이어간다. Web 파일 선택·원본 로컬 저장 경로는 default-off 개발 flag로 연결했으며 원격 이미지 연동은 아직 미완료다. MOEMOA 추가 운영비 월50,000원 목표, 50MB/1MB는 승인 전 후보. 아래 원본 백업 제외 이력과 새 최적화 사본 연동을 구분하고 [단일 진행판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)의 현재 카드를 따른다.

> **2026-09-25 Pro 중간 검토:** 최신 개발본은 검토 브랜치 `review/pro-interim-2026-09-25`로 인계한다. [중간 검토 안내](docs/moemoa/reports/2026-09-25-pro-interim-review.md)에서 읽기 순서·증거·출시 잔여를 확인한다. 아래 날짜별 미커밋/환경 미제공 표기는 당시 이력이다. 최신 테스트 계정·서버 키 준비 및72테이블 복원 검증은 완료했으며, 실제 공개 흐름 마감과 운영 결정·후보 승인은 남아 있다. 운영 배포 완료 보고가 아니다.

> 2026-09-24 새 PC 이전: 사용자 승인으로 개발본을 master에 반영한다. [Windows/Codex 설치 안내](docs/moemoa/operations/2026-09-24-desktop-setup.md). 아래 과거 미커밋 표기는 당시 기록이며 최신 결과는 진행판의 9/24 기록 참조.

> **활성 출시 계획 (2026-09-24):** V2의 계정·공개 보드·공개 미니홈·팔로우·최소 운영 목표를 사용자 승인으로 채택했다. **W16~W20의 가능한 로컬 구현/검증/후보 점검까지 연속 실행했다. unit320·catalog256·Chromium174·SQL235·native31, 웹/테스트 APK 빌드 통과(선택 검사 skip 별도 기록). 실제 계정·기기·정책·예산·복구 사본·정확한 후보 승인 D01~D06이 남아 정식 출시/모든 W 완료는 아니다.** 운영 SHA는0330a54지만 build-info의 workingTreeDirty=true 원인도 확인이 필요하다. 미커밋·운영 적용 없음. [단일 진행판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)과 [ExecPlan](docs/moemoa/release-v2/01_RELEASE_EXECUTION_PLAN.md)을 따른다. 아래 Private-only 마감과 이전 상태는 과거 근거로 보존한다.

> **현재 기능 마무리 (2026-09-22):** 추가 기능 개발을 중단하고 모달·카드 이미지 클릭·미저장 이동/취소·보드 작업·오류 복귀를 보완했다. 옛 공개 프로필 경로를 닫고 운영 ID 연속성/일일 health/CI/Git build 추적을 추가했다. 단위 238, 카탈로그 251, 최종 브라우저 18, build 통과. **미커밋·미배포, 예약 자동화 미가동.** 계정별 서버 한도·계정 삭제·Public 관리·실제 OAuth/Android는 출시 전 미완료 게이트다. [감사/수정 결과](docs/moemoa/reports/2026-09-22-service-finishing.md), [운영 절차](docs/moemoa/operations/2026-09-22-minimum-operations.md).

> **최신 로컬 개선 (2026-09-22):** Pro 리뷰 및 홈 재발견 보완에 따라 표지 카드 수정 검증·미평가·개인 작품 후속 기록·자체 카탈로그 시청 편집·범위를 구분한 백업/복원·홈 재발견·보드 이미지·Archive 검색을 구현했다. 단위 236개, build 통과. 브라우저 통합의 한 회귀는 수정 후 해당 suite 통과. 아직 commit/push/운영 배포하지 않았다. 리뷰 전체/출시 게이트 완료는 아님. [상세 결과와 남은 범위](docs/moemoa/reports/2026-09-22-pro-review-improvements.md).

> **배포 원칙 (2026-09-09 사용자 확정):** 앞으로 운영 웹은 검토한 변경을 Git에 commit/push하고 Vercel의 Git 연동 배포와 운영 commit SHA를 확인한다. 별도 명시 승인 없이 로컬 CLI로 운영 배포하지 않는다. [확정 결정](docs/moemoa/decisions/2026-09-09-git-based-production-deployment.md).

> **Pro 제품 상세 검토 자료 (2026-09-09):** 운영 화면 91장, 화면 요소 목록, 20개 검토 흐름, 주요 7개 흐름 및 갤러리 보조 실행 결과, 최신 미커밋 소스를 검토 ZIP으로 준비했다. GitHub가 최신 소스와 동일하다는 의미는 아니다. 로그인·실기기 등 미검증 범위를 분리했다. [작업 기록](docs/moemoa/plans/2026-09-09-pro-review-package.md). 산출물: 상위 workspace `deliverables/MOEMOA-Pro-Review-2026-09-09.zip`.

> **최신 카탈로그 (2026-09-08 누락 배치 복원):** 225개 후보 검토 후 131개 운영 추가, 기존 4,161개 보존 → **4,292개**, active `catalog-add-7e982253b551b92984460a5e`. 방영 전 87개·이미 수록 1개·판단 보류 6개 제외. 신규 131개 전체 표지/익명 검색/상세 검증 완료. [수록 결과와 보류 목록](docs/moemoa/reports/2026-09-08-missing-catalog-batch.md). 다음 전체 재생성에는 `.moemoa-missing-batch-2026-09-08` 보충 target/canonical도 반드시 포함한다.

> **이전 카탈로그 (2026-09-08 니세코이 복원):** 당시 운영 4,160개를 보존하고 니세코이 2기를 독립 추가해 **4,161개**, active `catalog-add-cfd7de57fd596c974547fb15`. 1·2기 분리 검색과 실제 상세 확인. 당시 발견한 우선 후보 24개와 TV 시즌 후보 201개는 위 배치 보고서에서 후속 검토했다. [복원·감사 기록](docs/moemoa/reports/2026-09-08-nisekoi-restoration.md). 다음 전체 재생성은 보고서의 보충 canonical 경로를 포함해야 한다.

> **최신 Web 배포 (2026-09-08 UI 정리):** 중복 필터·반복 안내 축소, 고급 필터/보드 도구 접기를 운영 반영했다. Deployment `dpl_9XFykvvfB6weyT64JByvKg11BJ3r`; 후보 및 운영 각각 16개 기능 검사, 운영 파일 78개 대조 통과. DB 변경 없음. [배포 기록](docs/moemoa/reports/2026-09-08-ui-simplification.md).

> **최신 Web 배포 (2026-09-08):** 기존 표지 갤러리 UI를 `/titles/`에 복원해 운영 반영했다. 장르 검색·태그, 열 크기 저장, Poster/Memory 전환, 모바일 배치를 검증했다. Deployment `dpl_7CswVCMgTNWLU8vzh7A3ULPCeGxm`; 운영 smoke 14개 및 배포 파일 78개 대조 통과. DB 변경 없음. [검증·배포 결과](docs/moemoa/reports/2026-09-08-gallery-production.md).

> **최신 Web 배포 (2026-09-07):** 자체 ID 작품 지원과 AniList 외부 이동 제거를 검토·수정 후 운영 반영했다. Deployment `dpl_9cQZqinSPXfT8uRbfdamz59qtyQY`. 운영 DB는 기존 3,999개 유지, 226개 추가와 provider SQL 적용은 미실행. [검토·배포 결과](docs/moemoa/reports/2026-09-07-source-independent-production.md).

> **현재 저장소 상태 — 2026-09-07**
> Android local image intake, Private Card/Archive/Board, Supabase catalog와 user metadata sync 기반, Web-first Memory UI가 구현돼 있다. 2026-09-03 사용자는 기존 Library와 Memory write model을 유지하면서 `작품 / Titles`, `Title Hub`, My Titles의 Poster/Memory View로 읽기 경험을 통합하고, 명시적으로 선택한 승인된 대표 표지를 개인 기억 신호가 있는 `CATALOG_COVER` Memory visual로 사용하는 방향을 확정했다. stable cover identity/immutable revision, 개인 기억 신호, bytes 비복제, 공용 표지 비삭제 계약과 additive user schema/RPC migration이 local 및 hosted Supabase에 반영됐다. 카드 작성 화면의 공식 표지 선택, Archive·Memory Detail, Title projection·Title Hub와 신규 `/titles/` Poster/Memory dual view까지 구현됐다. Phase 5 메뉴·검색·한영 문구·기존 주소 호환까지 구현됐다. Phase 6 Home·화면 간 연결·첫 기억 작성 후 Memory View 제안도 로컬 Web 검증을 마쳤다. 2026-09-07 사용자의 배포 승인으로 https://www.moemoa.xyz 운영 Web에 반영하고 실제 저장·검색·320px 화면을 검증했다. 배포·복구와 후속 catalog 환경값은 `docs/moemoa/reports/2026-09-07-title-hub-web-release.md`를 참조한다. 2026-09-07 사용자가 Web 기능을 직접 확인해 큰 문제는 없다고 보고했고, UI 개선은 미완료로 남긴 채 Phase 7 Android 테스트 APK를 생성했다. JS 222·native 31·native URL 모의 검사 6개를 통과했으며 실기기 확인은 대기한다. 결과는 `docs/moemoa/reports/2026-09-07-title-hub-android-phase7.md`를 참조한다. Public·사용자 이미지 cloud는 계속 비활성화한다.

> **최신 카탈로그 상태:** 카탈로그 제목 교정 운영 반영 완료(2026-09-07): 운영 3,998개를 유지한 새 DB 릴리스에 35개 제목·별칭(대표 제목 변경 16개)을 반영하고 웹을 배포했다. 실제 5등분 1기 검색→상세 및 기호 생략 검색 검증 완료. 5등분 2기와 운영 미수록 프리렌 미니 애니는 추가하지 않았다. [운영 반영/복구 보고서](docs/moemoa/reports/2026-09-07-catalog-correction-production.md)를 최신 상태로 따른다.

> **후속 복원 완료:** 5등분 2기 AniList 109261을 독립 ID로 운영 DB에 추가했다. 현재 3,999개, active `catalog-add-81297cd638290f972ca84c28`. 실제 1기·2기 분리 검색 확인. 신규 canonical은 별도 보충 workspace에 있으므로 다음 전체 재생성에 반드시 포함한다. [복원 보고서](docs/moemoa/reports/2026-09-07-quintuplets-season2-restoration.md).

## 1. 목적

카탈로그 품질 후속 작업(2026-09-07): 4,224개 감사 후 제목 연결 32개를 검토해 16개 표시 제목을 로컬 교정했다. 원본·운영 데이터는 유지하고 앱 alias 소비 경로와 재발 방지 검사를 수정했다. 누락 후보 32개, 한국어 명칭 7개 및 나머지 전수 검토는 미완료이며 AniList 추가 요청이 403으로 중단됐다. 다음 작업은 [교정 보고서](docs/moemoa/reports/2026-09-07-catalog-identity-corrections.md)와 [ExecPlan](docs/moemoa/plans/2026-09-07-catalog-identity-quality.md)을 따른다. 아직 배포하지 않았다.

이 파일은 Codex가 기존 ChatGPT 세션 없이도 MOEMOA의 제품 맥락, 확정 결정, 금지사항, 참조 문서, 작업 순서를 재구성하게 하는 진입점이다.

Codex는 세션 대화를 추측하거나 이전 요약을 현재 코드 상태로 간주하지 않는다. 모든 구현 상태는 실제 저장소에서 확인한다.

## 2. 제품 기준점

> MOEMOA는 사용자가 애니를 보며 남기고 싶은 장면을 이미지 중심 Memory Card로 만들고, 이를 Archive와 Board에 수집·재구성하며, 준비된 범위 안에서 공유하는 서비스다.

핵심 구조:

```text
작품 검색 또는 개인 작품 생성
→ 사용자 이미지, 승인된 공식 표지 또는 서비스 디자인 선택
→ 선택적 기억 신호 추가
→ Memory Card 저장
→ Archive 자동 축적
→ Board 선택 분류
→ 로그인 후 Web·백업·다기기
→ 권리·UGC 게이트 통과 시 제한적 Public
```

## 3. 소스 계층

| 우선순위 | 자료 | 용도 |
| ---: | --- | --- |
| 1 | `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | 현재 확정 결정과 미정 게이트 |
| 2 | 실제 저장소 코드·설정·테스트·마이그레이션 | 현재 구현 상태의 유일한 기술적 사실 |
| 3 | `reports/repository-audit.md` | 2026-08-11 시점의 증거 기반 구현 snapshot. 코드 변경 시 재검증 |
| 4 | 승인된 Decision Log/ADR/ExecPlan/설계 명세 | 해당 범위의 결정·기술 경계·실행 계획. `01`을 변경할 수 없음 |
| 5 | `02`~`09` 실행 명세 | `CURRENT/GATED`가 섞인 구현·검수·운영 기준. 개별 문서 banner와 index 확인 |
| 6 | `reports/implementation-gap-analysis.md` | 확정 결정과 현재 코드 사이의 Gap·권장 이전 순서. 승인된 ExecPlan은 아님 |
| 7 | `reports/architecture-options.md`, `reports/open-decision-questions.md` | TECH/STORAGE/LEGACY 확정 이력과 나머지 승인 전 선택지 |
| 8 | `references/2026-08-10-product-direction-research-integrated.md` | 시장·경쟁·제품 권고 배경 |
| 9 | `references/2026-08-06-product-direction-decision-draft.md` 및 legacy 문서 | 최초 방향과 과거 상태 기록 |

상위 자료와 하위 자료가 충돌하면 상위 자료를 우선한다. 실제 코드 상태와 제품 결정이 충돌하면 Codex가 임의로 화해시키지 않고 Gap으로 보고한다.

## 4. 작업별 필수 참조 문서

| 작업 종류 | 반드시 읽을 문서 | 보조 문서 |
| --- | --- | --- |
| 최초 저장소 감사 | `03_REPOSITORY_AUDIT_PROTOCOL.md` | `01`, 과거 references |
| 제품 흐름·UI | `01`, `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`, `../superpowers/specs/2026-09-03-title-hub-dual-view-ui.md` | `06`, `plans/2026-09-03-title-hub-dual-view.md` |
| Web/Android 구조 | `01`, `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`, `reports/architecture-options.md` | `reports/repository-audit.md`, `reports/open-decision-questions.md`, `07` |
| 작품 카탈로그·수집 | `01`, `04_CATALOG_DATA_AND_INGESTION_SPEC.md` | Source Registry 템플릿 |
| 이미지 저장·동기화 | `01`, `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md` | `06`, `07` |
| 공개 UGC | `01`, `05`, `07` | UGC launch gate 템플릿 |
| 인증·로컬 승격·동기화 | `01`, `06`, `07` | `02` |
| DB 마이그레이션 | `03`, `06`, `09` + `PLANS.md` | 해당 도메인 명세 |
| QA·회귀 테스트 | `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md` | `09` |
| 베타·출시 | `07`, `08_CODEX_PHASE_RUNBOOK.md` | `05` |
| 코드 리뷰 | `09_CHANGE_CONTROL_AND_REPORTING.md` | `prompts/moemoa/06_CODE_REVIEW.md` |
| 결정 변경 | `01`, `09` | Decision Log 템플릿 |

## 5. 단계별 읽기 순서

### Phase 0 — 패키지 설치와 지침 확인

읽기:

1. `AGENTS.md`
2. 이 파일
3. `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`

행동:

- 기존 `AGENTS.md`, `README`, package manifest, build scripts를 확인한다.
- 기존 지침과 충돌을 보고한다.
- 코드 변경은 하지 않는다.

### Phase 1 — 저장소 감사

현재 상태: **2026-08-11 최초 감사 완료.** `docs/moemoa/reports/`의 4개 문서를 사용한다. 코드·인프라가 바뀌면 이 phase를 다시 실행한다.

읽기:

- `03_REPOSITORY_AUDIT_PROTOCOL.md`
- 과거 reference 문서의 현재 프로젝트 상태 메모

행동:

- 프레임워크, 앱 구조, DB, 인증, 이미지, AniList 의존, aliases, 테스트, CI/CD를 증거 기반으로 확인한다.
- `reports/repository-audit.md` 등 4개 산출물을 작성한다.

### Phase 2 — 기술 방향과 ExecPlan

현재 상태: **Title Hub·대표 표지 Memory·My Titles dual view와 Phase 5 메뉴·검색·문구·주소 호환까지 완료됐다. Phase 6 Home·화면 간 연결·첫 Memory 안내까지 로컬 Web 검증을 마쳤으며, 다음은 사람 사용성 확인 후 Phase 7 Android 적용이다.** 검증 결과와 남은 gate는 [Phase 6 보고서](docs/moemoa/reports/2026-09-07-title-cross-surface-phase6.md)를 따른다.

읽기:

- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `PLANS.md`
- `decisions/2026-08-11-foundation-decisions.md`
- `adr/0001-capacitor-client-and-local-media-boundary.md`
- `reports/repository-audit.md`
- `reports/implementation-gap-analysis.md`
- `reports/architecture-options.md`
- `reports/open-decision-questions.md`
- `reports/architecture-decision-proposal.md`
- `plans/first-private-vertical-slice.md`
- `decisions/2026-08-16-web-first-shared-ui-readiness.md`
- `../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`

행동:

- 현재 스택을 최대한 활용하는 옵션을 우선 제시한다.
- Web+Android를 완전히 별개로 재구축하지 않는다.
- 확정된 Astro/React + Capacitor, app-private filesystem + DB metadata, 보수적 legacy 이전을 입력 조건으로 사용한다.
- 첫 Vertical Slice와 단계별 마이그레이션 ExecPlan을 작성한다.
- 최소 catalog adapter와 본격 catalog ingestion을 분리하고 Phase 3 이후 실제 실행 순서를 제안한다.
- 승인되지 않은 범위의 대규모 구현을 시작하지 않는다.

> **Phase 3 이후 순서 주의:** 아래 번호는 audit 이전 runbook의 작업 묶음이지 승인된 실행 순서가 아니다. 현재 실행 순서는 `catalog cover identity/revision → CATALOG_COVER vertical slice → Title projection/Title Hub → My Titles dual view → Web gate → Android 적용`이다. Remote migration, local data 삭제, Public은 각각 별도 승인 대상이다.

### Phase 3 — 카탈로그 기반

읽기:

- `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Source Registry 템플릿

행동:

- 소스 승인 체계와 raw staging을 먼저 구현한다.
- 소규모 대표 표본으로 수집·정규화·중복·충돌·멱등성을 검증한다.
- 전체 대상 대량 수집은 표본 파이프라인과 승인 게이트 통과 후 진행한다.
- Private Slice에 필요한 최소 검색 adapter와 본격 ingestion은 서로 다른 마일스톤으로 계획한다.

### Phase 4 — Private Vertical Slice

읽기:

- `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

행동:

```text
Android Share Target 또는 Photo Picker
→ 작품 검색/PrivateTitle
→ 이미지 우선 Memory Card
→ LOCAL_ONLY 저장
→ Archive
→ Board
→ 선택 로그인
→ Web에서 동기화된 카드 확인
```

### Phase 5 — 이미지 클라우드와 UGC 기반

읽기:

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

행동:

- `LOCAL_ONLY / PRIVATE_CLOUD / PUBLIC`을 분리한다.
- 로그인만으로 이미지를 자동 업로드하지 않는다.
- Quarantine, 파일 검사, 권리 메타데이터, 신고·차단·심사·삭제·이의제기·감사 로그를 구현한다.
- Public 기능은 플래그 뒤에 둔다.

### Phase 6 — 제한적 Public 베타

행동:

- Generic UGC gate와 이미지 유형별 rights gate를 각각 확인한다.
- 시스템 디자인, 사용자 원본, 명확한 라이선스 이미지부터 검토한다.
- 애니 장면 캡처와 타인 팬아트는 별도 게이트 없이는 활성화하지 않는다.

### Phase 7 — QA, 베타, 운영

읽기:

- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- `08_CODEX_PHASE_RUNBOOK.md`

행동:

- 데이터 손실, 비공개 노출, 삭제 전파, 동기화, 신고 처리, kill switch를 E2E로 검증한다.
- 제품 지표와 안정성 지표를 분리해 계측한다.

## 6. Codex가 매 작업 전에 확인할 질문

1. 이 작업은 어떤 확정 결정과 연결되는가?
2. 필요한 참조 문서를 모두 읽었는가?
3. 현재 코드 상태를 파일과 실행 결과로 확인했는가?
4. 데이터 마이그레이션 또는 권리·개인정보 영향이 있는가?
5. 기능 플래그와 롤백 경로가 필요한가?
6. 어떤 테스트가 완료 조건을 증명하는가?
7. 이 작업이 새로운 제품 결정을 암묵적으로 만들고 있지 않은가?

## 7. 최초 사용자 행동

새 저장소에서 아직 감사하지 않았다면 Codex에 다음 파일의 내용을 첫 프롬프트로 전달한다.

```text
prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md
```

이 저장소에서는 local-only Card/Archive/Board, Android media boundary, catalog, account metadata sync, Web-first UI 기반까지 구현됐다. 최신 제품 방향은 `docs/moemoa/decisions/2026-09-03-title-hub-dual-view-and-catalog-cover.md`, UI는 `docs/superpowers/specs/2026-09-03-title-hub-dual-view-ui.md`, 실행 gate는 `docs/moemoa/plans/2026-09-03-title-hub-dual-view.md`, 현재 코드 차이는 `docs/moemoa/reports/2026-09-03-title-hub-code-conflict-audit.md`를 따른다.

카탈로그 후속 검토 수정: 게시 시 현재 제목 규칙 재대조, 모든 검색 별칭의 시즌 검사, 일반 기호 생략 검색을 반영했다. 4,224개 재검사에서 추가 4개를 검토 대상으로 보류했다. [후속 개선 보고서](docs/moemoa/reports/2026-09-07-catalog-identity-review-fixes.md)를 먼저 확인한다. 로컬 수정이며 미배포다.

추가 4개 검토 완료: 정상 번호 별칭 3건 유지, 퀸즈 블레이드의 모호한 별칭 1개 격리. 전체 검토 기록 36개/앱 AniList 별칭 35개. 4,224개 재검사에서 현재 제목 감지 미해결 0, 관련 ID 미보유 후보 40, 한국어 대기 7이다. 운영/원본 미변경. 상세: [4개 검토 보고서](docs/moemoa/reports/2026-09-07-catalog-four-title-reviews.md).
