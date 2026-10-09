# MOEMOA 현재 구조와 화면 흐름

> 기준: 2026-10-09 구현 `d4f6d91`의 Git `master`/Vercel 운영 SHA 일치·CI 두 job success와 실제 두 화면 삭제 수렴 확인. 문서 후속 커밋의 최신 SHA는 [운영 빌드 정보](https://www.moemoa.xyz/build-info.json)를 대조한다. 이 문서는 **현재 구현**을 설명하며 미래 목표·취소된 시안·과거 보고의 ‘최신’ 문구보다 실제 코드를 우선한다.

> **2026-10-08~09 자동 저장 반영:** 로그인 사용자의 새 카드·보드와 기록 변경은 기기 저장 뒤 계정 반영을 자동 시도한다. 새로 선택해 저장한 개인 사진은 비공개 최적화 사본을 전송하고, 실패 시 같은 카드·전송 의도로 복구한다. Guest는 공식 표지 카드·작품/감상을 기기에 저장하며 사진 작성에는 로그인이 필요하다. 신규 시스템 디자인 작성은 종료했고 기존 디자인 카드는 보존한다. 운영 사진 flag는 `1`, Public 관련 flags는 `0`이다. [확정 결정](01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md#decision-log--automatic-save-and-guest-cover-01-2026-10-08), [설정 지도](operations/2026-10-08-configuration-map.md), [최신 사진 검증·실기기 잔여](plans/2026-10-09-private-photo-reliability-and-handoff.md)를 따른다.

> **2026-10-07 운영 반영:** 감상 기록 작성·같은 ID 수정/삭제, 현재 작품 상태/평점/재시청/메모 수정, 캐릭터 즐겨찾기 고정/해제와 관련 시리즈 보기/명시 저장이 `/title/`에 있다. 유효한 작품 ID가 있는 옛 `focus=edit/quick-log` 링크는 새 상세의 감상 탭으로 이동한다. ID 없는 옛 목록과 `legacy=1` 호환 진입은 남는다. 캐릭터 즐겨찾기는 여전히 **이 기기에만** 저장된다. 기능 커밋 `83cdf49`를 Git/Vercel 운영에서 확인했고, 이 문서의 최종 배포 커밋은 아래 동적 확인 링크를 따른다. [실행 계획과 검증](release-v2/01_RELEASE_EXECUTION_PLAN.md#2026-10-07-w18-옛-서재-기능-대비작품-상세-연결).

- [공개 소스 저장소](https://github.com/Newrred/anime-collector) · 기본 브랜치 `master`
- [현재 운영 Web](https://www.moemoa.xyz/) · [실제 제공 커밋 확인](https://www.moemoa.xyz/build-info.json)
- [현재 화면 혼재 감사와 개선 순서](reports/2026-10-07-live-flow-consolidation-audit.md)
- [확정 제품 결정](01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md) · [제품 모델/사용자 흐름](02_PRODUCT_SCOPE_AND_USER_FLOWS.md)

## 한눈에 보는 구조

```text
Astro 경로(src/pages) + React 화면(src/components, src/features)
       │
       ├─ 작품 검색/카탈로그 읽기 ── Supabase catalog
       ├─ 작품 저장 상태·감상 기록 ── 로컬 저장소 ── 계정별 Supabase 동기화
       ├─ Memory/Visual/Board ──── IndexedDB + 플랫폼 이미지 adapter
       │                             └─ 계정 metadata 동기화
       └─ 계정/백업/운영 도구 ─────── Supabase Auth·RPC / 파일 내보내기

Web: Archive·Board·계정/관리 화면
Android: Capacitor shell에서 공통 Web UI와 native 이미지 수집 adapter 재사용
```

`package.json:1-7,62-74`가 Astro/React/Capacitor/Supabase 구성을 정의한다. `src/pages/index.astro:2-6` 등 Astro 경로가 React 화면을 붙인다. Memory 런타임은 IndexedDB repository와 플랫폼 이미지 수집 adapter를 선택한다(`src/features/memory/runtime/platformMemoryRuntime.js:1-43`). 배포는 `vercel.json:1-7`의 `npm ci`/`npm run build`를 사용한다. Android 코드가 저장소에 있다는 사실은 현재 Web 배포가 Android 앱 배포라는 뜻이 아니다.

## 현재 사용자 화면 지도

| 경로 | 현재 역할 | 대표 이동 |
| --- | --- | --- |
| `/` 컬렉션 | 사용자가 골라 선반에 진열한 작품과 그 작품의 Memory 미리보기. 전체 작품 목록과 집합이 다르다. | 표지의 기억 펼침, 작품 상세 `/title/`, 선반 편집 |
| `/titles/` 내 작품 | 저장 작품과 Complete Memory가 있는 작품의 합집합. 표지 보기/기억 함께 보기, 필터·검색. | 작품 상세 `/title/` |
| `/title/` 작품 상세 | 한 작품의 카탈로그 표지·정보, 저장/시청 상태, 감상 기록 탭, Memory 탭. | 감상 기록 작성·수정·삭제, 현재 작품 정보 수정, 캐릭터 고정·관련 시리즈, Memory 작성 |
| `/record/` 공통 작성 진입 | 감상 기록과 장면·이미지 Memory 작성 중 선택. | 감상은 작품 상세 감상 탭, 이미지는 `/memory/new/` |
| `/memory/new/` | 공식 표지 또는 로그인 사용자의 개인 사진으로 Memory 작성. 신규 시스템 디자인 선택은 종료. | 완료 후 `/archive/` |
| `/archive/`, `/memory/card/` | 완성된 Memory의 전체 목록과 상세·수정/관리. 일반 감상 기록은 여기에 나타나지 않는다. | 작품 상세, 보드 |
| `/boards/` | Memory를 사용자가 선택해 묶는 비공개 보드. | Memory 상세, 선택적 공개 흐름 |
| `/data/` | 계정 로그인·동기화, 저장 공간, 범위가 서로 다른 파일 백업/복원. | 계정 동기화·백업 |
| `/tier/` | 작품 순위 도구. Memory 보드와 별개. | 관리 메뉴의 보조 기능 |
| `/library/?focus=edit` | **ID 없는 기존 서재 호환 목록.** 일반 메뉴에서 연결하지 않는다. ID가 있는 옛 감상 링크는 `/title/`로 전환한다. | 회귀·백업 호환 |

라우트 구현: `src/pages/index.astro:2-6`, `src/pages/titles.astro:2-8`, `src/pages/title.astro:2-8`, `src/pages/record.astro:2-6`, `src/pages/archive.astro:2-8`, `src/pages/boards.astro:2-8`, `src/pages/data.astro:2-6`, `src/pages/tier.astro:2-6`, `src/pages/library.astro:2-7`. 상단 주요 이동은 `src/components/PrimaryNavigationLinks.jsx:3-24`, 작성/관리 메뉴는 `src/components/TopNavDataMenu.jsx:189-200,343-365`에 있다.

### 실제 핵심 흐름

```text
작품 검색 → 작품 상세 ── 작품만 저장 ── 내 작품
                    ├─ 감상 기록 작성 ── 작품 상세의 감상 탭
                    └─ 공식 표지/로그인 사진 Memory 작성 ── 기억 Archive ── 선택해 보드에 담기

컬렉션 = 내 작품 중 사용자가 선반에 진열한 부분집합
티어 = 작품 순위 도구; 보드 = Memory 묶음
```

작품 저장·감상 기록·Memory 작성은 서로를 자동 생성하지 않는 별개 기록이다(`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:68-78`, `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md:80-91`). `/record/`의 감상/이미지 분기와 Title Hub 연결은 `src/features/titles/components/RecordStart.jsx:50-70`, `src/features/titles/components/TitleHub.jsx:28-70`에 있다. 선반에 포함할 작품 선택은 `src/features/bookshelf/BookshelfView.jsx:60-76`, 전체 작품 집합은 `src/features/titles/components/TitleCollectionView.jsx:37-57,172-172`가 만든다.

## 기록과 동기화의 경계

| 데이터 | 현재 저장/동기화 경로 | 주의 |
| --- | --- | --- |
| 공용 작품 정보·대표 표지 | Supabase catalog 읽기 | 개인이 작품을 저장했다고 Memory가 생기지 않는다. |
| 저장 작품·시청 상태·평점·WatchLog·컬렉션 선반 | 로컬 기록과 계정별 Title State 동기화 | 최초 연결·충돌·삭제는 별도 계약으로 처리한다. 2026-10-07의 추가 SQL은 `supabase/migrations/20261007093000_title_state_sync.sql`. |
| Memory Card·Board·Visual metadata | IndexedDB 기반 Memory runtime과 로그인 계정 metadata 자동 반영 | 기기 저장과 계정 반영 완료를 구분하며 실패·오프라인에는 같은 카드의 대기 작업을 보존한다. |
| 새로 선택해 저장한 개인 사진 | 원본은 기기 보관, 로그인 저장 시 비공개 최적화 사본 전송 | 운영 private-image flag는 켜져 있다. 기존 로컬 사진 일괄 업로드·원본 클라우드 백업·공개 게시를 뜻하지 않는다. |
| 파일 내보내기 | Memory/Board 파일과 기존 작품/감상 파일이 분리되어 있다. | 어느 한 파일도 서비스의 모든 기록·원본 이미지를 뜻하지 않는다. |

근거: `src/features/titles/application/titleStateSync.js`, `src/hooks/useTitleStateSync.js`, `src/hooks/useMemoryAccountSync.js`, `src/features/memory/application/saveNewMemoryToAccount.js`, `src/features/memory/application/autoSavePrivatePhotos.js`, `src/features/memory/runtime/platformPrivateImages.js`. 현재 `.env.production`은 작품 상태/카드 분류 동기화와 비공개 사진 전송을 켜고 Public·미니홈·팔로우·공개 관리 UI는 꺼 둔다. Vercel 환경 값이 이를 덮어쓸 수 있으므로 실제 운영 여부는 배포와 화면에서 재확인한다. 백업 파일 범위는 `src/components/DataCenter.jsx`와 `src/components/data/ManualDataTools.jsx`를 따른다.

## 의도적으로 남은 이전 경로와 현재 한계

- `/title/`가 감상 기록의 작성·같은 ID 수정/삭제와 캐릭터 고정·관계 시리즈를 담당한다. 작품 ID가 있는 옛 링크는 새 상세로 전환한다. `contextTags`는 옛 편집 시트의 직접 설정 항목이 아니며 자동 생성·보존 필드다(`src/components/Library.jsx`, `src/components/library/LibraryQuickLogSheet.jsx`, `src/features/titles/domain/titleNavigation.js`).
- `/`는 옛 `src/components/Home.jsx`가 아니라 컬렉션 선반 `src/features/bookshelf/BookshelfView.jsx`를 사용한다(`src/pages/index.astro:2-6`). 이전 Home 코드의 존재를 운영 홈 기능으로 해석하지 않는다.
- Public 보드/미니홈·관리 경로는 코드에 있어도 현재 운영 기능 플래그가 꺼져 있다. 라우트 존재만으로 공개 서비스가 활성화됐다고 판단하지 않는다(`src/features/memory/runtime/platformPublication.js:7-12`, `.env.production:14-17`).
- ID 없는 옛 목록은 회귀·백업 호환용으로 남고 현재 메뉴에서 직접 연결하지 않는다. 10월9일 새 사진 카드의 저장/감상 수정은 사용자 iPhone 보고와 운영 PC의 동일 카드/수정 감상/사진 표시로 확인했다. 후속 앱 브라우저/Chrome 직접 검사에서 private-only DB의 삭제 RPC 누락을 보완하고 지정된 테스트 카드의 tombstone·fence·사진 retirement를 확인했다. 열린 상세의 삭제 수신 시 카드·미리보기·편집 상태도 비우도록 보완했다. 실제 iPhone 오프라인 복구는 사용자 요청으로 제외했고 iPhone 삭제도 미검증이다. 합성/PC/실기기 결과와 최신 Git 배포를 구분하며 [최신 인계](plans/2026-10-09-private-photo-reliability-and-handoff.md#19-두-화면-직접-검증과-삭제-경계-마감)를 따른다. 이전 흐름의 문제 근거는 [화면 흐름 감사](reports/2026-10-07-live-flow-consolidation-audit.md)에 있다.

## 소스와 운영 배포가 같은지 확인하는 방법

1. [GitHub `master` 최신 커밋](https://github.com/Newrred/anime-collector/commits/master/)의 전체 SHA를 확인한다.
2. [운영 `build-info.json`](https://www.moemoa.xyz/build-info.json)의 `commit`과 `checkoutCommit`이 그 SHA와 같은지, `source`가 `vercel-git`인지 확인한다. `semanticMatch=true`는 배포 빌드 설정이 추적된 소스 설정과 같은 의미인지 보여준다(`scripts/write-build-info.mjs`, `vercel.json:16-25`).
3. [운영 홈](https://www.moemoa.xyz/), [내 작품](https://www.moemoa.xyz/titles/), [기억](https://www.moemoa.xyz/archive/), [기록 진입](https://www.moemoa.xyz/record/)을 연다. 로그인에 따른 개인 기록은 계정/기기 상태에 따라 다르다.

문서만 바뀌어도 `master` push가 새 Vercel Git 배포를 만든다. 따라서 문서에 고정된 과거 SHA 대신 위 동적 확인 링크와 이번 릴리스의 실제 커밋 링크를 함께 사용한다.
