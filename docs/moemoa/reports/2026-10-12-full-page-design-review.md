# MOEMOA 전체 페이지 디자인 검수

현재 가장 큰 개선 대상은 작품의 기억 함께 보기, 미니홈 편집, 기억 작성, 계정 및 데이터 화면이다. 반복되는 조작과 안내가 이미지·현재 작업과 같은 위계로 노출된다. 주요 작업을 먼저 보여주고, 설정·운영 알림·예외 처리는 명확한 보조 위치에서 열게 해야 한다.

2026-10-12 운영 `33de5b4c985e009d14c8ecec6158c4511af946a2`와 관련 코드·제품 문서를 대조했다. **검수와 개선 제안이며 앱 수정·배포 작업은 아니다.**

## 검수 범위

- `.astro` 페이지 진입점 33개: 앱 17, 인증 3, 버전별 고지 8, 이전 경로 3, 약관·개인정보 기본 경로 2. 경로와 연결 컴포넌트를 모두 분류했다.
- 운영 브라우저에서 19개 경로의 실제 상태를 확인했다. PC 1485px, 모바일 390px의 홈·작품·미니홈·데이터·기억 작성도 확인했다. 운영 화면의 주 언어는 영어였고, 가입 화면은 한국어로 시작했다.
- 운영자 화면은 현재 계정의 접근 거부/실패 상태를 확인했다. 전체 관리·신고 처리 화면, 공개 콘텐츠가 있는 방문자 화면, 게시 동의 미리보기는 같은 UI 코드의 기존 합성 검증 화면과 코드로 보완했다. 실계정 역할 변경이나 재게시로 상태를 만들지 않았다.
- 카탈로그 보조 상세는 실패 상태를 확인했으며 정상 자료 상태는 코드 검수로 구분한다. 모든 빈 화면·팝업·조건 분기를 실계정에서 재현한 전수 기능 검사는 아니다.
- 기록 저장, 공개·신고·삭제, 가져오기·내보내기, 동의 제출, 계정·테마·언어 변경은 실행하지 않았다. 임시 모바일 화면 크기는 복원했다.

관찰 수치는 화면 전체에 표시되는 버튼·버튼형 링크·summary 기준이다. 주 메뉴와 닫힌 details 내부는 제외했다. **전체 페이지 230개를 첫 화면의 230개로 해석하면 안 된다.** 개인 기록 문장, 이미지, 계정 이메일, 비공개 보드 이름은 보고서에 옮기지 않았다.

## 먼저 개선할 부분

| 순서 | 화면 | 구체적인 문제 | 개선 방향 |
| --- | --- | --- | --- |
| 1 | 작품의 기억 함께 보기 | 관찰한 작품 56개 상태에서 버튼형 조작 230개, 그중 카드 내부 장르 버튼 169개. 장르를 필터와 카드마다 반복한다. | 카드의 장르는 일반 텍스트로 낮추고 장르 선택은 필터 한곳에 모은다. 반복되는 첫 기억 작성 버튼도 줄인다. |
| 2 | 작품 기억 이미지 배치 | 한 장만 있어도 미리보기는 PC에서 전체 폭의 3분의 1, 높이 220px 규칙을 사용한다. 넓은 행에 작은 이미지와 설명만 남는다. | 이미지 수에 맞춰 폭을 결정한다. 한 장은 충분히 크게, 여러 장은 이미지 묶음으로 보여준다. |
| 3 | 내 공개 미니홈 | 편집 폼 옆에 팔로우·차단·운영 알림이 붙고, 알림마다 이의제기 입력 폼이 기본으로 펼쳐진다. 관찰 상태에는 이의제기 폼 2개가 동시에 보였다. | 편집 / 팔로우 / 알림을 분리한다. 알림은 목록에서 한 건을 열고, 이의제기는 해당 작업을 선택했을 때 입력한다. |
| 4 | 기억 작성 | 이미지 영역은 작품을 먼저 선택하라고 안내하지만 화면 순서는 이미지→작품이다. 390px에서 작품 검색창은 y≈908px, 저장 버튼은 y≈1345px에 있었다. | 공식 표지와 내 사진의 시작 경로를 분명히 한다. 표지 경로의 작품 선택을 그 자리에서 제공하고 01/02/03 및 반복 안내를 정리한다. |
| 5 | 도움말 | 공개 기능을 아직 일반 제공하지 않는다는 고정 설명이 공지와 사용 안내에 반복된다. 현재 허용 범위에서 실제 게시할 수 있는 흐름과 조건을 구분하지 않는다. | 현재 이용 조건을 짧게 안내하고 준비 중 기능은 별도로 표시한다. 자주 하는 작업부터 안내하고 긴 소개·공지·연락 설명은 뒤로 둔다. |
| 6 | 기본 약관·개인정보 경로 | 가입 정책 로딩 완료 후 링크는 10/10 문서인데 `/terms/`, `/privacy/`는 10/9 검토용 초안을 표시한다. | 현재 안내의 진입점과 과거 수락 문서 열람을 구분한다. 기본 진입점을 현행 안내에 연결하고 과거 수락 문서는 보존한다. |

