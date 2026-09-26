# MOEMOA Pro 재검토 인계 — 2026-09-27

## 검토 대상

사용자가 작업이 늘어지는 문제를 지적하여 새 구현을 중단했다. 이번 요청은 현재 작업 전체와 문서를 master에 커밋해 Pro의 독립 검토를 받기 위한 것이다. **검토 대상은 이 문서를 포함한 커밋의 전체 소스**다. 비교 기준은 직전 간이 Web 배포 소스 `06d2e38d79d38c66753f0ec25a21b615bdc5fa60`. 이전 Pro 검토 `bbff3d4`와 9/25 인계는 역사 자료이며 최신 소스를 대체하지 않는다.

master는 저장소의 기본/운영 연동 브랜치 이름이다. 이번 커밋은 로컬 보존이며 push/운영 배포·DB 적용·Public 활성화·유료 변경을 실행하지 않는다. 과거 운영 배포 동일 SHA/READY 근거는 있으나 이번에는 운영 사이트를 재조회하지 않았다. 실제 커밋 SHA는 Git 기록 및 함께 제공하는 ZIP 파일명으로 확인한다.

이 문서는 검토용 안내다. 새로운 계획이나 두 번째 작업판이 아니다. M0~M5/W01~W20/C01~C12/Q01~Q24/D01~D06은 유지한다.

## 먼저 읽을 자료

1. `AGENTS.md`, `CODEX_START_HERE.md`.
2. `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`: 사용자 확정과 제안을 구분.
3. `docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md`: 첫 진행 검토·현재 위치·현재 작업 카드·D/Q 표.
4. `docs/moemoa/release-v2/00_CODEX_START_HERE.md`, `01_RELEASE_EXECUTION_PLAN.md`, `02_ACCEPTANCE_CONTRACTS.md`.
5. 실제 변경 diff와 아래 코드·검증 자료. 문서의 PASS보다 실제 검증 범위를 우선한다.

## 범위 변화와 현재 결론

기존 V2 첫 공개 목표는 개인 기록·계정·공개 보드·미니홈·팔로우·최소 운영이다. 이후 무료 비공개 최적화 이미지 연동, 첫 Web-only 확정, 12세 이용·성인 영역이 추가되었다. 사용자는 9/26 **12세·성인 영역까지 포함하고 일정 조정**을 승인했다. 국가 KR/PH/TH, 성인 초기 범위 비노골적인 성인 취향 일러스트. Android는 후속이며 별도 권리 조건은 유지한다. 9/27 고정 날짜는 최신 승인에 따라 해제됐고 새 날짜는 없다.

기본 서비스의 주요 구현과 과거 테스트 서버 공개 한 바퀴 근거는 있다. 그러나 추가된 연령 범위는 현재 **로컬 기반 및 방어 구현**이며 실제 인증/보호자 서비스 완료가 아니다. 실제 인증 제공사, 보호자 관계·가입 전 동의, 국가 정책, 검증된 증거에서 자격을 발급/철회하는 운영 경로가 남아 있다. 이를 테스트 수 증가로 출시 준비 완료처럼 해석하면 안 된다.

작업판 공식 상태: DONE4 / VERIFY9 / DOING4 / BLOCKED_EXTERNAL3, M완료1/6. 이 숫자는 구현률20%가 아니다. VERIFY 상태는 기존 범위의 진행이며 새 연령 요구를 통과했다는 뜻도 아니다. 임의의 전체 완성률은 산정하지 않았다.

## 이번 커밋에 포함되는 큰 변경

| 영역 | 주요 위치 | 상태/주의 |
| --- | --- | --- |
| 이미지 정리·비용·복구 | `api/private-image-cleanup.js`, `src/server/privateImages/cleanupHandler.js`, `.github/workflows/private-image-cleanup.yml`, `tools/private-images/` | 자동 실행은 별도 변수로 기본off. 실제 외부 백업/키보관/운영 스케줄 승인과 구분 |
| 콘텐츠 분류·운영자 검토 | `supabase/migrations/20260926140122_memory_content_review.sql`, `src/features/memory/components/MemoryContentReview.jsx`, `src/pages/moderation.astro` | 정식 migration 파일은 있지만 test 적용 승인 대기. 미승인 공개/성인 활성화 금지 |
| 신원 확인 요청 기반 | `src/server/identity/`, `tools/identity/request-store-candidate.sql` | 완료 이력 RECORDED는 성인/보호자 자격이 아니다. 실제 provider·public endpoint 연결 미완료 |
| 용도별 자격 검사 | `tools/identity/eligibility-*-candidate.sql` | **정식 migration이 아닌 로컬 prototype**. 스키마/권한/함수이동 wrapper의 적용 순서와 통합 영향 검토 필요 |
| 성인 읽기/이미지 연결 | `src/server/publicImages/`, `api/public-image.js`, `tools/identity/eligibility-viewer-candidate.sql` | 서버 default-off `MOEMOA_PUBLIC_IMAGE_VIEWER_ENABLED`. 실제 provider/국가 정책 별도 |
| 클라이언트 계정 전환 | `src/features/memory/application/createPublicationViewer.js`, `runtime/platformPublication.js`, PublicMemoryBoard/PublicMinihome/PublicBoardSnapshot | client default-off `PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1`. metadata/이미지 일치와 계정 변경 폐기 검증 |
| 기존 동작 보완 | IndexedDbMemoryRepository, MemoryPrivateImageSync, global.css, build-info script | 새 기기 카탈로그 카드 수정·quota 안내·모바일 스타일·배포 출처 기록. 해당 날짜 evidence 참조 |

