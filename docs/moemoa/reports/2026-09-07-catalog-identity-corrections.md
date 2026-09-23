# 카탈로그 제목 연결 교정 — 2026-09-07

**로컬 교정·앱 검색 연결·재발 방지 구현 완료. 전수 내용 검증, 누락 작품 복원, 운영 배포는 미완료다.**

## 적용 결과

4,224개 최신 canonical과 기존 projection의 hash를 확인하고 새 projection을 별도 staging에 생성했다. 원본 raw, canonical, current pointer, aliases roster와 운영 DB는 수정하지 않았다.

| 결과 | 수량 | 범위 |
| --- | ---: | --- |
| 제목 연결 검토 | 32 | TITLE_BINDING_ONLY. 전체 필드 검증 완료가 아님 |
| 표시 제목 교정·구체화 | 16 | 다른 시즌 제목 또는 시리즈 통칭을 해당 ID의 제목으로 한정 |
| 별칭 격리 중심 처리 | 15 | 대표 제목 유지, 다른 작품 고유 별칭 격리 |
| 오탐 유지 | 1 | 바쿠만 2기. 자체 원제의 2가 시즌 근거 |
| 한국어 명칭 미확인 | 7 | 정확한 원제를 임시 표시하고 검토 대기 기록 |
| 관련 작품 누락 후보 | 32 | 로컬 4,224개 external ID 목록에 없음. 모두 자동 추가 대상이라는 뜻은 아님 |
| scalar 충돌 작품 | 59 | 화수 52 / 시작일 7. 임의 첫 값 대신 null과 검토 상태 사용 |

1차 자동 검사의 검토 후보 568개·근거 공백 312개 전체를 해결한 것은 아니다. 무경고 3,370개 역시 독립 검증 완료로 승격하지 않았다. 표지 bytes·시각적 일치 여부는 이번 staging에서 재검증하지 않았다.

## 주요 전후 값

| AniList ID | 이전 표시 | 교정 표시 |
| --- | --- | --- |
| 103572 | 5등분의 신부 ∫∫ | 5등분의 신부 |
| 100977 | 일하는 세포!! | 일하는 세포 |
| 20755 | 암살교실 2기 | 암살교실 1기 |
| 8557 | 침략! 오징어 소녀 2기 | 침략! 오징어 소녀 |
| 122148 | 구울 거면 머그컵도 두 번째 가마 | 구울 거면 머그컵도 |
| 21609 | 12세 ~작은 가슴의 두근거림~ 2기 | 12세 ~작은 가슴의 두근거림~ |
| 11783 | DOG DAYS''(3기) | DOG DAYS'(2기) |
| 21569 | 게키돌 | Alice in Deadly School — 한국어 명칭 검토 대기 |

나머지 구체화 항목은 5538, 20693, 20947, 21058, 21688, 103712, 110521, 146984다. 모든 전후 값은 staging 보고서와 `config/title-identity-reviews.json`에 있다. 다국어 브랜드 별칭이 원본 공급자에도 존재하는 경우는 무조건 삭제하지 않았다. 예를 들어 anthology의 개별 단편명이나 Gekidol 공통 브랜드는 대표 제목과 검색 별칭의 역할을 구분했다.

