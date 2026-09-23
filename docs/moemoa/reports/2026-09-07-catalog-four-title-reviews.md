# 추가 4개 제목 연결 검토

## 판정과 출처
이번 검토는 제목·별칭 연결 범위이며, 더빙 판본·모든 필드·표지의 완전 검증은 아니다. 네 대표 제목은 유지한다.

| 대상 | 판정 | 근거 |
| --- | --- | --- |
| ANILIST:1707 쾌걸 근육맨 2세 | 번호 감지 오탐, 별칭 유지 | [동영 공식 작품 목록](https://lineup.toei-anim.co.jp/ja/tv/niku/)의 2002년 TV 작품명 및 [첫 회 소개](https://lineup.toei-anim.co.jp/ja/tv/niku/episode/1/)의 세대·인물 설명을 원본 일본어 제목과 대조. II는 작품의 세대명. 기존 더빙 표기를 새로 인증한 것은 아님. |
| ANILIST:8456 퀸즈 블레이드: 아름다운 투사들 | 대표 제목 유지, `Queen's Blade OVA` 별칭 하나 격리 | [공식 상품 목록](https://queensblade.net/goods/anime.html)은 해당 부제를 TV 두 작품 이후 OVA로 명시. 포괄 별칭은 원본의 별도 관련 ID 10924 제목과 정확히 겹침. 틀린 별칭으로 단정하지 않고 모호성 때문에 격리. |
| ANILIST:125367 카구야 울트라 로맨틱 | 시즌 번호 감지 오탐, 별칭 유지 | [공식 제3기 사이트](https://kaguya.love/3rd/) 및 [공식 제작진 자료](https://kaguya.love/3rd/assets/3rd/t/img/top/shinbun.pdf), [공식 티저](https://www.youtube.com/watch?v=vFN5K-iAyV0)를 대조. Season 3은 본편에 맞는 번호이며 티저에도 같은 번호가 쓰임. |
| ANILIFE:3514 프리렌 마법 Part 3 | 번호 체계 차이, 별칭 유지 | 자체 원제 Part 3/3クール과 [공식 미니 애니 공지](https://frieren-anime.jp/news/4297/)를 대조. 본편 제2기 방영에 맞춘 미니 애니 재개를 확인. 공식 공지가 Part 3이라는 외부 출처의 분할명까지 인증한다는 의미는 아님. 본편과 병합하지 않음. |

확인일: 2026-09-07. 출처 전문을 복제하지 않고 링크·판정 근거를 저장했다.

## 구현과 검토 범위
- 기준 문서: AGENTS.md, CODEX_START_HERE.md, 확정 결정 01, 카탈로그 사양 04, 변경 관리 09, PLANS.md 및 [ExecPlan](../plans/2026-09-07-catalog-identity-quality.md).
- `tools/catalog-lab/config/title-identity-reviews.json`: 원본 canonical/seed hash에 묶인 4개 검토 기록 추가. 전역 검사 기준은 완화하지 않았다. 원본이 바뀌면 이전 판정을 재사용할 수 없다.
- `tools/catalog-lab/pipeline/title-identity-review.mjs`: 모호한 별칭의 격리 사유를 `REVIEWED_AMBIGUOUS_TITLE`로 구별.
- `tools/catalog-lab/reports/export-reviewed-aliases.mjs`, `stage-identity-corrections.mjs`: AniList 전용 legacy 별칭 경로에 AniLife 번호가 들어가지 않도록 provider를 확인한다. 표출 로그의 고정 32개 숫자도 실제 생성 수로 변경했다.
- `src/data/reviewed-alias-overrides.json`: AniList 35개 교정표 재생성. 전체 제목 검토 36개와 다르다. AniLife 프리렌은 catalog projection에서 처리한다.
- `tests/catalog-lab/title-identity-review.test.mjs`, `reviewed-alias-export.test.mjs`: 네 감지 사례 재현, 정상 제목 유지, 모호한 별칭 격리, stale hash 거부 및 다른 provider의 번호 제외를 검증.

## 실제 데이터 재검사
4,224개 전부 재생성: 제목 연결 검토 36개, 누적 대표 제목 교정 16개, 현재 규칙의 미해결 제목 감지 0개. 검증된 v2 bundle은 승인된 AniList 표지 조건을 갖춘 35개다. 프리렌의 fallbackSeedProposal은 null로 확인했다. 검출 0은 전체 작품 정확성 검증 완료가 아니다.

검토 작품의 관련 작품 목록까지 확대하면서 미보유 관련 ID 후보는 32개에서 40개가 됐다. 새 오류 8개를 뜻하지 않으며 본편·특별편·예고편 등 수록 범위를 확인해야 한다. 한국어 명칭 미확인 7개, scalar 충돌 59개는 유지한다.

산출물: `D:/hong/Web/Anime/.moemoa-catalog-four-reviewed-stage/summary.json`. Hash: `7790dca72056406cf56db5e3ea90ccce80b392b1d1d38c0573d1074c358da7b4`.

## 데이터 변경·복구·보안 및 잔여 작업
원본·DB·운영 데이터 변경과 배포는 없다. 별도 staging 출력만 작성했다. 사용자 데이터·개인정보·권리 정책에 영향 없고 외부 추가 수집은 재개하지 않았다. 표지 bytes 재검증도 이번 범위가 아니다. 복구는 이번 4개 검토 기록과 코드 변경을 되돌리고 이전 교정표를 재생성하면 된다. 기존 원본을 복원할 필요는 없다.

현재 네 항목에 사용자 판단은 필요하지 않다. 누락 후보 범위/복원, 나머지 전수 검토, 한국어 명칭 및 충돌 필드 검토가 남았다. 운영 배포는 별도 승인 후 수행한다.

## 검증 결과
- 앱 단위 테스트: 227 통과.
- 카탈로그 전체: 244개 중 241 통과, 기존 Chromium 표지 decode 시간 초과 1개, 2 skip. 변경 관련 테스트는 모두 통과했다. 실패 파일을 단독 재실행해 통과했으며 로그는 `D:/hong/Web/Anime/catalog-four-review-cover-retry.log`에 보존했다.
- 별칭 생성 검증: 35개 일치. 실제 staging에서 네 항목의 제목 review 차단 해제 및 앱 퀸즈 블레이드 별칭 격리를 재확인했다.
- `git diff --check`: 통과. React 컴포넌트 코드는 이번에 변경하지 않아 React Doctor·웹 빌드는 재실행하지 않았다.
