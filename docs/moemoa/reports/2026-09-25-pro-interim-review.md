# MOEMOA Pro 중간 검토 인계 — 2026-09-25

## 검토 대상과 목적

검토 브랜치: `review/pro-interim-2026-09-25`. 비교 기준: `0330a5401e0112f2e36886a6826812219e7aed89`.
이 문서가 포함된 커밋의 소스 전체를 검토한다. GitHub master/현재 운영 화면을 이 개발본과 동일하다고 보지 않는다.

목적은 Pro의 V2 출시 계획에서 실제로 무엇을 구현했고 무엇이 남았는지 확인하고, 추가 계획을 늘리지 않고 출시까지의 최소 작업 순서를 판단하는 것이다. 중간 검토용이며 RC 승인·출시 완료 보고서가 아니다.

현재 목표는 **개인 기록 + 계정 + 공개 보드 + 공개 미니홈 + 팔로우 + 최소 운영**이다. Android는 사용자가 이번 실행에서 제외했으며 제품의 영구 지원 범위를 변경한 것은 아니다. 최근 테스트 환경/복구 작업은 충분한 기본 증거를 확보했으므로 새로운 실패나 변경 없이 반복하지 않는다.

## 읽는 순서

1. 이 문서: 전체 상황과 검토 요청.
2. [단일 진행판](../release-v2/03_RELEASE_WORKBOARD.md): 현재 상태·최신 날짜 기록. 과거 W행의 당시 미제공/미검증 설명보다 최신 증거를 우선한다.
3. [Pro V2 목표](../release-v2/00_CODEX_START_HERE.md), [기존 실행 계획](../release-v2/01_RELEASE_EXECUTION_PLAN.md), [수용 계약](../release-v2/02_ACCEPTANCE_CONTRACTS.md): 목표/완료 조건/이전 지적25개 매핑.
4. [확정 제품 결정](../01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md), [현재 UI·코드 감사](2026-09-24-release-surface-audit.md).
5. 아래 소스 지도와 증거. 문서의 완료 주장보다 실제 코드와 검사 범위를 우선한다.

상시 갱신하는 진행 원장은 여전히 하나다. 이 인계서는 새로운 계획 트리나 두 번째 진행판이 아니다.

## 구현 상태와 주요 소스

| 영역 | 현재 구현/확인 범위 | 검토할 파일 |
|---|---|---|
| 개인 기록·동기화 | 취소/복귀·재개·owner 경계, 실제 복원 시 visual 연결 누락 수정 | `src/features/memory/adapters/indexeddb/{IndexedDbMemoryRepository,memorySyncStore}.js`, `tests/memory-indexeddb.spec.ts` |
| 로그인 | PKCE callback/내부 복귀, Google 계정 선택 | `src/features/auth/webOAuth.js`, `src/components/auth/AuthCallbackClient.jsx`, `src/repositories/authRepo.js` |
| 공개 보드 | 선택 필드·미리보기·명시 동의·게시·익명 읽기 | `src/features/memory/application/createPublicationController.js`, `src/features/memory/components/{MemoryPublicationPanel,PublicMemoryBoard,PublicBoardSnapshot}.jsx` |
| 이미지·철회 | 서버 변환·비공개 파생본, 공개 접근 재검증, 원본 삭제 전 철회 | `src/server/publicImages/`, `src/features/memory/application/{preparePublicImage,retirePublicationBeforeDelete,deleteMemoryCard}.js` |
| 미니홈·팔로우 | 선택 전시·미니홈 reader·관계 제어·공유 링크 | `src/features/memory/application/createMinihomeController.js`, `src/features/memory/components/{MemoryMinihome,PublicMinihome,MemoryRelationships,PublicLinkCopy}.jsx` |
| 신고·운영 한도 | 신고/차단/제재/감사·서버 자원 한도 | `src/features/memory/components/MemorySafety.jsx`, `supabase/migrations/20260923213901_memory_moderation.sql`, `20260924115258_memory_resource_controls.sql` |
| 카탈로그·복구 | checked release 전환·파일 hash·삭제 fence 복원 | `tools/catalog-preview/uploader.mjs`, `supabase/migrations/20260924121214_catalog_release_transitions.sql`, `tools/publication-boundary/restore-roundtrip.sh` |
| 출시 검사 | 필수 증거 없는 후보 거부·CI 연결 | `scripts/check-release-candidate.mjs`, `.github/workflows/quality.yml`, `tests/publication-ui.spec.ts` |

운영용 과거 schema와 테스트에 적용한 새 migration을 혼동하지 않는다. 테스트17개 migration 이력과 원본 이름/해시는 [bootstrap 증거](../release-v2/evidence/2026-09-24-hosted-test-bootstrap.json)에 있다. 테스트의 원격 migration timestamp는 로컬 파일 timestamp와 다르므로 무조건 db push하지 않는다.

## 검증 수준