5등분은 자체 canonical의 2019년 1기 제목·관계 ID와 [TBS 1기](https://www.tbs.co.jp/anime/5hanayome/1st/), [TBS 2기](https://www.tbs.co.jp/anime/5hanayome/2nd/), [왓챠 한국어 1기](https://watcha.com/ko/contents/tP8aGBz)를 교차 확인했다. 2기 한국어 제목과 별도 출처 ID는 [AniLife 614 상세](https://anilife.app/content/614/5%EB%93%B1%EB%B6%84%EC%9D%98%20%EC%8B%A0%EB%B6%80%20%E2%88%AC/info), 1기는 [AniLife 945](https://anilife.app/content/945?tab=info)에서 구분된다. 이 두 source ID를 기존 1기 ID에 함께 넣지 않았다.

## 재발 방지와 앱 적용

- 교정은 canonical hash와 seedTitles hash가 검토 당시 값과 일치할 때만 적용한다. 입력 변경 시 `TITLE_IDENTITY_REVIEW_STALE`로 실패하고 재검토를 요구한다.
- 새로운 관계 제목 충돌은 `TITLE_IDENTITY_REVIEW_REQUIRED`로 남고 v2 게시용 변환에서 거부된다. 근거 검토 없이 자동 합치거나 새 ID를 만들지 않는다.
- raw/canonical에서 삭제하지 않고 service projection의 대표 제목·검색 제목과 격리 기록을 교정한다. 적용 근거 hash를 quality warning에 남긴다.
- 화수·시작일 등 scalar가 CONFLICTED일 때 v2가 첫 값을 사실로 내보내던 동작을 제거했다. 원본 충돌은 유지하고 UI용 값은 null, 검토 항목은 명시한다.
- 앱의 AddAnime, Library, 빠른 검색, Memory 작성의 로컬 제목 검색이 동일한 reviewed alias 읽기 경로를 사용한다. 원본 roster가 변경된 교정 항목은 자동 재적용하지 않고 제외한다.
- `∬`, `?`, `:`, prime 등 시즌 기호를 로컬 비교와 검색 캐시 키에서 보존한다. 기존 캐시 namespace를 변경해 오래된 잘못된 제목을 재사용하지 않는다.
- 한국어 명칭 미확인 항목에 임의 번역을 만들지 않았다. 앱에서는 확인된 원제를 사용하며 LEGACY_UNVERIFIED 상태를 유지한다.

## 외부 수집 상태와 남은 작업

누락 후보의 정확한 AniList ID 32개를 대상으로 기존 source registry·adapter·속도 제한을 사용해 추가 증거 수집을 시작했다. 첫 대상 109261 요청이 HTTP 403 / SOURCE_PAUSED로 종료돼 후속 요청을 중단했다. 이 실행에서 새 작품 응답을 저장하거나 운영에 추가한 건수는 **0**이다. 처음에는 서로 다른 공급자용 endpoint 검증 함수를 사용한 로컬 연결 오류를 수정했으며, 이후 실제 등록 endpoint 요청에서 403을 확인했다.

완료되지 않은 항목:

1. 승인된 출처의 접근 가능 상태를 확인한 뒤 누락 후보의 상세·표지 증거를 수집하고 검토한다. 다른 작품의 정보를 복제해 빈 레코드를 채우지 않는다.
2. 한국어 명칭 미확인 7개를 확인한다. DOG DAYS는 [AniLife 2170](https://anilife.app/content/2170/DOG-DAYS-2%EA%B8%B0-)의 한국어 표기·2012년 3분기·13화를 자체 2기 원제와 대조해 추가 확정했다.
3. 나머지 자동 검토 후보와 근거 공백, scalar 충돌 59개, 공식 URL 충돌을 출처별로 확인한다.
4. 전체 시리즈 검색, 누락 시즌, 표지 일치를 확인한 뒤 게시용 산출물과 복구 목록을 완성한다.
5. 운영 배포는 별도 단계다. 현재 결과만으로 전수 교정 완료라고 판단하거나 배포 승인을 요청하지 않는다.

## 파일·검증·복구

읽은 기준: AGENTS.md, CODEX_START_HERE.md, 확정 결정, catalog ingestion spec, PLANS.md, 승인된 identity quality ExecPlan. React 연결 변경에 `C:/Users/hongs/.codex/skills/react-doctor/SKILL.md`를 적용했다.

핵심 변경:

- `tools/catalog-lab/config/title-identity-reviews.json`: 32개 검토 근거.
- `pipeline/title-identity-review.mjs`, `title-identity-signals.mjs`, service projection v1/v2: 교정·차단·충돌 처리.
- `reports/stage-identity-corrections.mjs`, `export-reviewed-aliases.mjs`: 원본을 수정하지 않는 재생성·앱 교정표 생성.
- `src/data/reviewedAliasSeed.js`, `reviewed-alias-overrides.json`, `src/domain/search/applyReviewedAliases.js`: 앱 공통 교정 읽기 경로.
- 4개 alias 소비 경로와 로컬 검색 비교·캐시, 관련 unit/catalog 테스트.

검증:

- 카탈로그 전체: **239 통과, 2 조건부 skip, 실패 0**.
- 앱 단위: **225 통과, 실패 0**. 실제 roster의 5등분/암살교실 교정, 시즌 기호별 검색 분리, stale 교정 제외, 원본·ID 보존 포함.
- Node 24 Astro build: **15페이지 성공**. 출력은 별도 `.moemoa-identity-web-check`이며 Android assets/APK를 갱신하지 않았다.
- React Doctor 최신 실행: **72/100**, 두 실행에서 동일한 6개 기존 경고. 해당 경고는 이번 수정 파일에 없고 진단 JSON이 동일하다. 과거 도구 실행의 84점과 직접 비교하지 않았다.
- 전체 staging: **4,224개**, 검토 대상 32개 v2 DTO 검증, 격리 제목의 상세 DTO 재유입 검사, 실행 중 current pointer 변경 검사 통과.
- 마지막 DOG DAYS 한국어 표기 수정은 관련 검사 7개와 해당 작품 v2 DTO를 추가 검증했다. 불필요하게 반복되던 전체 재생성을 중단하고, 직전 전체 staging의 hash를 확인한 뒤 변경된 1개 행만 재생성했다. 새 보고서에 이전 artifact hash와 재사용 4,223행을 명시했다.

staging: `D:/hong/Web/Anime/.moemoa-catalog-corrections-2026-09-07/summary.json`; 해당 파일이 최신 immutable report 경로와 hash를 가리킨다. 1차 원본 감사는 `.moemoa-catalog-identity-audit-2026-09-07`에 보존돼 있다.

DB migration, 운영 데이터 변경, 배포, 기존 사용자 데이터 이관은 없다. 코드·교정표를 이전 상태로 되돌리고 기존 projection을 사용하면 복구할 수 있으며 원본 pointer는 변경하지 않았다. 개인 데이터와 비밀 키를 수집·기록하지 않았고 출처 사용 범위를 확장하지 않았다.
