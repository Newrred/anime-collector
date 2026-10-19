# 관리자 한도 적용 범위 표시 수정 — 2026-10-19

**로컬 구현·검증 완료, 운영 미반영.** 사진 요청/전송량의 전역 한도를 계정별로 오인하게 하는 안내를 고쳤다.
[검증 JSON](../release-v2/evidence/2026-10-19-admin-quota-scope/verification.json),
[한국어 PC](../release-v2/evidence/2026-10-19-admin-quota-scope/ko-desktop.png) ·
[한국어320px](../release-v2/evidence/2026-10-19-admin-quota-scope/ko-320.png) ·
[English PC](../release-v2/evidence/2026-10-19-admin-quota-scope/en-desktop.png) ·
[English320px](../release-v2/evidence/2026-10-19-admin-quota-scope/en-320.png).
그림의 숫자는 기존 합성 fixture이며 실제 운영 한도 값이 아니다.

## 1. 읽은 근거
상위 THIS_PC_HANDOFF와 AGENTS, 저장소 CODEX_START_HERE/확정 결정/PLANS/변경 통제,
10/18 법률·운영 인수보고의 W15/W18 C09, 참고 patch, 실제 AdminDashboard/admin.css,
adminService/모의 fixture·브라우저 검사·격리 runner를 읽었다.
`20261011160000_memory_public_capacity_observation.sql:26–33`의 전역 actor와
IMAGE_DELIVERY/IMAGE_DELIVERY_BYTES 범위를 화면의 기존 일괄 계정별 설명과 대조했다.

## 2. 승인·가정·미결
사용자 “1번 관리자 화면 한도 표시 수정부터 진행”에 따른 표시 보완이다.
개발 기준2d37e7e, 운영 기준724eadd이며 실제 정책·계산과 권한을 바꾸는 요청은 아니다.
기존 개발 서버 준비 지연이 검사에서도 재현됐다. 이번 UI 수정의 성능 결함/해결로 단정하지 않는다.

## 3. 계획
기존 release-v2/01의 W15/W18·C09 관리자 한도 표시 계획을 먼저 기록했다.
두 전역 정책/기타 알려진 계정 정책을 확인→짧은 안내와 범위 열 추가→KO/EN·PC/320px·키보드/
게스트·비운영자 경계 검사→빌드/React Doctor 회귀 대조→현재 작업판·증거 기록 순서로 진행했다.

## 4. 변경 파일과 동작
- `src/components/AdminDashboard.jsx`: 기존5열을6열로 보완해 ‘한도 적용 범위/Limit scope’를 표시한다.
  요청/전송량2행은 ‘서비스 전체/Entire service’, 기존 다른10행은 ‘계정별/Per account’.
  알려지지 않은 식별자는 계정별로 추측하지 않고 ‘범위 미확인/Unspecified’로 표시한다.
  일일/보유 한도 제목의 일괄 계정별 표현을 제거하고, 오늘 사용량이 전체 계정의 UTC일 합계임을 설명한다.
- `src/styles/admin.css`: 범위 열만 왼쪽 정렬/줄바꿈 방지. 기존 접힌 상세 표·독립 가로 스크롤·포커스/
  row/column header 구조를 유지한다.
- `tests/admin-ui.spec.ts`: 기존 KO/EN 화면 검사에 전역2/계정10행·각 대표 행·6개 열·원래 MiB 값,
 320px 문서 overflow0·키보드 가로 스크롤·범위 열 전체가 화면에 들어오는 검사를 보완했다.
계산/정책/SDK·decoder/auth/pause-resume 동작은 수정하지 않았다.

## 5. 데이터·복귀
DB·migration·운영 데이터·권한·flags·환경·의존성/lock·실제 한도 변경0, 운영 배포0.
표의 숫자/단위는 기존 formatter와 응답을 그대로 사용한다. 이번3개 구현/검사 파일을 revert하면 되며
DB 복원이나 한도 값 변경은 필요 없다. 앞선 DF-02 적용/정기 예약도 유지한다.

## 6. 실제 검증
- 관련 adminService 단위8 PASS, 일반 환경 build34/postbuild exit0.
- 모의 관리자 환경으로 같은 소스 build34 후 loopback 정적 서버에서 기존 검사4개 PASS/재시도0:
  비로그인, 비운영자 거부, 한국어 PC/320px, 영어320px/PC.
- 두 언어 모두 전역2/계정10행·원래2 MiB/100 MiB·6열 header, 키보드 스크롤과 범위 header의
  전체 노출·문서 overflow0을 확인했다. 이미지4개를 직접 시각 확인하고 합성 증거로 보존했다.
- 기본 `run-admin-e2e.mjs`는 이 PC에서 서버 준비 timeout2회로 검사 시작 전에 끝났다.
  실제 화면 assertion을 완화하지 않고 같은 수정 소스를 모의 설정으로 빌드해 위4개를 실행했다.
  이 결과를 기본 runner 전체/나머지 admin·auth-callback 전체 성공으로 확대하지 않는다.
- React Doctor 최신0.9.18: 동일 AdminDashboard 검사 오류0/기존 경고8→8.
  현재 CLI 도움말의 `--scope changed --base 2d37e7e --verbose`로 신규0/기존 매칭8.
  외부 score/telemetry와 변경 없는 의존성 공급망 검사는 비활성화해 숫자 점수는 미산출이며100점으로 보고하지 않는다.
- 평소 Node24.19.0/npm11.17.0 개발 서버를 복원하고 기본4363 HTTP200을 확인했다.

## 7. 보안·권리·관측
실제 운영자 계정/DB를 조회하거나 조작하지 않았다. 기존 합성 SDK 세션·loopback mock 응답만 사용했다.
비운영자에게 집계/제어가 나타나지 않는 기존 경계를 검사했고 실제 한도/권한 설정을 수정하지 않았다.
환경/키·개인 자료는 Git에 넣지 않았으며 PNG는 합성 사용량 표만 담는다.
원래 개발 runner 지연과 진단 원문은 이 PC `.tools/admin-quota-*-20261019.*`에 구분 보존했다.

## 8. 남은 경계와 다음 작업
현재는 검토할 수 있는 로컬 수정본이다. 운영 반영은 이번 구현 승인과 구분하며 실행하지 않았다.
운영 요청 시 최신 origin/master에서 이3개 파일의 최소 후보를 준비하고 정확 CI/Git 배포 규칙을 따른다.
관리자 한도 라벨은 구현 잔여에서 제거하되 운영 반영 상태는 따로 표시한다.
기존 개인 사진 로딩 원인 진단과 DF-02의10/20 12:15 KST 정기 실행 관찰은 별도 잔여다.
