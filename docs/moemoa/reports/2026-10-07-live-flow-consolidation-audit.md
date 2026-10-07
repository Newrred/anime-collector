# 운영 화면 흐름 정리 — 2026-10-07

## 확인 범위

- `www.moemoa.xyz/build-info.json`에서 Git 배포 SHA `31fd31eea91760b6737b5b2e9fc9d25318c1ddd0`를 확인했다. `source=vercel-git`, `deploymentConfig.semanticMatch=true`다.
- 운영 Chrome에서 `/`, `/titles/`, `/title/`의 기억·감상 탭, `/record/`, `/archive/`, `/boards/`, `/library/?focus=edit`, `/tier/`, `/data/`를 읽기 전용으로 확인했다. 저장·삭제·배포는 하지 않았다. 공개 저장소용 문서에는 계정 식별자와 개인 기록 건수를 싣지 않았다.
- 이 문서는 화면/진입점 감사다. 실제 데이터 모델을 합치거나 기존 감상·Memory·선반 기록을 변경하자는 뜻이 아니다.
- 저장소에 `src/components/Home.jsx`가 남아 있지만 현재 `/`는 `src/pages/index.astro:2-5`에서 `BookshelfView`를 렌더링한다. 이 파일은 이번 운영 화면 혼재의 직접 원인으로 세지 않았다.

## 현재 사용자 경로

```text
상단 컬렉션(/) ── 선택한 선반의 작품 ── 작품 상세(/title/)
상단 작품(/titles/) ── 저장 작품 + Memory가 있는 작품 ── 작품 상세
상단 기억(/archive/) ── Complete Memory ── Memory 상세
상단 기억 남기기(/record/) ── 감상 기록 ── 작품 상세의 감상 탭
                            └─ 장면·이미지 ── Memory 작성(/memory/new/)
작품 상세의 감상 탭 ── 기존 기록 수정·삭제 ── 예전 서재(/library/?focus=edit)
관리 메뉴 ── 감상 이력 관리(/library/?focus=edit), 보드, 티어, 계정·데이터
```

이 분기는 `src/components/PrimaryNavigationLinks.jsx:3-8`, `src/components/TopNavDataMenu.jsx:197-198,343-358`, `src/features/titles/components/RecordStart.jsx:58-58`, `src/features/titles/components/TitleWatchRecords.jsx:103-114`에 구현되어 있다. `/library/`는 일반 진입 시 새 작품 상세/목록으로 보내지만, `focus=edit`와 `focus=quick-log`에서는 예전 전체 서재를 렌더링한다(`src/features/titles/domain/titleNavigation.js:52-64`, `src/features/titles/components/LegacyLibraryRoute.jsx:6-15`).

## 혼재의 실제 원인

| 우선순위 | 관찰 | 원인과 사용자 영향 | 정리 방향 |
| --- | --- | --- | --- |
| P0 | 운영 `/titles/`와 `/library/?focus=edit`가 같은 저장 작품을 별도 표지 목록으로 보여준다. 전자는 새 작품 화면이고, 후자는 예전 필터·포스터 크기·상세 모달 UI다. | 감상 작성·조회는 Title Hub로 옮겼으나 기존 기록의 수정·삭제, 상황 태그·캐릭터 관리는 여전히 예전 서재에 있다(`src/features/titles/components/TitleWatchRecords.jsx:109-115`, `src/components/library/LibraryDetailModal.jsx:326-355`). 이를 숨기기만 하면 기능이 끊기므로 **기능 이동 후** 진입점을 정리해야 한다. | Title Hub 감상 탭에 기존 기록 관리 기능을 옮기고 `/library/?focus=edit` 딥링크를 호환 경로로 전환한다. |
| P1 | 상단 `기억 남기기`에서 감상 기록과 장면·이미지를 고른다. 그러나 `기억` 목록은 이미지가 있는 Memory만 표시한다. | 감상 기록도 일반어로는 기억이지만 저장 후 Archive에 나타나지 않아 누락처럼 느껴진다. 데이터 모델상 감상 기록과 Memory는 별개라는 확정 결정(`docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md:80-89`)은 유지해야 한다. | 첫 진입에서 각 기록의 저장 위치를 짧게 명시하고, 저장 완료 피드백에서도 작품의 감상 탭과 Memory Archive를 구별한다. 명칭 변경은 별도 제품 결정으로 검토한다. |
| P1 | 운영 컬렉션은 선택한 선반의 작품만, 내 작품은 저장 작품과 Memory가 있는 작품을 보여준다. | 오류나 중복 데이터가 아니라 선반 선택 집합과 전체 작품 집합의 차이다(`src/features/bookshelf/BookshelfView.jsx:60-65`, `src/features/titles/components/TitleCollectionView.jsx:172-172`). 다만 첫 화면만 보면 다른 작품이 사라진 듯하다. | 컬렉션의 짧은 설명에 ‘내 작품에서 골라 진열한 작품’임을 표시하고 전체 작품으로 가는 링크를 상시 제공한다. 승인된 컬렉션/작품 두 화면은 유지한다. |
| P1 | `/data/`에는 계정 동기화, `기억·보드 백업`, `작품 기록 백업`이 나란히 있다. | 세 작업은 범위가 다르다. 운영 화면에서 작품·감상 기록 동기화가 가능하지만, 각 다운로드 파일은 전체 데이터를 한 번에 담지 않는다(`src/components/DataCenter.jsx:264-265`, `src/components/data/ManualDataTools.jsx:244-244`). 사용자가 ‘백업 완료’를 전체 보호로 오해하기 쉽다. | ‘계정 동기화’와 ‘파일 내보내기’를 분리하고, 파일별 포함/제외 범위를 한 표로 요약한다. 복원 동작과 파일 형식은 유지한다. |
| P2 | 티어는 관리 메뉴에 있으면서 별도 전체 작품 그리드를 제공한다. 운영 `/tier/`는 대상 작품을 표시하지만 전부 미분류인 상태도 가능하다. | 작품 탐색과 비슷한 화면이 하나 더 생기고 `/data/`의 ‘티어에 올린 애니 수’는 미분류 대상까지 포함한다(`src/components/DataCenter.jsx:51-75,249-249`). | 티어를 ‘추가 도구’로 묶고, 수치는 ‘티어 보드 대상 작품’처럼 실제 의미에 맞게 표시한다. 사용자 랭킹 기록은 보존한다. |

