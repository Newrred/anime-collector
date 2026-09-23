# 니세코이 2기 복원 및 유사 누락 탐지

## 운영 결과
2026-09-08 사용자 승인으로 니세코이 2기를 독립 등록했다. `니세코이` 검색에서 1기와 2기가 분리되고 `니세코이 2기`로 2기만 조회된다. 실제 운영 웹 검색→상세에서 전용 표지, TV 12화, 2015-04-10, Shaft를 확인했다. 웹 코드 재배포는 필요하지 않았다.

- 신규 ID: `anime:06115e96-7efa-404b-8233-6f92c8238818`; 검토용 AniList ID 20876.
- 이전 운영: `catalog-increment-7888d03d489d590b40f9280a`, 4,160개.
- 신규 운영: `catalog-add-cfd7de57fd596c974547fb15`, 4,161개.
- 기존 assets/search/details 각 4,160행, people 5,028행을 그대로 보존했다. 신규 버전의 assets/search/details 각 4,161행, people 5,028행 전체 재조회 hash 대조 통과 후 활성화했다.
- 새 표지는 승인된 AniList CDN에서 가져와 주소 고정 다운로드·구조 검사·Chromium decode·육안 검토 및 업로드 후 byte hash 일치를 확인했다. JPEG 460×647, SHA256 `1b07265bc5c142688897195034e91ca18e14dc85445cbd439b149cf93c03e182`.

## 출처와 미확인 범위
[AniList 공개 상세](https://anilist.co/anime/20876/Nisekoi/)의 원제·방영일·12화·제작사·1기 PREQUEL 관계와 [공식 방영 공지](https://www.nisekoi.jp/info/?article_id=33812), [공식 2기 안내](https://www.nisekoi.jp/1st/info/?p=34)를 교차 검증했다. API는 403으로 중단되어 기존 REVIEWED_PUBLIC_RENDERED_PAGE 경로를 사용했다. 원문 줄거리·리뷰는 복제하지 않았다. 등장인물·성우는 미수집 상태로 보존한다.

한국어 표시명 `니세코이 2기`는 사용자가 식별할 수 있도록 기존 한국어 시리즈명에 시즌을 붙인 서비스 편집 표기다. 국내 배급사의 정식 제목으로 주장하지 않는다. 원제 Nisekoi:와 ニセコイ：는 별칭으로 유지한다.

## 코드·문서 변경 및 검증
- `tools/catalog-lab/pipeline/service-projection.mjs`: 공개 페이지 출처로 검토한 편집 제목은 등록된, hash가 일치하는 title identity review가 있을 때만 수용한다. legacy 출처로 가장하지 않는다.
- `tools/catalog-lab/config/title-identity-reviews.json`: 새 작품의 원문 증거·canonical/seed hash에 묶인 검토 기록 추가.
- `tools/catalog-lab/reports/missing-related-works.mjs`: snapshot 전체의 보유 ID/제목·별칭, 교정 시 제외 별칭, 저장된 관련작을 대조하는 오프라인 감사 도구.
- 관련 테스트 28/28 통과: 승인 없는 편집 제목 거부, 제목 기호 보존, 복원 후 후보 제거, 동일 제목/다른 ID 검토 분류, 비애니 관계 제외, 기존 v2 검증과 교정 규칙 회귀.
- 공개 API에서 `니세코이`, `니세코이 2기`, `Nisekoi:` 검색 및 신규 상세·별칭을 확인했다. 실제 운영 브라우저 검색/상세 확인도 완료.
- 기준 문서: AGENTS, CODEX_START_HERE, 확정 결정 01, 카탈로그 04, PLANS 및 기존 5등분 2기 복원 절차. 계획: `../plans/2026-09-08-missing-season-restoration.md`.

## 유사 누락 감사
4,161개 작품의 애니 관련 관계 6,868개를 검사했다. 교정에서 제거한 별칭과 일치하면서 독립 대상이 없는 우선 후보는 복원 전 25개에서 24개로 줄었다. 그 외 TV 전후 시즌 후보 201개, 같은 제목의 다른 ID가 있어 중복 검토가 필요한 후보 24개, 나머지 관련작 2,302개를 분리했다. 이 수치는 저장된 관계 기준의 후보이며 전체를 확정 누락으로 해석하지 않는다.

[우선 24건 및 TV 시즌 후보 목록](2026-09-08-missing-season-candidates.md). 다른 후보는 아직 운영에 추가하지 않았다.

## 보안·복구·재생성
스키마/사용자 데이터/계정/이미지 공개 정책 변경 없음. 관리자 키는 환경에서 읽고 출력하지 않았다. 신규 표지 외 이미지 업로드 없음. 기존 release와 snapshot 보존. 커밋·push 없음.

작업 증거: `D:/hong/Web/Anime/.moemoa-nisekoi-s2-2026-09-08`의 capture.json, korean-evidence.json, target.json, canonical-review.json, materialized.json, before.json, prepared.json, upload-verified.json, activation.json, public-verification.json, missing-before.json, missing-after.json.

다음 전체 카탈로그 재생성 시 이 보충 target/canonical과 기존 `.moemoa-quintuplets-s2-2026-09-07` 보충본을 반드시 포함해야 한다. 현재 기본 seed manifest에 자동 합쳐졌다고 간주하면 안 된다. 새 canonical을 다시 수집하면 hash에 묶인 제목 검토도 재검토해야 한다.

복구는 동일 관리 환경에서 위 작업 폴더의 `node db-release.mjs rollback`을 실행하여 직전 release를 재활성화한다. 기존 작품/개인 데이터 복구는 필요하지 않다.