### 작품의 반복 버튼과 이미지 위계

[TitleAlbumCard](D:/hong/Web/Anime/anime-collector/src/features/titles/components/TitleAlbumCard.jsx:29)는 카드마다 최대 네 장르를 `GenresRow`로 표시한다. [GenresRow](D:/hong/Web/Anime/anime-collector/src/components/library/LibraryUi.jsx:84)는 이를 버튼으로 만들고, [TitleCollectionView](D:/hong/Web/Anime/anime-collector/src/features/titles/components/TitleCollectionView.jsx:195)에는 별도의 장르 필터와 상태 필터도 있다. 기억이 없는 카드의 작성 링크도 각 행에 반복된다(`TitleAlbumCard.jsx` 59–62행).

기억 함께 보기의 [실제 적용 CSS](D:/hong/Web/Anime/anime-collector/src/styles/channel-service.css:103)는 단일 열 목록을 강제하고, 미리보기에 `calc((100% - 36px) / 3)`와 높이 220px를 사용한다(103–119행). 관찰한 PC 화면에서 첫 합성 이미지도 작은 미리보기로 표시됐다. 단순한 버튼 외형 변경보다 **반복 조작을 제거하고 이미지 수에 맞는 면적을 배정하는 작업**이 먼저다. 작품 필터와 보기 모드의 의미는 유지하고, 모든 작품을 임의로 숨기지 않는다.

### 미니홈의 편집과 운영 알림 분리

[MemoryMinihome](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryMinihome.jsx:81)은 편집 옆에 관계와 안전 알림을 항상 함께 배치한다. [MemorySafety](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemorySafety.jsx:62)는 알림별 사유·대상 링크·이의제기 textarea와 접수 버튼을 바로 렌더링한다(62–70행).

편집 중인 사용자는 프로필과 전시 항목에 집중할 수 있어야 한다. 알림에는 처리 상태·짧은 요약·읽기 동작을 먼저 보여주고, 해당 알림 안에서 완전한 사유와 이의제기를 열게 한다. 이의제기 접근 경로나 고지 내용을 없애는 제안은 아니다. 공개할 항목이 없을 때는 다음 작업을 명확히 안내하고 큰 빈 편집 폼과 비활성 버튼을 줄인다.

### 기억 작성의 시작 경로 정리

[MemoryCardComposer](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryCardComposer.jsx:141)의 이미지 안내와 176–180행의 이미지 선택은 작품 입력보다 앞에 있다. 사진으로 시작하는 순서는 유지할 수 있지만, 공식 표지를 원하는 사용자에게는 같은 위치에서 작품 선택을 제공해야 한다. 필수 입력 라벨, 파일 제한, 권리 확인, 저장 불가 사유는 남기고 같은 행동을 설명하는 문장은 합친다. 현재 조건별로 닫혀 있는 보관 안내·붙여넣기 도움말은 유지할 만한 구조다.

### 도움말과 문서 진입점의 신뢰

