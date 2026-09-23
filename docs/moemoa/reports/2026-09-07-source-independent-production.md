# 자체 ID 지원 검토와 Web 운영 배포

2026-09-07 사용자 `검토후 배포 ㄱ` 승인에 따라 완료했다. 운영 https://www.moemoa.xyz, deployment `dpl_9cQZqinSPXfT8uRbfdamz59qtyQY`, 고정 URL https://anime-collector-3159ylqjz-newrreds-projects.vercel.app. Vercel READY/production 및 운영 도메인의 동일 deployment를 확인했다.

## 검토 범위와 수정

AGENTS, CODEX_START_HERE, 확정 결정01, 운영07, 변경09, 이전 구현 계획/보고서 및 직전 배포 snapshot을 대조했다. 실행 계획은 `../plans/2026-09-07-source-independent-release.md`. AniList ID 선택화, 외부 이동 제거, 자체 ID 저장/Memory 연결을 배포했다.

검토에서 발견한 문제는 배포 전에 수정했다.

- `src/features/titles/application/titleHubService.js`: catalog 접근 실패 시 UUID 요청을 기존 ANILIST 키 album에서 찾지 못했다. 요청 UUID와 album의 titleRef를 직접 대조하도록 수정했다. 브라우저에서 catalog 실패를 재현해 기존 저장 작품이 열리는 것을 확인했다.
- `src/components/search/TopNavGlobalSearch.jsx`: 최근 작품 목록의 숫자 검사가 UUID 작품을 제외했다. 유효한 저장 작품 ID를 그대로 사용하도록 수정했다.
- `src/repositories/titleLibraryRepo.js`: IndexedDB 조회 오류와 malformed mirror가 전체 목록을 비우는 방향으로 전파될 수 있었다. localStorage mirror 복구와 배열/행 검증을 추가했다.
- `src/features/catalog/catalogConsumer.js`: search/detail 사이 optional binding 불일치 검사를 복원했다. 양쪽 binding이 없는 작품은 허용하지만 조회 사이 릴리스 변경으로 binding이 달라진 후보는 잘못된 numeric ID로 저장하지 않는다.

## 배포·검증

| 검증 | 결과 |
| --- | --- |
| Node unit suite | 230/230 통과 |
| Chromium: source-independent-title, title-hub, title-collection, title-cross-surface | 13/13 통과 |
| 이전 단계 catalog suite | 245 통과/2 기존 skip; 이번 검토에서 exporter 변경 없음 |
| React Doctor | 72/100, 기존 6개 경고/5개 파일 유지 |
| Node 24 production 설정 Astro build | 15페이지 성공 |
| 업로드 snapshot 대조/비공개 환경값 검사 | 269개 입력 일치, 78개 출력, 개발 test adapter 및 관리자 키 미포함 |
| 격리 candidate 실제 브라우저 | 주요 7개 흐름, page error 0, account write 0 |
| promote 후 운영 실제 브라우저 | 동일 7개 흐름, page error 0, account write 0 |
| 운영 catalog 추가 검사 | 5등분 1기/2기 분리 검색→정확한 Title Hub, AniList 링크 없음, 저장→새로고침→해제 확인 |
| 운영 산출물 | 78개 HTTP 200; 비HTML 63개 byte hash 일치, HTML 15개 기존 build uid/analytics 설정 정규화 후 일치 |

공개 DB 조회는 제한된 응답의 HTTP 206도 정상으로 처리해 count를 확인했다. 첫 보조 검사에서 200만 기대해 실패한 것은 이 검사 조건을 수정하고 다시 검증했다. DB/앱 실패로 처리하거나 숨기지 않았다.

## 데이터·보안·남은 범위

운영 DB release는 `catalog-add-81297cd638290f972ca84c28`, 작품 수 **3,999개**다. DB pointer/데이터를 변경하지 않았다. 226건은 transport PASS와 개별 identity 승인이 다르므로 추가하지 않았다.

`20260907193000_catalog_optional_source_provider.sql`은 이번 웹 배포에 필요하지 않으며 **미적용** 상태다. AniLife 데이터를 게시하는 단계에서 실제 DB 제약 적용 검증을 수행해야 한다. 새 자체 ID 작품 저장은 로컬이며 legacy export/remote sync에 미포함인 기존 제한을 유지한다. Memory metadata sync와 별개다.

기존 공개 production 계정/catalog 환경값을 재사용했다. catalog 환경값은 이번 deployment build에 전달했고 프로젝트 영구 설정으로 변경하지 않았다. 사용자 이미지 upload, Public UGC, 인증 권한, 분석 이벤트를 변경하지 않았다. smoke 합성 기록은 별도 비로그인 브라우저의 로컬 저장소에만 생성했다. Android APK, Git commit/push는 이번 범위 밖이다.

## 복구와 증거

- 이전 deployment: `dpl_6szkuJQhK7PjBDGa1Tnd3M9wqBaX`, https://anime-collector-8m5rl1tpw-newrreds-projects.vercel.app.
- 필요 시 `vercel rollback https://anime-collector-8m5rl1tpw-newrreds-projects.vercel.app --yes --scope newrreds-projects`. DB 복구는 필요 없다. 추가 local 저장 영역을 삭제하지 않는다.
- 증거/snapshot: `D:/hong/Web/Anime/.moemoa-release-2026-09-07-source-independent/`의 unit-tests.log, e2e-tests.log, react-doctor.log, artifact-audit.json, candidate-smoke.json, production-smoke.json, catalog-smoke.json, catalog-current.json, live-artifact-verification.json, production-before.log/production-after.log.
- 산출물 manifest SHA-256: `d6becf23f35037f92d58d138e809b6f1af110e7033b3031cee796f0c9ec19d64`.

요청한 코드 검토와 웹 배포에 남은 작업은 없다. 226건 개별 검토/게시와 자체 ID 저장 상태의 export/remote sync는 별도 후속 범위다.
