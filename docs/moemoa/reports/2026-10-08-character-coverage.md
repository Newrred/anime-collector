# 캐릭터 데이터 보강 후보 — 2026-10-08

## 현재 확인한 사실

- 운영 active catalog: `catalog-add-7e982253b551b92984460a5e`, 작품 4,292개.
- 캐릭터 첫 페이지가 있는 작품 4,047개, 없는 작품 245개. 없는 작품의 상세 `people.characterCount`와 `pageCount`는 모두 0이었다.
- 누락 245개 중 AniList ID가 고유하게 연결된 작품 199개, 연결이 없는 작품 46개. 중복·충돌 ID는 0개.
- `ANILIST-PROD-01`은 사용자가 별도 확보한 Production 저장·표시·배포 허가를 확인한 기록이다. 권한 원문은 저장소에 없다. 공식 공개 약관의 일반 제한과 이 사용자 확인 허가를 구분한다.

## 후보 결과

- 고유 ID 199개를 AniList에서 작품 ID와 제목 별칭을 대조하며 재조회했다. 캐릭터가 확인된 작품 131개, AniList 응답에도 캐릭터가 없는 작품 68개.
- 131개 작품에 캐릭터 3,644명과 신규 페이지 186개를 추가하는 후보 `catalog-people-b05fefa545fcce9864eb476f`를 만들었다. 새 전체 페이지 수는 5,214개다.
- 검색·표지 행 전체, 기존 캐릭터 페이지 전체, 영향 없는 상세 4,161개는 기존 release_id를 제외하고 해시가 같다. 새 상세와 캐릭터 페이지의 행 해시·페이지 수를 독립 검증했다.
- 활성화 후에도 114개 작품은 캐릭터 정보가 없다: AniList에도 없는 68개와 ID 연결이 없는 46개. 이를 임의로 다른 작품과 병합하지 않는다.

## 앱 변경

`src/features/titles/application/titleCharacters.js`는 캐릭터를 자체 카탈로그에서만 읽는다. `TitleFavoriteCharacters.jsx`와 `HistoricalWatchLogEditor.jsx`도 카탈로그의 `anilist:<characterId>`를 기존 숫자형 즐겨찾기·감상 참조와 연결한다. 현재 `/library/`는 `/titles/`로 이동하며, 과거 미사용 `src/components/Library.jsx`의 AniList 호출은 이번 사용자 동선의 캐릭터 조회에 포함되지 않는다. 관련 시리즈의 AniList 요청은 별도 범위다.

## 검증 및 상태

- 단위 450/450, 카탈로그 256 통과·2 환경 건너뜀, 관련 Chromium 9/9, Web build 20페이지 통과. React Doctor 변경 범위 85점·진단 0.
- 원천 자료, 운영 사본, 후보 및 요약은 Git 밖 `D:/hong/Web/Anime/.moemoa-character-audit-2026-10-08/`에 보관한다. 재현 코드: `tools/catalog-lab/reports/missing-characters.mjs`, `tools/catalog-preview/character-backfill-release.mjs`.
- 사용자 승인 후 운영 DB에 후보를 staging하고 네 종류의 행(4,292/4,292/4,292/5,214개)을 전수 해시 비교했다. `catalog-people-b05fefa545fcce9864eb476f`를 활성화했고 익명 카탈로그 재감사에서 작품 4,292개 중 캐릭터가 있는 작품 4,178개, 없는 작품 114개(연결된 AniList에도 없는 68개·연결 없는 46개), 충돌 0개를 확인했다.
- 운영 DB에는 2026-09-24의 `activate_catalog_release_checked`가 없어 기존 `activate_catalog_release`로 전환했다. 이 함수는 release 해시, 전체 행 수, 표지 Storage 존재를 검사하지만 예상 이전 릴리스 ID를 원자적으로 비교하지는 않는다. 도구는 전환 직전 활성 포인터를 확인한다. 문제가 있으면 이전 release의 행을 재검증한 뒤 staging으로 되돌리고 기존 함수를 통해 재활성화한다.
- Git push 및 Web 배포는 이 기록 작성 시점에 아직 하지 않았다.