[도움말 렌더링](D:/hong/Web/Anime/anime-collector/src/components/HelpCenter.jsx:93)과 [고정 공개 설명](D:/hong/Web/Anime/anime-collector/src/messages/en.js:483), 503행을 대조했다. 실제 도움말에도 해당 설명 두 건이 표시됐다. 공개 허용 국가·이미지·동의 조건과 비공개 원본 보호를 정확히 구분한 안내가 필요하다.

[terms 기본 경로](D:/hong/Web/Anime/anime-collector/src/pages/terms.astro:2)와 [privacy 기본 경로](D:/hong/Web/Anime/anime-collector/src/pages/privacy.astro:2)는 10/9 draft 컴포넌트를 가져온다. 가입 화면은 초기 로딩 중의 기본 링크와 **정책 로딩 완료 후 링크를 구분해 확인**했으며, 완료 후에는 `/legal/terms-2026-10-10/`, `/legal/privacy-2026-10-10/`이었다. 기본 경로의 초안 제목은 안내 진입점의 문제다. 고정된 과거 수락 문서의 문장을 덮어쓰거나 법적 내용 변경을 제안하지 않는다.

## 다음 개선 묶음

| 우선순위 | 대상 | 문제와 조치 | 코드 근거 |
| --- | --- | --- | --- |
| 2차 | 계정 및 데이터 | 기기 상태·용량·기록 개수·계정 동기화·가입 기록·탈퇴·서로 다른 백업이 연속된다. 모바일 높이는 약 2477px였다. 계정 / 동기화 / 파일 백업 / 개인정보 관리를 구분하고 본 화면에는 상태 요약을 둔다. | [DataCenter](D:/hong/Web/Anime/anime-collector/src/components/DataCenter.jsx:216), 276–289행; [MemoryAccountPanel](D:/hong/Web/Anime/anime-collector/src/components/data/MemoryAccountPanel.jsx:57) |
| 2차 | 백업 설명 | 기억·보드 백업과 저장 작품·기존 기록 백업이 별도이며 제외 항목 설명이 길다. 사용자 목적에 맞는 이름과 포함 범위 비교를 제공한다. 실제 복구 범위가 달라 하나의 완전한 백업인 것처럼 합치면 안 된다. | [DataCenter](D:/hong/Web/Anime/anime-collector/src/components/DataCenter.jsx:289) 이후의 백업 패널; 운영 `/data/` 화면 |
| 2차 | 드문 관리·위험 행동 | 로그아웃·탈퇴·전체 공유 중단·카드 삭제가 다른 일상 행동과 가까이 있다. 개인정보 관리·위험 행동 영역으로 분리하고 영향 설명은 선택한 시점에 제공한다. | [AccountPrivacyPanel](D:/hong/Web/Anime/anime-collector/src/components/data/AccountPrivacyPanel.jsx:64), [MemoryCardDetail 관리 탭](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryCardDetail.jsx:415) |
| 2차 | 목록 상단 설정 | 작품 화면의 정보 / 찾기 / 보기 / 탐색과 상태 필터·열 수·정렬 방향이 콘텐츠보다 먼저 등장한다. 검색·주요 필터는 남기고 열 수와 드문 표시 옵션은 보기 설정으로 모은다. | [TitleCollectionView](D:/hong/Web/Anime/anime-collector/src/features/titles/components/TitleCollectionView.jsx:195) 195–201행 |
| 2차 | 기억 목록의 빈 필터 안내 | 태그·캐릭터가 없을 때 입력을 권하는 문구와 감상 기록 기준 설명을 여러 구역에 반복한다. 빈 옵션은 간단히 표시하고 도움말은 한곳으로 모은다. | [ArchiveView](D:/hong/Web/Anime/anime-collector/src/features/memory/components/ArchiveView.jsx:110), 114–125행 |
| 2차 | 오류·권한 화면 | 잘못된 공개 주소에서도 다시 시도가 주요 행동이다. 현재 계정의 검토 화면은 네 큐 버튼과 새로고침을 표시하면서 포괄적인 실패 안내를 준다. 주소 문제·권한 부족·네트워크 실패를 구분하고 회복 가능한 경우에만 재시도를 강조한다. | [PublicMinihome](D:/hong/Web/Anime/anime-collector/src/features/memory/components/PublicMinihome.jsx:47), [PublicMemoryBoard](D:/hong/Web/Anime/anime-collector/src/features/memory/components/PublicMemoryBoard.jsx:58), [MemoryContentReview](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryContentReview.jsx:1), [AdminDashboard](D:/hong/Web/Anime/anime-collector/src/components/AdminDashboard.jsx:150) |
| 2차 | 작성 중 공통 메뉴 | 기억 작성 화면에서도 상단의 분홍 기억 남기기가 유지되어 본문의 저장 작업과 경쟁한다. 작성·편집 중에는 현재 작업을 중심으로 메뉴 위계를 조정한다. 이동 시 미저장 보호는 유지한다. | [TopNavDataMenu](D:/hong/Web/Anime/anime-collector/src/components/TopNavDataMenu.jsx:197), [작성 저장 버튼](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryCardComposer.jsx:295) |
| 3차 | 보드 공개 미리보기 | 선택 카드마다 공개 항목·이미지 준비·제외 조작이 이어질 수 있다. 카드 썸네일과 선택 상태를 먼저 보여주고 개별 항목 설정은 카드 단위로 연다. 공개 범위와 동의 확인은 생략하지 않는다. 기본 공유 설정이 닫혀 있는 구조는 유지한다. | [MemoryPublicationPanel](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryPublicationPanel.jsx:128), 149–155·174–177행. 조건부 상태는 코드·기존 합성 화면 근거 |
| 3차 | 운영자 신고 목록 | 긴 전체 식별자와 `RECEIVED` 등 원시 상태가 목록의 주요 문구다. 유형·시각·읽기 쉬운 상태·내용 요약을 앞에 두고 전체 식별자와 감사 이력은 상세에 남긴다. 조치 사유·확인 절차는 유지한다. | [MemoryReportReview](D:/hong/Web/Anime/anime-collector/src/features/memory/components/MemoryReportReview.jsx:59), 64–80행. 처리 화면은 코드·합성 화면 근거 |
| 3차 | 가입 언어 | 앱은 영어인 관찰 상태에서도 가입은 한국어로 시작한다. 지원 언어 선택을 진입 전후에 이어주되 국가·생년월일·동의 절차와 문서 버전은 유지한다. | [SimpleSignup](D:/hong/Web/Anime/anime-collector/src/components/auth/SimpleSignup.jsx:29), [auth 시작 문서](D:/hong/Web/Anime/anime-collector/src/pages/auth/start.astro:8) |
| 3차 | 티어의 드문 조작 | 초기화와 맞춤 주제 추가의 위계를 실제 정렬 작업보다 낮춘다. 티어 화면 전체가 버튼 과밀한 상태라고 보지는 않는다. | [TierBoard](D:/hong/Web/Anime/anime-collector/src/components/TierBoard.jsx:812), 847행 |

