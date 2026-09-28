# 비공개 사진 로딩 실측 — 2026-09-28

## 범위와 방법
사용자 요청으로 실제 로그인된 PC Chrome에서 테스트 배포 4481ce2를 확인했다. 계측 query photoTiming=1에서만 단계·시간을 출력한다. 개인정보/사진/토큰/자산 식별자는 본 보고서에 저장하지 않는다. 코드 근거는 createPrivateImageTransfer.js, platformPrivateImages.js, server/privateImages/handler.js 및 supabaseBackend.js. ExecPlan은 release-v2/01_RELEASE_EXECUTION_PLAN.md의 사진 표시 지연 계측 항목이다.

## 결과 (ms)
| 동작 | 사진 준비(페이지 시작 기준) | 사진 조회 전체 | policy HTTP | 서버 로그인 확인 | 서버 정책 RPC | 캐시 검증 |
|---|---:|---:|---:|---:|---:|---:|
| 첫 상세 진입 | 3515 | 1174 | 1166 | 620.2 | 309.2 | 4 |
| 상세 새로고침 | 1337 | 851 | 843 | 278.8 | 283.0 | 4 |
| 작품 목록 진입 | 4457 | 1303 | 1297 | 282.0 | 785.2 | 2 |
| 뒤로가기로 상세 복귀 | 1810 | 1453 | 1444 | 364.5 | 835.4 | 4 |

모두 cache hit. 사진 binary GET 없음. photo-ready는 컴포넌트에 전달 가능한 Blob이 준비된 시점이며 paint/decode 시간 자체가 아니다. 별도 DOM 확인에서 실제 이미지 decode 완료를 확인했다. 첫 상세는 사진 조회 이전 약2341ms, 뒤로가기는 약357ms도 소요됐다. 이 구간에는 문서/JS 초기화 및 계정/카드 준비가 포함되며 세부 분해는 아직 안 했다.

## 판단
캐시 처리 자체는 2~4ms로 병목이 아니다. 캐시 사용 전 매번 완료를 기다리는 policy 요청이 반복 진입 지연의 주된 측정 원인이다. 서버는 auth.getUser 뒤 정책 RPC를 직렬 호출한다. server timing에는 Supabase 왕복과 서버 처리가 함께 포함되므로 DB 쿼리 자체가835ms 걸렸다고 단정할 수 없다. 네트워크/리전/콜드스타트 각각의 기여도는 아직 미측정이다. 전체 로딩을 단순히 권한 확인 때문이라고 설명한 기존 답변은 불완전하다.

## 변경·검증·남은 작업
계측 코드만 추가해 preview Git 배포. 서버 권한/정책/캐시 동작을 변경하지 않았다. unit407 PASS, build19 PASS. DB/데이터 migration 없음. 진단 query 제거 시 브라우저 로깅 비활성화, 코드 revert로 복구 가능. 계정/내용/파일명/bytes/token 로그 없음. PC 단일 세션4회 표본이며 iPhone/운영 서비스 대표 통계가 아니다.

후속 개선은 서버와 DB 위치/왕복 시간 확인, 중복 로그인 검증 최적화, 문서 전환 시 계정/카드 초기화 반복 축소다. 서버 검증 전 무조건 캐시 표시로 바꾸면 철회/삭제 반영 특성이 달라지므로 그 절충을 명시해야 한다. 이번 요청에서는 속도 수정 완료를 주장하지 않는다.

## 후속 수정 및 실제 검증 — 2026-09-28 16:13 KST
- 기존 Vercel Functions 설정은 iad1, 테스트 Supabase Primary Database는 ap-southeast-1임을 관리 화면에서 확인했다. `vercel.json:4`의 regions를 sin1로 지정하여 preview Git 배포6d7e784에 반영. 공개 HTTP 진단에서도 x-vercel-id의 실행 지역 sin1 확인. 전역 설정/운영 master는 변경하지 않았다. [Vercel regions 설정](https://vercel.com/docs/project-configuration/vercel-json#regions)은 프로젝트 기본값을 배포별로 덮어쓰며 정적 파일 배포에는 영향이 없다.
- 같은 시간에 테스트 정책 관측값이24시간 만료되어 사진 조회가 거절됐다. 지역 변경 오류와 구분했다. 실제 Storage와 예약량38,464bytes, 월 조회534,668bytes가 기존 한도 안임을 SQL로 확인한 뒤 버전 관리된 `tools/private-images/refresh-phone-test-observation-20260928.sql`을 테스트 DB에만 실행. observed_at=2026-09-28 07:11:52.445753+00으로 갱신됐고 revision/권한/한도/24시간 만료 규칙은 그대로다. 스키마/사용자 데이터 migration 없음.

| 동작 | 사진 준비(문서 시작 기준 ms) | 사진 조회 전체 | policy HTTP | 서버 로그인 확인 | 서버 정책 RPC | 캐시 |
|---|---:|---:|---:|---:|---:|---|
| 상세 새로고침 |603|236|218|48.4|54.0|hit,10ms|
| 뒤로가기로 상세 복귀 |574|222|214|51.5|42.8|hit,3ms|
| 앞으로가기로 작품 목록 복귀 |1721|252|244|64.9|52.0|hit,3ms|

- 뒤로가기 표본: policy HTTP1444→214ms(약85% 감소), 문서 시작부터 사진 준비1810→574ms(약68% 감소). 실제 DOM의 이미지 로드 완료도 확인. 반복3회 모두 binary GET 없이 캐시 재사용. PC Chrome의 작은 표본이며 paint 시간/실제 iPhone 수치로 일반화하지 않는다.
- 콜드 캐시 구간은 별도: 정책 갱신 후 첫 상세는 cache miss로 사진 준비4100ms(policy549ms + binary2101ms 포함), 첫 작품 목록은4556ms(policy333ms + binary664ms 포함). 반복 지연이 줄었다는 결과를 최초 다운로드도 즉시라는 주장으로 확대하지 않는다.
- 검증: unit407 PASS, build19 PASS, 배포 Ready 및 build-info SHA6d7e784 일치. 이번에는 React/탐색 코드가 바뀌지 않아 기존 UI 흐름 그대로 실제 상세/목록/back/forward를 확인했다.
- 계획 조정: 지역 불일치만 수정하여 권한 대기가 크게 감소했으므로 이번 패치에서 강제 페이지 전환/인증 방식을 함께 바꾸지 않았다. useUnsavedNavigation의 beforeunload 기반 보호와 Astro history 전환을 함께 다뤄야 하므로 단순 data-astro-reload 제거는 보류. 최초 화면 준비/콜드 다운로드 및 실제 iPhone 검증은 남는다.
- 운영 잔여: 테스트 사용량 관측은 자동 갱신되지 않으며 다음24시간 후 다시 만료된다. 운영 전 실제 사용량을 검증하는 일일 관측 자동화가 필요하다. 허위 timestamp 갱신이나 만료 규칙 제거로 우회하지 않는다.
- 롤백: regions 변경 commit revert 후 Git preview 배포. 관측 갱신은 기존 정책의 정기 점검이므로 권한 변경 롤백 없음(24시간 만료 유지). 공개 UGC/자동 사진 업로드/운영 배포 변경 없음.
