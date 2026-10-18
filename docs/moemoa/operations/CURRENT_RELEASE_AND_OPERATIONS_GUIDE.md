# MOEMOA 현재 개발·운영·법적 준비 안내

**2026-10-19 최신:** 승인981d13e의 Git/Vercel 운영 배포와 신고 함수 migration20261018090000 적용·독립 readback을 완료했다. [실제 운영 보고](../reports/2026-10-19-partial-privacy-report-production-application.md). 별도로 약관·개인정보·가입/계정 화면에 첨부 법률 검토의 처리 설명과 권리 요청 절차를 반영한 로컬 후보를 준비 중이다. 새 고지는 운영에 아직 배포하지 않았고, 과거 수락 문서·가입 tuple·공개 revision은 유지한다. 아래 ‘운영 미반영’은 이전 시점 기록이다.

**2026-10-19 신고 오류 운영 후보 후속:** 정확 후보 `981d13e` 준비 완료. 운영 DB에는 수정 전 신고 함수가 남아 있고 migration20261018090000이 없다. master/www a65f557 일치를 새로 확인했다. [후보·8항 보고·복귀 절차](../reports/2026-10-19-partial-privacy-report-production-candidate.md)를 준비하며 운영 쓰기·배포는 하지 않았다. 최신 후보 SHA/다음 게이트는 기존 작업판 현재 카드를 따른다. 아래10/18 기준의 다른 운영·법적·키 안내는 그대로 유지한다.

