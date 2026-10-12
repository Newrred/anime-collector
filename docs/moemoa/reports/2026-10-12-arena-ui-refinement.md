# 전체 디자인 검수 후 개선 결과

현재 운영 `33de5b4c985e009d14c8ecec6158c4511af946a2`에서 출발한 `codex/arena-ui-refinement-20261012`의 화면 개선이다. 실제 운영/master와 기준 checkout이 같은 버전임을 `build-info.json`과 Git으로 재확인했다. 운영 반영은 이번 요청에 포함되지 않았다.

## 읽은 근거와 디자인 기준

`AGENTS.md`, `CODEX_START_HERE.md`, `PLANS.md`, 확정 결정, 제품 흐름, 변경 관리 문서, [전체 검수](2026-10-12-full-page-design-review.md), [ExecPlan](../plans/2026-10-12-arena-ui-refinement.md)과 변경 대상의 실제 render/controller/검사를 대조했다.

[Are.na AD_Direzione](https://www.are.na/chase-body/ad_direzione)를 브라우저에서 다시 열어 로딩 후 실제 채널을 확인했다. 작은 Connect/More 도구, 얇은 정보 구분선, 텍스트 메타데이터, 이미지 비율과 여백을 참고했다. [블록 상세](https://www.are.na/block/50278090)의 이미지/보조 정보 분리와 [공식 블록 안내](https://help.are.na/docs/getting-started/blocks)도 근거로 삼았다. 레퍼런스 작품·로고·이미지를 앱 자산으로 가져오지 않았다. MOEMOA의 분홍 주요 행동, 로컬 사용과 이미지·권리 정책은 유지한다.

## 검수 17항목 처리

| 항목 | 적용 결과와 코드 근거 | 확인 |
| --- | --- | --- |
| 1. 작품별 반복 장르/첫 기억 버튼 | `TitleAlbumCard.jsx:20–35,59–65`: 장르를 일반 정보로, 첫 기억을 작은 링크로 표시. 필터는 상단에 모음 | 작품 집합·검색·중앙 필터 검사, 카드 내부 버튼0 |
| 2. 기억 미리보기 크기 | `arena-refinement.css:2–11,54–62`: 1/2/3개에 맞춘 공간, 이미지 비율 유지, 메타데이터를 한 묶음으로 정돈 | 단일/3개 폭, 1440/390/320 넘침 검사 |
| 3. 미니홈/운영 알림 과밀 | `MemoryMinihome.jsx:82–89`, `MemorySafety.jsx:59–101`, `TaskSections.jsx:5–34`: 편집/팔로우/알림, 상세와 이의 작성 단계 분리 | 입력 유지·deep link·기존 이의 접수/권한 검사 |
| 4. 작성 순서와 장문 안내 | `MemoryCardComposer.jsx:129–144,158–199,250–293`, `MemoryTitleSelector.jsx:31–52`: 사진 미선택 시 작품 검색 먼저, 사진 선택 시 이미지부터 표시. 번호/중복 안내 축소 | 공식 표지, 사진, 권리 확인, 검색, 실제 저장, 실패 복구 검사 |
| 5. 도움말의 오래된 공개 안내 | `HelpCenter.jsx:16–19,94–131`, `messages/ko.js`·`en.js:480–506`: 작업별 펼침 안내와 현재 공개 기능 상태 | 공개 사용 가능/중지 안내, 긴 내용 기본 접힘 |
| 6. 기본 약관/개인정보 진입점 | `terms.astro:2`, `privacy.astro:2`: 현행10/10 문서 연결 | 과거10/9 문서와 수락 링크 보존, 현행 진입점 검사 |
| 7. 계정/기기/백업/개인정보 혼합 | `DataCenter.jsx:219–302`: 네 작업 분리. 계정과 동기화는 함께 표시 | 키보드 전환, 모바일, 계정·권한·삭제 회귀 |
| 8. 백업 범위 설명 | `MemoryBackupTools.jsx:27–30`, `ManualDataTools.jsx:242–247`: 포함/별도 보관을 나눔 | 기존 내보내기/복원 계약 단위 검사. 파일 형식 변경0 |
| 9. 드문 위험 행동의 위계 | `MemoryAccountPanel.jsx:97–102`, `MemoryMinihome.jsx:51`, `MemoryPublicationPanel.jsx:102–105,124–130`, `MemoryPublicCardControl.jsx:35–39`: 명시적인 관리 위치로 이동 | 철회·원본 유지·가입 복구·실패·계정 삭제 회귀. 카드 삭제는 기존 관리 탭/확인창 유지 |
| 10. 항상 노출된 보기 설정 | `TitleCollectionView.jsx:193–199`: 장르 필터/보기 설정을 분리하고 열 수·정렬 방향 접기 | 보기별 같은 작품, 열 수 저장/복원 |
| 11. Archive의 빈 필터 설명 반복 | `ArchiveView.jsx`의 태그/캐릭터 ChannelSection: 빈 상태는 짧게, 기록 기반 설명은 실제 항목이 있을 때 표시 | 필터 및 Archive 흐름 검사 |
| 12. 상태와 맞지 않는 재시도 | `PublicMemoryBoard.jsx`·`PublicMinihome.jsx` 반환 영역, `AdminDashboard.jsx:46`, `MemoryContentReview.jsx:92–97`: 무효 링크의 돌아가기/연결 오류의 재시도/권한 안내 구분 | 무효ID 호출0, 일시 오류 복구, 운영 권한 거부 검사 |
| 13. 작성 중 공통 CTA 경쟁 | `TopNavDataMenu.jsx:197–203`: record-new/memory-new/memory-card에서 상단 추가 행동 정리 | 작성 화면 상단 CTA0, 기존 경로·미저장·저장 검사 |
| 14. 보드 공개 카드 설정 과밀 | `MemoryPublicationPanel.jsx:137–144`: 선택한 카드의 공개 항목을 펼쳐 조절 | 필드 선택/정확 snapshot/미리보기/필수 정책과 이미지 권리 검사 |
| 15. 운영 신고 목록의 내부 코드 | `MemoryReportReview.jsx:22–24,61–77`: 대상/종류/사람이 읽을 상태/짧은 번호, 전체 식별자는 상세 | 정확 revision·대상·조치·사유·확인, 원문 추적/개인정보 미노출 |
| 16. 가입 언어 단절 | `SimpleSignup.jsx:30`: 공통 언어 설정 사용 | 언어 연속성/변경 저장, 국가·나이·약관·Google 흐름 검사 |
| 17. 티어 초기화 강조 | `TierBoard.jsx:812–823,838–856`: 주제 관리와 새 주제 구성은 펼쳐 사용 | 기본 티어 동작·초기화 확인은 유지, 두 폭의 실제 화면 비교 |

코드 경로는 저장소 `src/` 아래의 해당 컴포넌트·스타일 파일이다. 세부 행은 최종 변경 시 소폭 이동할 수 있으며 동작 검사는 아래 실제 실행 기록을 기준으로 한다.

## 검증과 비교

- 핵심 단위 검사619 통과. 카탈로그256 통과/기존2 skip/실패0.
- 최종 빌드33페이지 통과. `git diff --check` 통과. 기준/개선 `astro check` 모두370오류로 기존 오류 수 증가 없음.
- 작품/작성/저장/계정 메뉴/개선 흐름43 통과. 작품 필터·정렬 별도13 통과. 공개·팔로우·신고·운영54개 중53개 초기 통과, 바뀐 권한 안내 기대값을 수정한1개 재검사 통과. 원격 전체 검사는 후보 commit에 연결해 실행한다.
- 가입/개인정보/운영43개 중41개 초기 통과. 언어 전환 후 hydration 대기와 새 문서의 실제 버전 표기를 반영한2개 재검사 통과. 기존 약관의 `data/#account-privacy` 링크를 새 개인정보 메뉴로 연결했고 개인정보7개를 재확인했다.
- React Doctor 전체 기준37/100, 개선 후37/100으로 하락 없음. 변경 파일 검사74/100·진단0. 기존302개 전체 진단을 해소했다고 주장하지 않는다.
- `astro check` 기준 checkout 자체에370개 오류가 있으며 필수 품질 검사는 빌드와 프로젝트의 기존 CI이다. 이 별도 검사의 실패를 빌드 성공으로 표현하지 않는다.
- 현재/개선의 **실제 앱**을 같은 합성 입력·언어·폭·테마로 촬영했다. 18개 장면, PC1440/모바일390, 주요3장면의 dark 비교를 제공한다. 실제 사용자 사진·기록·계정·키는 포함하지 않는다. 현재 데이터 화면은 한 페이지에 모든 항목이 있으므로 개선의 여러 메뉴와 같은 기준 화면을 비교한다.
- 로컬 비교: `D:/hong/Web/Anime/design-comparison-20261012/index.html`. `manifest.json`에 후보 소스/fixture/이미지 결속과 최종 실행 결과를 기록한다. ZIP은 이 비교 파일들만 포함한다. 비교 자료와 화면 원본은 버전 관리에 넣지 않는다.

## 범위, 되돌리기와 남은 단계

새 의존성, DB·schema·API·RLS·권한·국가·공개 환경 설정 변경0. 기존 고정 legal 문서 본문 변경0. 실계정 자료 쓰기·게시·신고·가입 동의·삭제0. 테스트는 격리된 로컬 합성 자료로 실행한다. analytics 추가0. 개인정보·권리·정책 동의와 공개 이미지 사전 준비는 필수 단계로 유지한다.

되돌리기는 개선 presentation commit을 revert하는 방식이며 데이터 복원 작업은 없다. 기준 checkout을 별도 보존했다. 운영 반영 시에는 검증된 정확 후보의 승인이 필요하다. 예약 작업·복구·공개 기능 출시 상태를 이번 디자인 작업의 결과로 확대하지 않는다. 최신 현행 문서 버전이 바뀌면 기본 약관 진입점도 해당 배포에서 다시 검토해야 한다.

### 2026-10-12 운영·인계 후속

사용자가 운영 반영·다른 PC Git 인계를 승인했다. 정확한 앱 후보 cafcd2a의 전체 CI38223832158 SUCCESS, force 없는 master push, Vercel Production FL7SBpiDdBVRhWmkdi24y6DvQego READY, 실제 www의 commit/checkoutCommit/source/config 의미 일치 확인. 운영8경로 HTTP200과 브라우저의 도움말/데이터 작업 메뉴를 읽기 검수했다. 공개·전체 채널의 최종 로컬 결과는 각각54 PASS,88 PASS/기존5skip이다. 앱/DB/API/환경/권한/의존성·개인 자료 변경0인 문서 인계 후속을 준비했다. 최신 기준과 portable 재개·롤백은 [다른 PC 안내](../operations/2026-10-12-arena-refinement-handoff.md), [운영 근거](../release-v2/evidence/2026-10-12-arena-refinement-production.json)를 따른다. 최종 문서 후속 SHA는 live Git/build-info 조회로 확인한다.
