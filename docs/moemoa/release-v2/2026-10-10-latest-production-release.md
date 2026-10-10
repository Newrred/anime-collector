# 최신 기능 운영 배포 · Pro 검토 인계 (2026-10-10)

상태: **배포 준비/동일 소스 CI 검증 단계**. 이 문구는 실제 Git/Vercel/www 대조 뒤 결과로 갱신한다. 전체 상황은 [Pro 검토 인덱스](2026-10-10-pro-review-index.md)에서 읽는다.

## 1. 읽은 문서·증거

CODEX_START_HERE, 확정 결정(01), QA/운영(07), phase(08), 변경 보고(09), PLANS, 기존 release-v2 계획·가입/관리자/이미지 입력 완료 보고, quality workflow·runner·build provenance를 읽었다. Git fetch 후 master6a2beff와 clean 작업 소스35d88ab 차이를 독립 검토했다.

## 2. 범위와 미확인

사용자가 최신 전체 변경의 moemoa.xyz 반영 및 Git 업로드를 승인했다. 추가 국가나 Public 활성·신규 DB migration 승인이 아니다. 국가 연구 자료는 이미 Git/master에 있고 이번에는 최신 결과/증거와 찾아 읽기 쉬운 목차를 함께 보존한다. 실기기 OS 캡처 붙여넣기, 신규 운영 Google 가입 왕복은 기존대로 미검증이다.

## 3. ExecPlan

[단일 계획](01_RELEASE_EXECUTION_PLAN.md) 최상단 「최신 기능 Git 운영 배포와 Pro 전체 검토 인계」. 운영 점검 스킬로 동일 소스 배포/복귀를 대조하고 문서 동기화 스킬로 과거·현재 사실과 미검증을 분리했다.

## 4. 변경과 Git 전달

- 기존35d88ab: 계정 및 데이터 단일 메뉴, 이미지 drop/paste·교체, 공통 검증·owner/늦은 처리 정리. [기능/31파일/검증 보고](2026-10-10-account-menu-desktop-images.md).
- 이번 추가: `.github/workflows/quality.yml`에 기존 격리 desktop runner 연결. 운영 앱 기능·의존성은 추가 변경하지 않음.
- 시작문서·작업판·설정 지도에 최신 근거와 이력 주의사항, Pro 인덱스 및 본 배포 보고 추가. 비밀 환경값·원본·DB dump·개인 브라우저/ignored cache는 Git 미포함.
- 생산 브랜치는 master, 작업 인계 브랜치는 codex/simple-signup-preview. 검증된 test snapshot codex/phone-test는 이동하지 않는다.

## 5. DB·정책·롤백

이번 DB/data migration **0**. 기존 [KR/US/TH 활성 release](evidence/2026-10-10-first-signup-ui-release.json)의 schema/data release ID를 그대로 참조하며 재실행하지 않는다. KR14/US13/TH13, admission=true, Public off 유지. 이전 운영 앱6a2beff와의 차이를 검토한 revert commit을 master Git 배포하는 것이 복귀 경로다. 데이터 삭제/강제 push/CLI 운영 승격은 하지 않는다.

## 6. 테스트·배포 증거

- 기능 소스35d88ab 로컬: unit585/585·Chromium51/51·build32 PASS, PC1280/390/320px 확인. 이 결과를 새 CI 결과와 합산하지 않는다.
- 독립 preflight: 관련 unit18/18, diff-check PASS. 변경 diff의 고위험 credential 패턴6종0건; 포괄적 보안 감사 완료 주장은 아님.
- 동일 후보 CI, Vercel Git Production Ready, www build-info 및 읽기 전용 smoke: **아직 이번 보고 작성 시점에는 대기**. 결과 JSON은 `evidence/2026-10-10-latest-production-release.json`에 기록한다.

## 7. 안전·관찰

메뉴/입력 개선은 공개/계정 권한을 늘리지 않는다. drop/paste는 로컬 미리보기 후 기존 명시 Save를 사용한다. 추가 analytics·개인 데이터 로그0, 신규 운영 사용자/사진/탈퇴 조작0. 배포는 연결된 Git→Vercel만 사용하고 commit/checkoutCommit/source/config semanticMatch를 대조한다.

## 8. 남은 범위·다음 단계

배포 완료와 전체 공개 출시 완료는 다르다. PH·EU/EEA·UK·CH의 미활성/근거, 무보수 대표자 실제 수임, Public/캡처·팬아트 권리, D05 복구·키 잔여는 Pro 인덱스에서 근거별 검토한다. 이번 작업으로 법률 검토가 새로 완료됐거나 모든 기기·국가 출시가 준비됐다고 표시하지 않는다.