기준일: **2026-10-18**. 이 문서는 운영자가 읽는 요약·실행 안내다. 상태와 완료 증거의 원장은 [기존 단일 작업판](../release-v2/03_RELEASE_WORKBOARD.md#현재-작업-카드--새-파일-대신-이-위치를-갱신)이며, M0~M5/W01~W20/C01~C12/Q01~Q24/D01~D06을 그대로 사용한다. 새 기능 목록이나 새 출시 승인서가 아니다.

**같은 날 Pro 검토안 대조 보완:** [인수 보고](../reports/2026-10-18-pro-legal-operations-intake.md)에 실제 신고/보존 결함과 정책·자동화 제안을 분리했다. 이번 보완은 내부 문서이며 운영·기존 수락 문서·회원 범위는 그대로다.

**같은 날 신고 결함 로컬 수정:** W09/W14 후보 a6a63b6으로 부분 비공개 후 신규 신고 실패를 재현·수정했고 격리 SQL·함수 복귀 검사를 통과했다. [결과/적용 범위](../release-v2/01_RELEASE_EXECUTION_PLAN.md#w09w14-df-01--실행-8항-보고). 운영에 반영됐다는 뜻은 아니며 현재 운영 SHA는 아래 기존 값이다.

**후속 테스트 적용 완료:** 정확 승인을 받아 moemoa-test에 신고 함수1개/이력만 반영하고 독립 연결의 정의·권한·설정 보존을 확인했다. [실제 적용 근거](../release-v2/evidence/2026-10-18-partial-privacy-report-test-application.json). 운영 사이트·DB·배포는 그대로이며 hosted UI 신규 신고 검사는 이번 범위가 아니다.

## 1. 지금 어디까지 됐나

**첫 Public Web 출시는 운영 반영된 상태다.** 남은 표의 VERIFY는 모든 경계 조건까지 검증했다는 뜻으로 DONE을 쓰지 않았기 때문이며, 핵심 기능이 모두 미구현이라는 뜻이 아니다.

| 구분 | 확인된 현재 상태 |
| --- | --- |
| 운영 웹 | [www.moemoa.xyz](https://www.moemoa.xyz/) — master와 실제 build-info 모두 `a65f557e84659a0638ee44a8c4a911173dd554b2`, source `vercel-git` |
| 개인 기록 | 작품 저장·시청 상태·별점·감상 기록·재시청, Memory/Archive/Board, 로그인 계정 동기화 구현. Guest 기록과 사진/원본 백업의 범위는 다름 |
| 공개 기능 | 공개 이미지·보드·미니홈·팔로우/재방문·신고·관리자 가림/복구·철회 필수 운영 흐름 인수 완료. 10/13 컬렉션 연결, 10/14 화면/이동 개선 추가 반영 |
| 가입 범위 | 한국 14세 / 미국 13세 / 태국 13세 이상 현행 승인 유지. 필리핀·EU/EEA·영국·스위스는 확장 후속이며 현재 활성으로 표시하지 않음 |
| 플랫폼 | 첫 출시 Web. Android는 별도 배포 작업. 추가 Safari·실폰 오프라인 검사는 사용자 제외를 유지하며 PASS로 바꾸지 않음 |
| 백업 | 주간 증분 예약 설치에 이어 **첫 실제 schedule 실행과 capture 단계 성공**까지 확인 |
| 기존 복구 | 외부 증분 회수·격리 DB 99테이블/7확장·최신 삭제/권리 대조·복구키 독립 보관 확인은 이미 완료. 전체 앱/Storage HTTP 복구 훈련은 별도 잔여 |

현재 소스와 과거 역할 검사의 범위를 혼동하지 않는다. 공개 역할 검사는 `ea8f388`, 컬렉션 운영 연결은 `5d544ad`, 최신 UI 운영 인수는 `a65f557`의 각각의 근거를 보존한다. 10/18에는 읽기만 수행했으며 새로운 로그인·게시·철회·배포 검사를 했다고 주장하지 않는다.

근거: [10/14 UI 운영 인수](../reports/2026-10-14-production-ui-navigation-release.md), [공개 역할·용량 근거](../release-v2/evidence/2026-10-11-public-capacity-closeout.json), [복구 근거](../release-v2/evidence/2026-10-10-external-backup-recovery.json), [10/18 조회 결과](../release-v2/evidence/2026-10-18-scheduled-operations-observation.json).

## 2. 이번에 마감한 문서상 다음 작업 — W17/D05

| 대상 | 이번 실제 조회 |
| --- | --- |
| 주간 백업 | [39065955924](https://github.com/Newrred/anime-collector/actions/runs/39065955924), event=`schedule`, 완료 SUCCESS |
| 실제 처리 단계 | `Capture encrypted delta and commit authenticated checkpoint` SUCCESS, skipped 아님 |
| 실행 시각 | 10/18 **05:15:40~05:20:18 JST/KST**. 설정 예정은 일요일 03:00, 이번 시작 지연은 2시간 15분 40초 |
| 이미지 정리·용량 갱신 | [39096810474](https://github.com/Newrred/anime-collector/actions/runs/39096810474), schedule SUCCESS, 실제 cleanup/refresh 단계 SUCCESS. 직전 예약도 성공 |
| 카탈로그 health | [39084974960](https://github.com/Newrred/anime-collector/actions/runs/39084974960), schedule SUCCESS. 이 항목은 run metadata만 확인 |
| 운영 소스 | GitHub master와 [운영 build-info](https://www.moemoa.xyz/build-info.json)의 commit/checkoutCommit 일치 |

백업은 **매주 새 DB dump와 신규·변경 이미지로 암호화 증분 패키지를 만드는 방식**이다. DB 자체는 매번 dump하고, 공식 표지·기존 개인 사진 bytes를 매주 Supabase에서 전량 다시 받지는 않는다. 기준 ZIP과 진행 이력을 Drive에서 읽는 비용 및 실행 비용은 여전히 생긴다. 승인된 새/변경 이미지 처리 상한은 실행당 64MB이며, 이번 실제 전송량이나 Drive ZIP 본문은 읽지 않았다. 성공한 한 번의 예약은 미래의 무중단 실행 또는 복구 성공 보장이 아니다.

예약 시각은 정확한 시작 보장이 아니다. GitHub는 혼잡 시 schedule 지연/누락 가능성과 공개 저장소의 60일 무활동 시 예약 비활성화를 설명한다. 따라서 시간만 믿지 않고 실행 이력을 확인한다. [GitHub 공식 schedule 안내](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

소스: `.github/workflows/moemoa-weekly-backup.yml:4–8,83–109`, `tools/operations/run-weekly-backup.mjs:65–103`. 승인된 목표는 **RPO 7일 / RTO 24시간**이다. 이는 목표이며 실제 달성 보장은 아니다. 자동으로 기준 사본/부모 증분을 삭제하지 않는다. 과거의 일일 전체 백업·7일 삭제 제안을 현재 정책으로 다시 적용하지 않는다.

## 3. 남은 개발과 일정

아래는 1인 개발자의 **집중 작업일 예상치**다. 사용자 확인·외부 서비스 대기와 새로 발견되는 결함은 제외한다. 이미 출시된 서비스를 다시 출시 대기로 돌리는 일정이 아니다.

| 우선순위·기존 ID | 남은 일 / 완료 기준 | 예상 |
| --- | --- | --- |
| 다음 1개 · W09/W14, Q12/Q17 | 공개 보드에서 카드1개를 비공개로 바꾼 뒤 남은 공개물의 신규 신고가 막히는 조건 불일치. 새 신고자·operation으로 격리 재현 후 대상 판정만 수정 | 첨부 예상0.5~1일; 운영 재현/적용은 미실행 |
| 삭제 정리 · W06/W17, D05 | 과거 동기화 응답 본문 scrub은10/10 로컬12검사·test-only 적용까지 완료. 현재 운영 함수/대상 집계를 확인하고 기존 후보의 정확한 반영 범위를 준비. ACK·hash·버전 보존 | 기존 구현 재작성0; 운영 상태 확인 후 적용 견적 |
| 기존 사진 문제 · W06/W18, Q01/Q03/Q10 | 기존 개인 사진 로딩 실패를 현재 소스에서 재현. 로컬 원본/계정 사본/권한·URL/복귀 상태 중 실제 실패 지점을 특정하고 발견한 부분만 수정. 재업로드·삭제로 덮지 않음 | 원인 진단 1~2일, 수정은 원인 확인 후 산정 |
| 표시 정정 · W15/W18, C09 | 관리자 전역 이미지 전송2항목을 ‘계정별’로 표시하는 오류. 범위 라벨만 수정하고 KO/EN·좁은 화면 확인 | 작은 UI 후보; 실제 한도 변경0 |
| 운영 보호 · W03/W17, Q22 | GitHub `master` 조회가 `protected:false`. 현재 Service quality 필수 검사·강제 push/삭제 방지의 정확한 설정 후보 준비. 1인 개발에서 불필요한 타인 승인 의존은 만들지 않음 | 후보 준비·검증 0.5일; 원격 설정은 별도 승인 |
| 고지·대응 · W14/W17, D04 | 아래 4절의 국외 처리 안내 항목과 긴급 이미지 신고·권리/삭제·이의 처리 절차를 현행 지원 동선에 결속. 고정 동의 문서는 덮어쓰지 않고 필요한 개정 후보로 준비 | 1~2일; 적용 범위 판단/외부 확인은 별도 |
| 경보 · W15/W17, D03/Q19 | 기존 실패 알림 수신은 완료. 새 용량 임계 경보의 전달 경로와 누락 감지 확인, 실제 경보 검사가 필요하면 정확한 대상으로 한 번만 수행 | 0.5~1일; 고의 외부 알림은 현재 미승인 |
| 복구 훈련 · W17, D05/Q14/Q20 | 이미 복원한 DB 검사를 반복하지 않고 격리 앱+Storage HTTP까지 이어 공개/비공개·최신 철회/삭제가 재노출되지 않는지 확인 | 2~4일, 격리 환경 필요 |
| 영향 있는 경계 검증 · W18/W19 | 변경과 관련된 OAuth 만료/거절 복귀, 큰 batch/cursor, 다중 공개 위치/캐시, 접근성·입력 보호만 선택 검증 | 3~5일; 전수 테스트 무조건 반복 금지 |
| 실제 수정본 반영 · W20/D06 | 수정된 파일만 후보 고정→필요 검사→정확 후보 승인→master Git→Vercel/실제 SHA 확인 | 배포 1회당 0.5~1일 |
| 별도 후속 · W16/Q21 | 새 카탈로그 후보 게시/복귀와 전체 ingestion history 복구는 실제 갱신·복구 작업이 필요할 때 수행 | 해당 범위 확정 후 산정 |
| 별도 출시 · D02 | Android 최신 공통 코드/네이티브 이미지 수집·Share Target·패키지/배포 차이 대조 | Web 잔여와 분리해 먼저 0.5~1일 범위 산정; 현재 출시일 미확정 |

**권장 순서:** 신고 경로 재현·최소 수정 → 기존 삭제 응답 정리 후보의 운영 차이 확인 → 사진 문제 진단·작은 라벨 수정 → 운영 보호·고지 후보. 복구 훈련과 추가 경계 검증은 별도 안정화 묶음으로 진행한다. 모든 행을 새 출시의 일괄 선행조건으로 만들지 않는다. Pro의 대형 관리자·자동메일·8주 홍보 계획은 제안이며 이번 잔여에 일괄 추가하지 않는다.

기존 기술 부채(Astro 정적 진단, React Doctor 기존 경고)는 해당 파일을 고칠 때 영향을 좁혀 다룬다. 과거 오류 수를 이번 새 실패로 세거나 전부 고쳐야 운영을 계속할 수 있다고 해석하지 않는다. 현재 로컬 준비 검사는 단위631/build33 PASS이며, 이 문서 작업 때문에 재실행하지 않았다.

## 4. 법적 준비 — 현재 운영과 확장을 구분

이 표는 2026-10-18 공식 자료와 현재 코드의 대조다. 모든 국가의 법률 적합성이 인증됐다는 문서가 아니다. 이미 정한 연령·국가·이미지 범위를 바꾸거나 전원 본인인증/보호자 메일을 되살리지 않는다. 생년월일 자기신고는 본인·보호자 신원 인증이 아니다.

### 지금 운영에서 준비할 것

| 항목 | 현재 있는 것 | 남은 구체적 작업 |
| --- | --- | --- |
| 운영자·지원 연락 | 약관/개인정보 안내·신고 UI·운영자 계정 | 실제 담당자/연락처가 맞는지 확인하고 접수→판단→조치→통지→이의 처리 순서를 내부 매뉴얼에 확정. 채팅/공개 Git에 신고 원문·사진을 복사하지 않음 |
| 국외 처리 안내 | Supabase/Vercel 처리 위치와 암호화 Drive 백업 설명 | Vercel의 이미지 본문 변환·전송과 GitHub runner의 암호화 전/복호 중 DB·이미지 처리도 고지 후보에 추가. 제공처 법인/연락·실제 국가·목적·항목·보관·이전 근거 대조. sin1/ubuntu가 모든 처리 국가를 뜻하지 않음 |
| 공개 이미지 권리 | 공개 동의 한 번·신고·차단·관리자 조치·철회 | 저작권 중단/통지/이의, 적용되는 국내 임시조치와 반복 침해 방침을 구분. 직접 제작 표시가 포함된 제3자 권리 해결을 보증하지 않음. 계정 해지·자동제재는 새 정책 후보 |
| 긴급 비동의 성적 이미지 | 성인용 공개 금지·일반 신고 기능 | 미국 TAKE IT DOWN Act의 covered platform 해당 여부와 기존 접수 수단을 대조. 해당하면 유효한 요청의 48시간 내 삭제 및 알려진 동일 사본 대응, 접수 안내가 필요. 전원 인증을 추가하는 문제가 아니라 긴급 처리 절차/동선 점검 |
| 아동 관련 실제 인지 | 중립 DOB·지역별 최소 연령 정책 | 일반 서비스의 13세 이상 표기만으로 모든 COPPA 의무가 없어지는 것은 아님. 실제 연령 미달 사용 인지 또는 아동 대상 운영으로 바뀌는 경우를 구분해 담당자가 대응. 애니 서비스라는 이유만으로 일괄 아동 대상이라고 단정하지 않음 |
| 개인정보 요청·사고 | 탈퇴·삭제/보존·신고·감사 구현과 안내 | 열람/정정/삭제/철회 요청의 본인 확인 최소 절차, 적용 데이터/보존 예외/처리 결과 기록. 유출 시 적용 법의 통지·신고 조건/기한을 별도로 판단; 모든 사고를 무조건 72시간으로 통일하지 않음 |
| 무료 호스팅 조건 | 현재 무료 유지·자동 결제 없음 | Vercel Hobby 개인/비상업 이용 조건과 실제 서비스 사용 대조. 일반 약관의 DPA 편입과 별도 DPA의 Pro/Enterprise 범위 차이는 미확정. 유료 필수/위법으로 단정하거나 취소한 외부 문의를 다시 보내지 않음 |

공식 근거:

- 한국 국외 이전은 동의 외에도 법정 조건을 충족한 계약 이행 목적의 위탁·보관 등 근거가 있으므로, 새 체크박스부터 늘리지 않는다. [개인정보 보호법 제28조의8](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1020398611), [개인정보보호위원회 국외 이전 안내](https://m.pipc.go.kr/np/default/page.do?mCode=D060040000).
- 개인 운영자는 법인 설립 여부와 별개로 개인정보 처리 책임을 정리해야 한다. 규모/요건을 따져 책임자 지정과 본인 수행 가능 여부를 확인한다. [개인정보 보호법 제31조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1033215381), [관련 시행령](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1029332521).
- 저작권 중단/재개 요청 및 연락 수단은 적용되는 온라인서비스제공자 의무에 맞춘다. [저작권법 제103조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029423165).
- 미국 비동의 성적 이미지 요청 처리 의무는 2026-05-19 시행됐다. [FTC TAKE IT DOWN Act 집행 안내](https://www.ftc.gov/business-guidance/blog/2026/05/take-it-down-act-enforcement-starts-now-what-know-about-ftc-tida). 현재 저장소에서 이 법의 전용 절차/48시간 처리 근거는 확인하지 못했으며, 일반 신고 구현을 곧바로 충족으로 세지 않았다.
- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions). 일반 대상 서비스의 중립 age screen과 실제 인지/아동 대상 서비스 판단은 구분한다.
- [Vercel 약관 §4/§10](https://vercel.com/legal/terms), [DPA 적용 범위](https://vercel.com/legal/dpa). Data Preferences의 모델 학습 opt-out 설정은 이번에 조회하지 않았다. 공급자 설명은 코드·개발 대화·빌드 데이터 등의 범위이며, 사용자 사진이 학습된다고 추정하지 않는다. [2026-03 변경 안내](https://vercel.com/changelog/updates-to-terms-of-service-march-2026).

### 권리·긴급 신고 접수와 수동 조치 절차 — 2026-10-19 보완

1. 기존 운영자 계정과 지원 주소 `godburgundy@gmail.com`에서 접수하고 기존 관리자 신고 목록/조치 기능을 연결한다. 최초 수신 시각·한국법상 인지 시각·TIDA 유효 요청 수신 시각, 대상 URL/ID·유형·회신 수단·담당을 제한된 지원 기록에 구분해 남긴다. 공개 Git/작업판에는 비식별 사건 ID/상태만 남긴다. 새로운 접수 자동화나 자동 회신은 없다.
2. 개인정보·저작권·비동의 성적 이미지·일반 운영 신고를 구분한다. 급한 위해/성적 이미지 건은 일반 검토 대기열에 방치하지 않는다.
3. 적용 법의 유효 요청 요건을 확인한다. 미국 해당 요청은 본인/위임자의 물리·전자서명, 대상 이미지 식별·위치, 동의 없는 게시라는 선의의 진술 및 관련 정보, 연락수단을 포함한다. **가능한 한 빨리, 법정 요건을 갖춘 요청을 받은 시각부터 최대48시간**이며 내부 심사 완료 때부터 세지 않는다. 기존 연락 수단으로 접수하고 불필요한 신분증·피해 이미지 재업로드를 기본 요구하지 않는다.
4. 승인된 관리자 기능으로 해당 공개물에 조치하고, 미국 해당 요청은 **같은 기간에** 알려진 동일 사본을 식별·제거하기 위한 합리적 조치를 취한다. 한국의 적용 사업자가 불법촬영물 등의 유통을 인지한 경우 지체 없는 조치를 별도로 추적하며 미국 요청서 보완을 기다리는 유예로 쓰지 않는다. 개인 원본/다른 정상 게시물을 일괄 삭제하지 않는다. HIDE 한 건과 모든 객체/사본 제거·통지 완료는 다르므로 미해결 경로를 남긴다. [TIDA 원문 §3](https://www.govinfo.gov/content/pkg/PLAW-119publ12/html/PLAW-119publ12.htm), [전기통신사업법 제22조의5](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029562969).
5. 정보통신망법44조의2 적용 요청은 신청인·게시자에게 조치 사실을 즉시 알리고, 불필요한 신고자 정보 없이 다른 이용자에게 필요한 조치 사실을 알린다. 판단이 어렵거나 분쟁이 예상돼 하는 임시조치는 시작·종료(최대30일)와 종료 전 소명/후속 판단을 기록한다. 모든 신고의30일 응답기한이나 자동복원 타이머로 해석하지 않는다. 기존 HIDE가 이 통지·공시·기한 관리를 자동으로 수행하지 않으므로 수동 누락을 점검한다. [법령](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029562697).
6. 대상 페이지·공개 이미지 경로·알려진 동일 사본의 처리 시각/범위/근거와 미해결 경로를 기록한다. HIDE만으로 모든 이미지 접근/사본 제거가 끝났다고 쓰지 않는다. 이의제기만으로 자동 복원하지 않으며 최신 철회·제재·별도 위법/안전 사유를 확인한다. 백업 복원에도 최신 삭제·철회 내역을 적용한다.
7. 유효한 TIDA 요청의48시간 기한은 내부 검토나 보완 문의로 재시작하지 않는다. ‘긴급 신고’ 제목, 경찰 신고, 저작권 소유 증명, 피해 이미지 원본 재첨부를 접수의 공통 필수 조건으로 만들지 않는다. 본인/대리권 확인은 요청에 필요한 최소 범위로 제한한다.
8. 개인정보 요청은 부분 삭제/정정/열람/처리정지/계정 전체 종료를 구분한다. 한국 해당 요청의10일 제공 또는 결과·지연/거절 사유 통지와 태국 접근/사본 요청의 지체 없이 최대30일 등 적용 기한을 사건별로 기록한다. 이를 모든 백업의 물리 삭제 기한으로 확대하지 않는다. [한국 시행령41조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900081146), [43조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900077157), [태국 정부 공개 법문/영어본은 비공식 번역](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-).

이 절은 서비스 고지 후보와 대응하는 **수동 운영 절차**다. 실제 긴급 접수·양측 통지·동일 사본 제거를 이 세션에서 실행하거나 검증한 것은 아니며, 담당자의 수신 확인과 기한 관리가 필요하다. 새 자동 메일·알림·사건 DB·대신 발송을 설치하지 않았다. 법정 저작권 수령인 공시, 반복 침해 계정 종료의 적용 기준/실행, 국외이전 필수표와 각 보관 종료 기준은 D04 잔여다. 최신 사실 고지는 기존 고정 수락 원문/receipt를 보존하는 별도 안내로 구현한다.

### 국가별 후속과 확장·수익화 조건

| 조건 | 후속 판단 |
| --- | --- |
| 필리핀 활성 | 13세 목표 유지. 나이 등 민감정보 처리의 근거·동의 주체, 아동 대상 투명성·권리 절차를 목적별로 확정. 자동으로 18세로 올리지 않음. [법률](https://privacy.gov.ph/data-privacy-act/), [NPC 아동 투명성 지침](https://privacy.gov.ph/wp-content/uploads/2024/12/Advisory-2024.12.17-Guidelines-on-Child-Oriented-Transparency-w-SGD.pdf) |
| EU/EEA·영국·스위스 활성 | 실제 대상성, 적용 연령/처리 근거, 대표자·연락처 필요성과 예외, 공개 UGC 절차를 정리. GDPR 동의 연령을 모든 계약의 가입 나이로 대입하지 않음. [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), [UK 대표자 안내](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/receiving-personal-information-from-the-eea/), [EU DSA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2065). 스위스는 별도 적용 검토 |
| 태국 현행 범위의 정밀 후속 | 13세 결정을 유지하면서 PDPA §20의 미성년자 행위/동의 조건, 국외 이전·외국 처리자 대표 요건/예외를 실제 목적에 맞춰 확인. [태국 MDES 공개 법문 자료](https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-)의 영어본은 비공식 번역이며 현행 하위 규정 전체 검토 완료가 아님 |
| 미국 지역별 서비스 확대/성격 변경 | 소셜 서비스의 주별 정의·예외·현행 집행 범위가 달라 연방 13세만으로 모든 주의 결론을 내리지 않음. 우선 현재 공개 기능의 실제 적용성을 좁혀 검토; 임의 국가 축소/전원 인증 없음 |
| 미국 DMCA 면책 체계 이용 | DMCA 지정 대리인 등록·연락처·정책·통지 절차의 실제 요건 검토. 모든 무료 사이트의 보편적 유료 개설 허가로 취급하지 않음. [Copyright Office FAQ](https://www.copyright.gov/dmca-directory/faq.html) |
| 광고·유료 결제·판매 시작 | 사업 형태별 사업자 등록/세무, 통신판매 해당 여부와 면제, 환불/결제 고지, 공급자 요금제 조건을 검토. 무료 사이트 개설만으로 모두 의무라고 단정하지 않음. [국세청 사업자등록 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7776&mi=2300) |

현행 코드 근거: `src/features/auth`의 가입 정책과 [고정 약관](../../../src/pages/legal/terms-2026-10-10.astro)/[개인정보 경로](../../../src/pages/legal/privacy-2026-10-10.astro), [공개 안내](../../../src/pages/legal/public-sharing-2026-10-11.astro). 고정 법률 문서가 재사용하는 실제 본문 컴포넌트와 처리 코드는 아래 7절에서 찾는다.

## 5. 운영자가 계속 관리할 것

아래는 수동 운영 루틴 권장안이다. 새로운 예약·메시지 발송을 설치하지 않았다.

| 주기 | 확인할 것 | 정상/문제 발생 시 행동 |
| --- | --- | --- |
| 매일 짧게, 긴급 신고는 수신 시 | 지원/신고함·공개 이미지 검토·권리/삭제 요청 | 긴급 유형 우선, 대상/사유/시각 기록. 불필요한 사진/개인정보 수집 없이 해당 공개 범위만 조치 |
| 매일 | 로그인·저장/동기화·이미지 실패, 정리/용량 workflow | 최근 성공과 **실제 처리 단계** 확인. 실패 때 동일 입력으로 무한 재시도·원본 삭제 금지 |
| 매주 백업 예정 이후 | schedule 실행, capture success, checkpoint 완료·chainLength | 이번처럼 지연 가능. 부모 체인 길이16이면 새 기준 사본이 필요해 중단하므로 도달 전에 후보 준비. 현재 길이는 이번에 미조회. 누락/실패면 마지막 정상 지점부터 확인; 부모 증분/기준 ZIP/키 임의 삭제 금지 |
| 매주 | 사용량 추세·무료 한도·반복 신고/같은 오류 | 현재 승인 한도 유지. 증가 원인을 확인하고 확대/유료 전환은 정확 후보로 결정 |
| 매월 | GitHub/Vercel/Supabase/Drive 접근자·OAuth 연결·약관 변경·계정 복구 수단 | 불필요 접근 회수 후보, 공급자 상태와 알림함 확인. 증거 없이 모든 키 재발급하지 않음 |
| 큰 migration 전 또는 정한 점검 주기 | 격리 복구 훈련·삭제/철회 반영 | 실제 앱/Storage로 읽기 확인 후에만 복구 serving 인수. 운영에 복원물을 바로 연결하지 않음 |

승인된 보호값은 **비공개 사본 전역 저장 100MB·월 전역 전송 500MB**, 공개 사본 전역 20MiB, 공개 요청 하루 2,000GET/64MB, 전체 저장량 980MB 경보다(D03). **사용자 한 명의 한도나 현재 사용량 실측값이 아니다.** 공개 요청 한도에는 thumb/full 열람도 포함되므로 2,000명이 방문할 수 있다는 보장으로 읽지 않는다. 숫자를 늘리거나 경보를 고의 발생시키지 않았다.

백업에는 공식 표지·개인 사진·공개 사본과 DB/삭제 상태가 관련된다. 매번 같은 이미지 1GB를 Supabase에서 재다운로드하는 비용 구조와 증분 백업을 혼동하지 않는다. 백업 파일 증가, Drive 읽기, 실행환경 사용량은 별도로 관찰한다.

## 6. 환경과 키 파일 — 값은 이 문서에 넣지 않음

### 어떤 작업에 무엇이 필요한가

| 작업 | 최소 준비 | 필요 없는 것 |
| --- | --- | --- |
| 화면/문구/컬렉션 개발 | Git 소스, Node, 공개 catalog 설정, 로컬 실행 | 운영 DB 비밀번호·서버키·복구키 |
| test 로그인/동기화 화면 | test public URL/anon 설정, 본인 Google 로그인; 기존 preview 사용 시 승인 설정 확인 | 운영 서버키, 다른 PC 브라우저 세션 복사 |
| test DB/API 작업 | `.env.moemoatest.server.local`, 필요한 CA/대상 검증; API별 anon/서버 env 연결 | 운영 env 재사용 |
| 운영 DB 점검·정확 승인 migration | `.env.moemoaprod.server.local`, CA, version-controlled 도구/정확 대상 | 일반 화면 작업에 상시 admin 연결 |
| 가입 서버 설정 작업 | 대상 환경의 signup env 두 파일 + Supabase 서버 설정(URL/service role/anon), 또는 승인된 원격 설정 | 테스트 Google 키를 운영에 임의 재사용 |
| 백업 상태 확인 | GitHub Actions 이력만으로 우선 확인 | DB 비밀번호·복구키 꺼내기 |
| 격리 복구 실행 | 암호화 기준/증분/state, 해당 복구키, CA·복구 전용 환경 | 운영에 바로 import, 최신 삭제/철회 대조 생략 |

### 이 PC 파일 inventory (10/18 값 없는 확인)

경로는 저장소 루트 기준. `있음`은 파일/필수 항목 존재 확인이며 원격 로그인 유효성 검증이 아니다.

| 파일 | 용도·환경 | 상태/보관 |
| --- | --- | --- |
| `.env.development.local` | test 계정 backend + 운영 catalog 공개 읽기 | 있음/ignored. 두 역할이 다르므로 모두 test DB라고 부르지 않음 |
| `.env.local` | 운영 catalog의 공개 URL/anon | 있음/ignored |
| `.env.moemoatest.local` | test 계정 + test catalog와 flags | 있음/ignored |
| `.env.production` | 배포용 공개 설정·flags | **Git 추적 중**, 모두 `PUBLIC_` 항목. 관리자 비밀키를 넣는 곳이 아님 |
| `.env.moemoatest.server.local` | test DB 접속·service role·서버 설정 | 있음/ignored. 10/18 현재 사용자/SYSTEM 전용으로 ACL 제한 |
| `.env.moemoaprod.server.local` | 운영 DB 접속 구성·service role | 있음/ignored. 사용자/SYSTEM 전용 ACL |
| `.env.moemoaprod.signup.local` | 운영 Google client ID/secret | 있음/ignored. 사용자/SYSTEM 전용 ACL |
| `.env.moemoaprod.signup.runtime.local` | 운영 가입 cookie key/origin/enable | 있음/ignored. 사용자/SYSTEM 전용 ACL |
| `%USERPROFILE%\.moemoa\recovery-keys\moemoa-production-20261009.key` | 기존 암호화 백업 복구키 | 있음. 10/12 독립 보관 확인 근거 유지; 새 PC 로컬 사본의 존재와 독립 보관은 별개 |
| `%USERPROFILE%\.moemoa\recovery-keys\supabase-ca.crt` | DB TLS 신뢰 인증서 | 있음. 비밀번호는 아니지만 임의 인증서로 교체하지 않음 |
| `.cache/operations-private/supabase-ca.crt` | 일부 점검 도구가 쓰는 CA 경로 | 있음. 도구별 경로 확인 |
| `%USERPROFILE%\.moemoa\test-observation-20261011.key` | 과거 테스트 관측 인증 후보 | 있음. 현재 소비처 연결은 미확인; 운영 인증값으로 사용하지 않음 |

`recovery-keys` 안의 test/prod server env 보관 사본은 10/18 현재 저장소의 해당 두 파일과 내용 일치만 확인했다. 암호화 ZIP과 키가 같은 로컬 폴더에 있다는 사실만으로 PC 밖 독립 보관을 증명하지 않는다. 새 PC마다 모두 복사할 필요는 없다. 작업에 필요한 파일만 안전하게 옮기고 채팅·Git·공유 ZIP에 넣지 않는다.

**로컬 주의:** custom 이름의 server/signup env는 단순히 존재한다고 Astro/API가 모두 자동으로 읽지 않는다. 실행 도구가 그 파일을 명시적으로 읽는지 확인한다. 현재 server env에는 `SUPABASE_ANON_KEY`가 없으며 일부 API backend가 이를 추가 요구한다. 화면 개발 준비 완료를 모든 로컬 서버 API 준비 완료로 확장하지 않는다. 카탈로그 업로더는 별도 `MOEMOA_SUPABASE_SERVICE_ROLE_KEY` 이름을 사용한다.

### PC로 가져오지 않아도 되는 원격 비밀 설정

아래는 workflow/서버 소스가 참조하는 **이름 목록**이다. 이번에 원격 값이나 설정 전체를 읽고 인증한 것은 아니다.

| 보관 위치 | 이름/용도 |
| --- | --- |
| GitHub 환경 `moemoa-backup` | `MOEMOA_BACKUP_DRIVE_CLIENT_SECRET`, `MOEMOA_BACKUP_DRIVE_REFRESH_TOKEN`, `MOEMOA_BACKUP_DATABASE_URL`, `MOEMOA_BACKUP_STORAGE_KEY`, `MOEMOA_BACKUP_CA_PEM`, `MOEMOA_BACKUP_RECOVERY_KEY` |
| 같은 환경의 일반 변수 | `MOEMOA_BACKUP_DRIVE_CLIENT_ID`, `MOEMOA_BACKUP_DRIVE_FOLDER_ID`, weekly/manual 실행 스위치. 실제 승인된 주간/수동 구분 보존 |
| GitHub 유지보수 ↔ Vercel | `MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET` 양쪽 일치 필요. test 전용 값과 구분 |
| GitHub `moemoa-test-cleanup` | `MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY` — 테스트 대상만 |
| Vercel Production / Preview `codex/phone-test` | DB/API·Google OAuth·signup cookie 설정을 환경별로 구분. preview 테스트 승인으로 운영 변경을 승인한 것으로 간주하지 않음 |

GitHub secrets는 다시 내려받아 읽는 보관함이 아니다. 새 PC는 각 서비스에 본인 로그인하고, 없는 값이 실제 작업에 필요할 때만 원래 안전 보관처에서 복구한다. 브라우저 로그인 쿠키·다른 PC 세션을 복사하지 않는다. Drive 백업 OAuth의 로컬 원본은 이번 제한된 경로 inventory에서 발견하지 못했지만, 주간 실제 실행 성공을 보면 이번 백업 연결은 동작했다. 무조건 새 OAuth를 만들 이유가 없다.

키 교체는 노출·접근자 변경·공급자 폐기/만료 등 이유가 있을 때 소비처 목록과 함께 한다. DB 비밀번호→백업 DB URL, Storage 서버키→API/백업, 정리 secret→GitHub/Vercel 양쪽을 함께 계획한다. 복구키를 교체하더라도 옛 백업을 여는 기존 키를 버리지 않는다. 값 대신 파일 위치·대상·마지막 확인일·담당자만 관리한다.

## 7. 근거와 재개 지점

- 실제 작업/승인/검증 원장: [release-v2/03](../release-v2/03_RELEASE_WORKBOARD.md). 계획: [release-v2/01](../release-v2/01_RELEASE_EXECUTION_PLAN.md). 계약: [release-v2/02](../release-v2/02_ACCEPTANCE_CONTRACTS.md).
- 제품 현재 흐름: [CURRENT_STRUCTURE_AND_FLOW](../CURRENT_STRUCTURE_AND_FLOW.md). 과거 설정 지도는 작성 날짜의 snapshot이며 운영 현행으로 자동 재사용하지 않는다.
- 계정/catalog 분리: `src/lib/supabaseClient.js:4–5`, `src/features/catalog/catalogSupabaseClient.js:4–8`.
- 서버 env 요구: `src/server/privateImages/supabaseBackend.js:21–28`, `src/server/publicImages/supabaseImageBackend.js:35–43`, `src/server/accountDelete/backend.js:8–22`, `api/signup.js:4–14`.
- 가입 본문/처리 근거: `src/components/legal/Terms20261010.astro:22–41`, `src/components/legal/Privacy20261010.astro:30–43,52–89`, `src/features/auth/simpleSignup.js:7–15,33–51,68–71`, `src/server/signup/backend.js:7–8`.
- 백업/CA 도구: `tools/operations/inspect-retention.py:22–47`, `tools/operations/capture-daily-backup.py:28–36`, `tools/operations/prepare-daily-backup.mjs:110–118`. daily 도구의 존재를 현재 daily 예약으로 읽지 않는다.
- 앞선 W17/D05 예약 관찰에서는 문서/증거 정리와 로컬 test server env 한 파일의 ACL 제한을 수행했다. 원래 ACL은 ignored `.cache/pc-handoff-20261018-test-server-acl.sddl`에 보존했으며 키 내용은 변경하지 않았다. 뒤이은 Pro 검토안 인수는 내부 문서 정정만 했고 앱·DB·운영 설정·ACL을 추가 변경하지 않았다.

**다음 행동 하나:** W09/W14 DF-01 운영 현행 함수/이력부터 읽기 대조하고, 테스트 반영한 a6a63b6의 해당 수정만 정확 운영 후보로 준비한다. 현재 테스트 적용 승인은 운영 쓰기/master push 권한이 아니며 새 정확 승인 전 수행하지 않는다. W06/W18 개인 사진 진단과 기존 다른 잔여는 보존한다.