## 검증 근거의 범위

| 근거 | 결과 | 입증하지 않는 것 |
| --- | --- | --- |
| `npm run test:unit` | 최신394 PASS, `.cache/viewer-client-unit.log` | 실제 인증업체/운영 환경 |
| `npm run build` | 최신19페이지 PASS | 실제 사용자 흐름 전체 |
| `tests/public-viewer.spec.ts` Chromium | 4 PASS: 보드/미니홈 실제 이미지decode·로그아웃 제거·URL해제·계정전환 중 지연이미지 차단 | Auth/RPC/Storage는 합성 fixture |
| `tools/private-images/run-local-postgres.sh` + eligibility 옵션 | 최신143 PASS, 실제 mutation/promotion 잠금 만료 rollback·public reader·HTTP→실제SQL 포함 | Supabase hosted Auth/Storage와 실제 연령 증거 |
| 9/24~9/26 hosted 증거 | A/B 기본격리·private 이미지·공개 게시/익명 이미지/팔로우/신고/조치/철회·cleanup 등 | 새로운 성인/보호자 조건 또는 현재 전체 RC |

검사 명령·결과·한계는 `release-v2/evidence/2026-09-27-eligibility-*.json` 및 각9/26 JSON을 참조한다. 마지막 검사는 `2026-09-27-eligibility-mutation-expiry.json`. 캐시 로그는 커밋하지 않았으며 JSON 기록과 재실행 코드가 포함된다. 숫자는 서로 다른 suite의 누적/재실행 수이므로 단순 합산 금지. local fixture의 합성 승인·claims·세션을 실제 인증 PASS로 읽지 않는다.

최근 실제 발견/수정: 이미지·게시/저장 잠금 대기 중 자격 만료 누락, 공개 자격 오류 전달 소거, 게시자 자격 철회 후 기존 공개 읽기 지속. source·operation·quota 보존을 유지하며 고쳤다. 테스트 fixture 오류도 별도로 기록했다.

## Pro에게 요청하는 핵심 검토

1. **범위/우선순위:** 최근 구현이 승인된 요구의 최소 충족에 필요한가? 출시 단계 종료보다 인증 기반을 과도하게 확장한 부분은 어디인가? 새 계획을 만들지 말고 기존 W에 남길/줄일/보류할 항목을 구체적으로 지목해 달라.
2. **진짜 출시 차단:** 12세·성인 영역·KR/PH/TH를 유지할 때 제품 결정/업체 확인/법적 검토가 선행해야 할 부분과 지금 구현 가능한 부분을 분리해 달라. 범위를 낮추는 선택은 권고일 뿐 사용자 승인 없이 확정하지 말 것.
3. **설계/코드 결함:** identity 이력→자격 발급 연결 미구현, 가입 전 동의 부재, SQL wrapper·함수 이동·권한과 snapshot/clock race, owner/viewer/session 경계, default-off flag/DB 적용 순서, replay/회수/삭제 보존을 검토해 달라.
4. **검증 과잉/누락:** 반복된 로컬 테스트가 실제 위험을 줄였는지, hosted·실기기·복구/경보에 비해 편중됐는지, mock과 실제 evidence를 과대평가한 문구가 있는지 지적해 달라.
5. **진행 관리 문제:** 시간순 로그가 과도하고 현재 요약·W/Q표가 최신 evidence를 충분히 반영하지 못했다. 이번에 현재 요약을 교정했지만 남은 오래된/모순된 상태와 실제 종료 가능한 W를 찾아 달라. 과거 로그를 삭제하거나 최신 상태를 과거로 덮어쓰지 말 것.
6. **재개 순서:** 큰 전면 재작성 없이 출시로 이어지는 최소 다음 작업을 우선순위로 제시하고, 각각 코드 변경/사용자 결정/외부 회신/실환경 검증 중 무엇인지 구분해 달라.

## 확정하지 않은 운영 항목과 인계 제한

D01 새로운 분류 test migration 적용 승인, D03 인증 비용·운영 한도/경보, D04 실제 인증/보호자/국가별 정책, D05 외부 사본·키/보존/실복구, D06 정확한 후보/운영 적용이 남는다. 기본 키·A/B·72table 복원은 이미 확보한 과거 evidence가 있어 이유 없이 반복하지 않는다. 운영자 sinong/지원 이메일 및 Web-only 결정은 확정이다.

공급자 문의 초안은 `docs/moemoa/operations/2026-09-26-identity-provider-inquiry.md`이며 **발송하지 않았다**. 외부 메시지·유료 변경·운영 마이그레이션·Public 활성화는 이 인계의 포괄 승인 대상이 아니다.

이번 전체 커밋은 변경을 숨기지 않고 검토하기 위한 checkpoint다. 정식 출시 후보가 아니며 아직 원격 최신화하지 않았다. 검토 ZIP은 Git tracked 소스로 생성하므로 `.env`, `.cache`, 실제 DB dump, 개인 원본·로그 및 credentials를 포함하지 않는다. 재개 전까지 구현은 일시정지다.