## 유지할 만한 부분과 경로별 판정

| 경로 묶음 | 확인과 판정 |
| --- | --- |
| `/` | 기본 컬렉션은 조작이 비교적 적고 이미지 중심이다. 편집은 별도로 열 수 있다. 전면 재설계보다 상단 정보와 표시 설정의 위계를 정리한다. |
| `/titles/`, `/title/` | 작품의 두 보기는 유지한다. 기본 작품 상세는 비교적 차분하다. 기억 함께 보기의 반복 버튼·이미지 크기를 먼저 개선한다. 상세 편집·이력의 모든 분기를 실계정에서 바꾸지는 않았다. |
| `/archive/`, `/memory/card/` | 목록과 기억 상세의 기본 보기 / 관리 탭 분리는 좋은 기반이다. 빈 필터 안내와 관리 탭의 조작 위계를 개선한다. 합성 테스트 카드로 관리 탭을 확인했다. |
| `/record/`, `/memory/new/` | 감상과 장면 저장의 목적 구분을 유지한다. 사진·공식 표지 시작 경로와 본문 안내를 정리한다. |
| `/boards/`, `/minihome/` | 기본 보드 목록·상세에서 편집·공유를 별도로 여는 구조는 유지한다. 미니홈에서는 편집과 관계·안전 알림을 분리한다. |
| `/public/board/`, `/public/home/` | 콘텐츠와 관리 영역 분리는 유지한다. 무효 주소 상태의 행동을 개선한다. 콘텐츠가 있는 화면은 같은 코드의 합성 검증 화면을 참고했다. |
| `/data/`, `/help/` | 정보와 작업의 분리를 가장 많이 정리해야 하는 보조 화면이다. 고지의 정확성과 백업 범위 차이를 보존한다. |
| `/tier/` | 시각적 정렬 기능은 유지하고 초기화·맞춤 설정을 보조 동작으로 낮춘다. |
| `/admin/`, `/moderation/` | 실제 접근 거부/실패 상태를 확인했다. 운영 전체 화면은 기존 동일 코드의 합성 화면과 코드로 검수했다. 운영자 필수 정보·확인은 무작정 줄이지 않는다. |
| `/profile/`, `/u/`, `/library/` | 이전 경로의 대체 안내·작품 경로 연결을 코드에서 확인했다. `/profile/`는 계정 및 데이터로 가는 짧은 안내였다. 이전 소셜 편집 화면을 현재 활성 화면으로 평가하지 않았다. |
| `/catalog/detail/` | 보조 상세의 실패 화면을 확인했다. 정상 데이터 화면의 모든 내용은 실제 화면 확인으로 주장하지 않는다. |
| `/auth/start/`, `/auth/complete/`, `/auth/callback/` | 시작 화면을 운영에서 관찰하고 완료·전달 단계는 코드와 기존 합성 화면으로 보완했다. 가입 시작의 조작 수는 비교적 적다. 인증을 반복하거나 개인정보를 입력하지 않았다. |
| `/terms/`, `/privacy/`, `/legal/` 8개 | 기본 경로 2개와 버전별 문서 8개의 연결·본문 구조를 검수했다. 법률 문서 자체의 긴 본문은 일반 화면의 설명 과밀과 구분한다. 수락했던 과거 버전과 동의 기록은 그대로 보존한다. |