| 증거 | 결과 | 증명하지 않는 것 |
|---|---|---|
| 이번 인계 전 재실행 | unit320 PASS, 웹 build18 pages PASS | 전체 브라우저/실환경 검사의 이번 커밋 재실행 아님 |
| [W16~W20 당시 검사](../release-v2/evidence/2026-09-24-w16-w20-validation.json) | unit320, catalog256(skip2), Chromium174(skip3), SQL235, native31 | 현재 소스 전체와 동일한 SHA의 원격 CI 아님. Android 실기기 미검증 |
| 실제 OAuth/기록 왕복 | 두 Google 계정, 별도 origin 복원·수정·삭제·격리 확인 | 서로 다른 물리 기기 검증 아님; 진행판 최신 기록 참조 |
| [실제 API/Storage](../release-v2/evidence/2026-09-25-hosted-api-storage.json) | A/B/익명33 PASS | 모든 RPC 공격 조합, 활성 공개 이미지/CDN 미검증 |
| [오래된 복원 SQL](../release-v2/evidence/2026-09-25-local-stale-recovery.json) | SQL236 PASS, 이미지14 PASS | 합성 local auth/storage; 이미지 backend는 mock |
| [서버 연결·파일 사본](../release-v2/evidence/2026-09-25-server-connection.json) | 테스트 서버 연결·비공개60bytes 이미지 hash/decode 일치 | Storage 서비스 전체 복구 아님 |
| [hosted DB 복원](../release-v2/evidence/2026-09-25-hosted-db-recovery.json) | 전체dump, 선택5schema72테이블·RLS·client table grants 일치 | Supabase Auth/Storage/Realtime 서비스·cron/vault·운영 PITR 복구 아님 |

증거 JSON의 과거 source hash는 당시 실행에 해당한다. `.cache` 로그, 로컬 DB dump 및 자격증명은 Git에 포함하지 않는다. 원격 검토자는 포함된 결과 보고와 테스트 소스를 검토할 수 있지만, 비포함 원본 로그를 직접 재검증했다고 주장해서는 안 된다.

## 출시까지 남은 최소 작업

1. **실제 공개 기능 통합**: 테스트 환경에서 보드/이미지 게시→익명 열람→미니홈→팔로우→신고/차단/관리 조치→철회까지 실제 서비스 연결로 확인하고 발견 결함을 수정한다. 배포 환경 이미지 전달과 캐시/철회 경계도 포함한다.
2. **운영값 확정**: D03 비용·지원 규모·한도·실제 경보 수신, D04 운영주체·허용 이미지·신고/삭제 담당과 정책, D05 보존·복구 목표/자료 인계. 코드의 기술 상한을 사용자 승인된 상품 약속으로 바꾸지 않는다.
3. **후보 고정**: 최신 후보 회귀·보안 advisory/실제 노출 API 확인, CI, 배포 provenance의 `workingTreeDirty=true` 원인 확인, 운영 migration/config/rollback 준비. Pro 검토용 커밋은 자동 출시 후보 승인이 아니다.
4. **운영 승인 및 검증**: D06에서 정확한 커밋/DB/catalog/flags 승인 후 master Git 연동 배포, 운영 도메인 핵심 흐름 확인. 별도 승인 없이 운영 DB/Public을 변경하지 않는다.

D01의 환경·계정·비밀값 제공은 확보됐다. 실제 공개 동작 검사 잔여를 환경 미제공으로 계속 표시하지 않는다. 진행판의4/20은 엄격한 작업 종료 개수이지 구현률20%가 아니다. [기존 후보 JSON](../release-v2/evidence/2026-09-24-w20-candidate.json)의 PENDING은 당시 상태이며 이번 인계만으로 PASS로 바꾸지 않는다.

## Pro에 요청하는 검토

- V2 계획·수용 계약과 실제 소스 사이에 출시 필수 기능 누락/잘못된 완료 주장이 있는가?
- 계정 경계, 공개 DTO, 이미지 업로드 동의, 철회/삭제, 신고/차단·제재, 서버 한도에 실제 결함이 있는가? 구체적인 재현 경로와 파일 위치를 제시해 달라.
- 테스트 환경 준비/복구 작업 중 더 이상 반복할 필요 없는 부분과 실제 공개 통합에 꼭 필요한 검사를 구분해 달라.
- W 목록을 처음부터 재설계하지 말고 기존 항목에 연결하여 **출시 차단 / 출시 전 간단 수정 / 출시 후 보류**로 분류해 달라.
- 미확정 운영값은 최소한의 소유자 결정 목록으로 묶어 달라. 새 제품 기능·DM/댓글/추천 피드·불필요한 구조 개편은 추가하지 말아 달라.

원하는 결과: 핵심 판단, 근거가 있는 결함 목록, 이미 충분한 검증, 출시까지 남은 최소 순서, 소유자가 결정해야 하는 값. 실제 실행하지 않은 테스트는 소스 검토와 구분해 달라.
