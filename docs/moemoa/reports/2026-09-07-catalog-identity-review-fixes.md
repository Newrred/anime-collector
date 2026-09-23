# 카탈로그 교정 코드 후속 개선

## 범위와 근거
- 요청: 직전 코드 검토에서 재현한 게시 검증 우회 2건과 기호 생략 검색 회귀 1건 수정.
- 읽은 기준: AGENTS.md, CODEX_START_HERE.md, 확정 결정 01, 카탈로그 사양 04, 변경 관리 09, PLANS.md, [ExecPlan](../plans/2026-09-07-catalog-identity-quality.md).
- 실제 기존 AniList 103572 projection의 `5등분의 신부 ∫∫`와 원본 canonical을 함께 넣어 내보내기 차단을 확인했다. 기존 projection의 hash가 유효해도 `SERVICE_PROJECTION_V2_TITLE_PROJECTION_STALE`이 발생한다.

## 변경
- `tools/catalog-lab/pipeline/service-projection-v2.mjs:230`: 현재 규칙으로 제목 projection을 다시 만들고 preferredTitle, searchTitles, autoAcceptedTitleAliases, quarantinedTitles 및 정책 버전을 비교한다. 저장된 READY/reviewItems만으로 게시를 허용하지 않는다.
- `tools/catalog-lab/pipeline/title-identity-review.mjs:29`, `service-projection.mjs:335`: seed/preferred뿐 아니라 실제 검색으로 내보낼 출처 별칭 전체를 관련 시즌 충돌 검사에 포함한다. 정책은 V4_ALL_TITLE_IDENTITY_REVIEW로 갱신했다.
- `src/domain/search/titleSearchMatch.js:1`: 일반 검색은 장식 기호를 생략할 수 있다. 검색어에 명시된 기호는 제거하지 않는다. strict identity/cache key는 기호를 유지한다.
- AddAnime, quickActionRemote, legacyAliasTitleResolver에서 같은 검색 비교를 사용하고 변경된 원격 검색 캐시 버전을 갱신했다.
- service-projection, service-projection-v2, titleSearchMatch 테스트에 세 회귀 사례를 추가했다.

## 실제 데이터 재검사
별도 staging에서 4,224개를 다시 생성하고 검토된 32개 v2 bundle을 검증했다. 표시 제목 교정 16개, 한국어 명칭 대기 7개, scalar 충돌 59개, 누락 관련 작품 후보 32개는 유지된다. 새 규칙으로 다음 4개가 추가 검토/게시 차단 대상으로 잡혔다. 확정 오류 수는 아니다.

- (더빙) 쾌걸 근육맨 2세 — anime:d3821c62-5010-49db-a751-1d56e87fdcd1
- 퀸즈 블레이드: 아름다운 투사들 — anime:453d8b17-2843-4795-b985-06f148de2edb
- 카구야 님은 고백받고 싶어 -울트라 로맨틱- — anime:77ef9d7d-564c-40b3-935d-0376fc4ce1a2
- 장송의 프리렌: ●●의 마법 Part 3 — anime:747e012d-3987-43f9-b28b-d194b6d532ae

원본 근거 및 모든 행은 staging summary의 artifactPath를 따른다. 산출물: `D:/hong/Web/Anime/.moemoa-catalog-review-fix-stage/summary.json`, hash `26c26b26091ff476ad9a8b7d82afc99f2426c3b0536ab64dbaaad6be1c5ac55f`.

## 검증
- `node tests/unit/run-tests.mjs`: 227 통과.
- `node --test tests/catalog-lab/service-projection-v2.test.mjs tests/catalog-lab/service-projection.test.mjs`: 18 통과.
- `node tools/catalog-lab/reports/export-reviewed-aliases.mjs --check`: 32개 일치.
- Astro Node 24 build: 15페이지 성공.
- React Doctor: 72/100, 기존 5개 파일의 경고 6개 동일, 새 진단 없음.
- 첫 카탈로그 전체 실행: 239 통과, 1 실패, 1 시간 초과 취소, 2 skip. 이미지 decode 5초와 기존 raw lock 1초 제한에 걸려 다른 검증 작업 종료 후 재실행했다. 최종 결과는 아래 완료 기록을 따른다.

## 데이터·복구·영향·잔여 작업
DB migration, 원본 변경, 운영 게시, 추가 외부 수집은 없다. 별도 staging 출력과 코드 변경만 적용했다. 표지 bytes는 이번 검사에서 재디코딩하지 않았다. 사용자 데이터, 개인정보, 권리 정책, 분석 로그에 변화가 없다. 되돌릴 때 이번 제목 검증/검색 변경을 되돌리고 재생성 staging을 사용하지 않으면 된다. 기존 원본을 복원할 필요는 없다.

전체 작품 정확성 검증 완료를 뜻하지 않는다. 추가 4개 근거 검토, 누락 후보 복원(AniList 403 중단), 한국어 명칭 7개와 나머지 전수 검토는 남아 있다. 운영 배포는 별도 승인 후 수행한다.

## 완료 기록
- 카탈로그 전체 재실행: 243개 중 241 통과, 2 skip, 실패·취소 0. 로그: `D:/hong/Web/Anime/catalog-review-fix-tests-retry.log`.
- `git diff --check`: whitespace 오류 없음(기존 LF/CRLF 안내만 출력).