## 권장 목표 흐름

1. `컬렉션`은 사용자가 진열한 선반, `작품`은 저장 작품과 Memory가 있는 작품, `기억`은 이미지/디자인 Memory, `보드`는 Memory 묶음으로 역할을 고정한다. 현행 승인된 컬렉션 구조와 두 작품 보기 방식은 유지한다(`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:674-695,713-719`).
2. 작품에 관한 모든 감상 작업의 대표 상세는 **Title Hub 한 곳**으로 둔다. 감상 작성·조회·수정·삭제·상황 태그·캐릭터까지 갖춘 뒤 예전 서재 목록의 일반 진입을 없앤다. 직접 저장한 오래된 링크는 같은 작품의 감상 탭으로 안전하게 연결한다.
3. 공통 작성 진입은 감상 기록과 장면·이미지 저장을 분명하게 나누되 둘의 저장 결과를 혼동시키지 않는다. 작품 저장, WatchLog, Memory는 독립 모델로 유지한다(`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:68-78,704-709`).
4. 보드와 티어는 별개다. 보드는 Memory를 모으는 선택 기능이고, 티어는 작품 순위 도구다. 관리/설정 메뉴에서 두 기능을 동등한 ‘계정 관리’처럼 섞지 않는다.

## 구현 순서와 검증 기준

1. **기능 대비표:** 기존 `LibraryDetailModal.jsx`, `LibraryQuickLogSheet.jsx`의 감상 수정·삭제·태그·캐릭터·메모와 Title Hub 감상 탭을 항목별 비교한다. 기존 작품·감상 기록의 읽기·수정·삭제 계약, 자체 카탈로그 ID와 외부 ID 없는 작품을 모두 포함한다.
2. **Title Hub에 누락 기능 이동:** 새 감상 작성과 기존 감상 관리가 같은 작품 화면에서 끝나게 한다. 실제 삭제는 명시 확인과 기존 저장 규칙을 따른다. 이 단계 전에는 예전 서재 진입을 제거하지 않는다.
3. **호환 경로 정리:** `/library/?focus=edit&animeId=…`와 `focus=quick-log` 등 기존 링크를 같은 작품/동작으로 옮긴다. 상단 메뉴의 옛 서재 바로가기를 제거하고 새 작품 경로를 사용한다. 일반 `/library/`의 현재 호환 동작도 유지한다.
4. **문구/정보 구조:** 컬렉션과 내 작품의 포함 범위, 감상과 Memory의 결과 위치, 동기화와 각 파일 백업의 포함 범위를 화면에 짧게 명시한다. 티어는 보조 기능으로 남긴다.
5. **회귀:** 데스크톱/320·390px, 키보드 뒤로가기·딥링크·로그인 전후·두 기기 동기화, 기존 작품·감상 건수 유지, 감상 수정/삭제/백업 복원, Memory/Board 영향 없음을 검사한다. 관련 기존 테스트는 `tests/watch-record-flow.spec.ts:44-45`, `tests/library-userflow.spec.ts:14-27`, `tests/title-navigation.spec.ts:36-36`, `tests/layout-mobile.spec.ts:143-143`이다.

## 범위와 게이트

- 이번 감사에는 코드/DB/데이터 변경과 운영 배포가 없다. UI 동작 구현은 다중 파일 작업이므로 `PLANS.md`에 맞춘 ExecPlan을 먼저 작성한다.
- 데이터 삭제, Legacy Library 데이터 이관, 공개 범위 변경은 제안하지 않는다. 기존 기능을 이동하기 전 예전 경로를 제거하지 않는 것이 핵심 롤백 경계다.
- ‘기억 남기기’ 명칭 변경 또는 컬렉션을 작품 탭에 흡수하는 변경은 현재 확정된 제품 방향과 맞물리므로 별도 승인 없이 적용하지 않는다.