## 공통 디자인 기준과 개선 순서

현재 작업의 주요 행동을 가장 먼저 인식할 수 있어야 한다. 검색·보기 탭은 조용한 도구 영역으로, 드문 설정은 분명히 이름 붙인 보조 영역으로, 삭제·공개 철회는 영향이 드러나는 관리 영역으로 나눈다. 설명은 작업에 필요한 한 문장을 먼저 보여주고 세부 이유와 범위는 가까운 도움말에서 읽게 한다. 필수 동의·위험 설명·접근 가능한 신고와 이의제기를 숨기는 방식으로 조작 수를 줄이지 않는다.

1. 작품 기억 보기의 반복 버튼과 미리보기 폭, 미니홈 편집/알림 분리, 기억 작성의 시작 경로를 먼저 정리한다.
2. 도움말과 기본 문서 진입점의 현행 상태를 맞춘다. 고정 수락 문서는 수정하지 않는다.
3. 데이터 화면의 계정·동기화·백업·개인정보 구조와 상태별 버튼을 정리한다.
4. 공통 메뉴·빈 필터·공개 링크 실패·운영자 목록·가입 언어·티어 보조 조작을 정돈한다.

이 방향은 자주 쓰는 선택을 앞에 두고 드문 선택을 요청했을 때 보여주는 [NN/g의 progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)와 부합한다. [Are.na의 채널](https://help.are.na/docs/getting-started/channels)은 콘텐츠를 모으는 기본 구조의 참고이며, 여기의 우선순위와 수치가 Are.na의 공식 지침인 것은 아니다.

검수 근거는 제품 범위·확정 결정·기존 인터페이스 계획과 관련 페이지/컴포넌트, 운영 화면이다. 경로 목록과 개인 내용 없는 구조 관찰은 `.cache/ui-design-audit-20261012/route-inventory.json`, `screen-observations.json`에 보관한다. 모바일 브라우저 크기 검수와 물리 기기/Safari 사용자 테스트는 구분한다. 이 보고서에서는 코드 변경·DB migration·운영 배포를 실행하지 않았고 새 기능 QA 통과를 주장하지 않는다.
