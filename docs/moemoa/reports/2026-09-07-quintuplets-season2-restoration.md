# 5등분의 신부 2기 복원

상태: **운영 DB 반영 및 실제 웹 확인 완료**, 2026-09-07.

## 결과
- 대표 제목: `5등분의 신부 ∫∫` (NFKC 정규화 전 `∬`). AniList 109261.
- 신규 독립 ID: `anime:e8700a7d-79bb-4bed-ab38-0ee029e12c10`.
- TV, 2021-01-08~2021-03-26, 12화, Bibury Animation Studios.
- 운영 카탈로그 3,998 → 3,999개. 기존 작품 행은 release_id 외 모두 그대로 유지했다.
- 활성 release: `catalog-add-81297cd638290f972ca84c28`.
- 공개 RPC 및 운영 브라우저에서 `5등분` 검색 결과가 1기(103572), 2기(109261), 극장판(131520)으로 분리되는 것을 확인했다. 2기 클릭 후 신규 ID의 상세 화면에서 제목·12화·첫 방영일·제작사·전용 표지를 확인했다.
- 웹 코드 변경과 재배포는 필요하지 않았다. 기존 운영 웹 `dpl_6szkuJQhK7PjBDGa1Tnd3M9wqBaX`가 새 DB release를 읽는다.

## 읽은 문서·근거 및 한계
AGENTS.md, CODEX_START_HERE.md, 확정 결정 01, 카탈로그 사양 04, 변경 관리 09, [진행 ExecPlan](../plans/2026-09-07-catalog-identity-quality.md), 기존 source/normalizer/claim/cover/v2/export 및 DB activation 코드를 대조했다. 사용자 후속 진행 요청을 앞선 DB·웹 반영 작업의 누락 2기 복원으로 해석했다.

- [TBS 공식 2기 사이트](https://www.tbs.co.jp/anime/5hanayome/2nd/)에서 ∬ 제목과 2기 표기를 확인했다.
- [AniList 공개 작품 페이지](https://anilist.co/anime/109261/Go-toubun-no-Hanayome-/)를 실제 브라우저로 열어 제목·ID·날짜·화수·제작사·장르·관련 작품·표지 주소를 확인했다. PREQUEL은 103572로 명시된다.
- 한국어 출처는 실제 검색 결과에서 `5등분의 신부 ∬`, 2021년 TV 12화와 Bibury 제작사를 대조했다. 현재 확인 URL은 `https://anilife01.tv/content/25/12`이다. 이전에 언급한 content/614는 이 origin에서 다른 작품으로 표시돼 재사용하지 않았다. 다른 기존 AniLife binding을 일괄 변경하지 않았다.
- 승인된 API의 한 작품 요청은 여전히 HTTP 403 / SOURCE_PAUSED였다. 재시도 루프나 API 접근 우회는 하지 않았다. 공개 페이지의 수동 검토 관측값을 별도 parser/method와 hash로 기록했으며 성공한 API 응답으로 표기하지 않았다.
- 인물·성우와 일부 미관측 필드는 NOT_FETCHED로 남긴다. 이번 복원은 모든 필드 완전 검증이나 남은 관련 작품 전체 복원을 뜻하지 않는다.

## 변경 파일 및 데이터 경로
- `tools/catalog-lab/sources/anilist-reviewed-page.mjs`: 한 작품의 검토된 공개 페이지 관측을 출처 URL/ID/제목/검토자/시각/hash에 묶는 envelope 생성. 상세 payload는 기존 normalizer의 구조·내용 검증을 통과해야 한다.
- `tools/catalog-lab/pipeline/normalize.mjs`: 해당 제한된 공개 페이지 parser의 미관측 필드를 SOURCE_NOT_AVAILABLE이 아닌 NOT_FETCHED로 기록. 기존 API 처리는 유지한다.
- `tests/catalog-lab/anilist-reviewed-page.test.mjs`: ID/제목/host/검토 누락 거부, provenance 및 미수집 상태, 기존 API 상태 보존 회귀 검사.
- canonical과 표지는 `D:/hong/Web/Anime/.moemoa-quintuplets-s2-2026-09-07/lab/`에 별도 보존했다. 기존 `MOEMOA_CATALOG_LAB_TEST`의 4,224개 원본과 manifest는 바꾸지 않았다. 다음 전체 재생성에서는 **이 보충 workspace의 target.json/materialized.json 및 신규 ID를 반드시 함께 사용**해야 한다. 이를 무시하고 과거 full3998만 새로 활성화하면 신규 작품이 빠질 수 있다.
- 같은 상위 폴더의 capture.json, korean-evidence.json, target.json, materialized.json이 근거/매핑/산출물이다. 본문 소개나 스트리밍 영상은 수집·게시하지 않았다.

## 검증과 운영 변경
- 카탈로그 전체 테스트 246개: **244 통과, 2 skip, 실패 0**.
- 공개 페이지 importer 회귀 테스트 2개 통과. 기존 API 동작 보존 확인.
- 승인된 AniList CDN의 작품 ID 109261 표지를 기존 주소 고정 다운로드·파일 구조 검사·Chromium decode 경로로 검증했다. 460×650 PNG, checksum `2f3a9dd74f955d1c9725b62c6f77b3094fa43018009a9dfa3304ee51f49bbec0`. 이미지도 직접 확인했다. 1기 표지를 재사용하지 않았다.
- 기존 raw→normalized→claims→canonical→service projection→v2 validator 경로 통과.
- 신규 표지 업로드 후 공개 객체의 byte hash가 로컬과 동일함을 확인했다.
- 기존 운영의 assets/search/details 각 3,998행 및 people 4,899행 snapshot 보존. 새 릴리스는 assets/search/details 각 3,999행, people 4,899행. 전체 재조회와 hash 비교 통과 후 기존 activation RPC로 전환했다.
- 공개 조회 제목·별칭·상세 및 실제 운영 브라우저 검색→2기 Title Hub 확인 완료. 사용자 데이터 쓰기는 하지 않았다.
- `git diff --check` 통과. 앱 코드 변경이 없어 앱 테스트·React Doctor·웹 빌드는 재실행하지 않았다.

## 복구·보안·후속
DB schema migration과 기존 데이터 삭제는 없다. 관리자 키는 프로세스 환경에서만 읽었다. 신규 표지 외 사용자 이미지 업로드, Public UGC, 계정 변경은 없다.

이전 release `catalog-title-dd79a7b017076674b2950680`는 보존되어 있다. 같은 자격 증명 환경에서 `D:/hong/Web/Anime/.moemoa-quintuplets-s2-2026-09-07/db-release.mjs rollback`으로 직전 release를 재활성화할 수 있다. before.json/prepared.json/upload-verified.json/activation.json/public-verification.json을 함께 보존했다. 웹 rollback은 이번 DB 추가에 필요하지 않다.

남은 작업: 기타 미보유 관련 작품의 수록 판단·복원, 한국어 명칭 7개와 충돌 필드 검토, 로컬 전체 manifest와 보충 workspace를 통합하는 후속 관리. 기존 40개 미보유 후보 중 109261은 이번에 운영 복원됐지만 과거 감사 산출물의 숫자를 소급 변경하지 않았다. AniLife의 오래된 숫자 binding은 원본 origin·제목을 다시 확인해야 한다.
