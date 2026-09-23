# Pro 리뷰 후속 개선 — 2026-09-22

## 결과

이번 작업은 두 리뷰의 핵심 정합성·재기록·재열람 개선을 로컬 구현한 첫 묶음이다. 리뷰의 W00~W10 전체 완료나 출시 승인이 아니다. Git commit/push, 운영 배포, DB migration은 수행하지 않았다.

## 읽은 기준과 현재 상태

- AGENTS, CODEX_START_HERE, 확정 결정 01, 제품 흐름 02, 9월 3일 Title Hub UI spec, PLANS.
- 사용자 첨부 9월 11일 Pro 리뷰와 홈 재발견 보완서. 원문은 `../references/2026-09-11-pro-review/`에 보존했다. 원문 제안은 확정 결정과 구분한다.
- HEAD `3fb09a7` 및 기존 미커밋 작업을 그대로 유지했다. 이번 변경 전 `src/`, `tests/` 사본을 상위 workspace `.moemoa-improvements-2026-09-22/baseline/`에 보존했다.
- 계획: `../plans/2026-09-22-pro-review-improvements.md`.

## 구현한 내용과 코드

| 영역 | 변경과 근거 | 주요 파일 |
|---|---|---|
| W01 표지 카드 | 마지막 개인 신호 삭제를 application과 IndexedDB write에서 차단. domain complete validation도 같은 개인 신호 함수를 사용. 원본 감상 유지 | `src/features/memory/domain/memoryDomain.js`, `application/updateMemoryCard.js`, `adapters/indexeddb/IndexedDbMemoryRepository.js` |
| W01 미평가 | null/undefined/빈 문자열과 실제 0점 구분. 원본 값 강제 변경 없음 | `src/features/titles/application/titleAlbumProjection.js` |
| W02 개인 작품 | Hub/앨범→기존 privateTitleId→Composer→두 번째 카드. owner·삭제 상태 확인. 기존 제목 재삽입/이름 덮어쓰기와 불필요한 title sync 방지. 동명 자동 병합 없음 | `createMemoryCard.js`, `reconcileMemoryOperations.js`, `useMemoryCardComposer.js`, `memoryCardNavigation.js`, `TitleHub.jsx` |
| W03 자체 카탈로그 | AniList ID 없는 저장 작품도 Hub에서 로컬 시청 상태·평점 저장/재조회. 기존 AniList 편집 경로 유지 | `titleHubService.js`, `TitleHub.jsx` |
| W04a 보관 범위 | Memory/Board 수를 별도로 표시. 기존 서재 백업이 새 모델·이미지·catalog-only 작품을 포함하지 않음을 명시 | `DataCenter.jsx`, `ManualDataTools.jsx` |
| W04b 새 백업 | Memory·PrivateTitle·Visual metadata/design/catalog ref·Board·membership JSON. catalog-only 저장 상태는 별도 JSON. 미리보기/취소/확인 후 복원 | `memoryBackup.js`, `memoryBackupStore.js`, `MemoryBackupTools.jsx`, `catalogTitleBackup.js` |
| W05 오류 | Title Hub 조회 실패와 없음 분리. 카탈로그가 실패해도 이미 있는 로컬 작품은 열림. Memory 상세 읽기 실패 문구 분리. 감상 필드 라벨과 글자 수 연결 분리 | `TitleHub.jsx`, `titleHubService.js`, `MemoryCardDetail.jsx`, `MemoryCardComposer.jsx` |
| W06 재열람 | 1/2/3개 Memory 미리보기 열 수와 개별 상세 링크. 표지 없는 타일은 실제 작품명. Board는 이미지 Gallery, 기존 편집·정렬·제거 유지. 상세에서 보드에 담기 | `TitleAlbumCard.jsx`, `TitleCover.jsx`, `MemoryBoardView.jsx`, `AddMemoryToBoard.jsx` |
| 홈 보완 | 최근 3개, 30일 이상 과거 카드 1개, 같은 작품의 다른 기록일 카드 2개 또는 한 줄 기억. 영역 간 카드 중복 없음. 하루 동안 후보 안정. 생성일을 기록일로 표시 | `homeRediscovery.js`, `useHomeMemoryArchive.js`, `HomeRediscovery.jsx`, `HomeMemoryOverview.jsx` |
| W08 탐색 | Archive 작품/감상 검색, 작성순·수정순, 무결과 초기화. 검색/정렬 URL 유지 및 새로고침 확인 | `archiveSearch.js`, `ArchiveView.jsx` |

홈은 먼저 metadata 후보를 고른 뒤 해당 소수 이미지만 읽는다. 사용자 이미지가 없으면 missing 상태를 유지하며 다른 표지로 대체하지 않는다. 옛 Library/WatchLog만 있는 사용자의 회고 경로도 유지하고 상세 펼침으로 표시했다. 새 Memory를 legacy 데이터로 자동 변환하지 않았다.

## 백업의 정확한 범위와 복구

- Memory 백업은 개인 이미지 **파일을 포함하지 않는다**. 내보낼 때 localRef를 제거한다. 시스템 디자인·공식 표지 참조는 다시 표시할 수 있고, 개인 파일이 필요한 카드는 이미지 없음으로 남는다.
- 복원은 **기억·보드가 없는 비회원 로컬 보관함**에서만 지원한다. owner와 내부 ID를 새 로컬 보관함으로 매핑하고 sync 상태는 LOCAL_ONLY로 초기화한다. 계정 sync/outbox를 우회하는 복원은 차단한다.
- Memory의 여섯 저장소 변경은 한 IndexedDB transaction이다. 입력 검증 또는 중간 저장 실패 시 전체 취소된다. 기존 데이터 덮어쓰기·병합·삭제 기능은 추가하지 않았다. 두 번째 복원도 거부하여 중복을 막는다.
- catalog-only 제목/시청 상태는 기존 legacy DB의 단일 meta transaction에 별도로 복원한다. 이 종류의 기존 저장 작품이 있으면 복원을 거부한다.
- 기존 서재·Tier·WatchLog 백업 형식은 그대로다. 따라서 세 파일 범위가 서로 다르며, 전체 데이터가 한 파일에 들어간다고 표시하지 않는다. 개인 파일 아카이브·계정 복원·다중 저장소를 한 번에 교체하는 기능은 미완료다.

## 검증 결과

- `npm run test:unit`: **236/236 PASS**. 새 신호/미평가/개인 ID 재사용/owner/재발견 회귀 포함.
- 관련 Chromium 통합 46개 실행: 최초 **45 PASS, 1 FAIL**. 마지막 실패는 카탈로그 오류 때 기존 로컬 작품 열기가 막힌 회귀였다. 로컬 fallback을 복구한 후 해당 suite **2/2 PASS**. 나머지 44개 성공은 최초 통합 실행 기록이며 전체 46개를 수정 후 재실행했다는 뜻은 아니다.
- 이전 단계의 카드 작성 + 새 회귀 **21/21 PASS**, 제목/보드/기억 횡단 통합 **21/21 PASS**도 별도 기록.
- 새 브라우저 복원: 같은 작품 2개 Memory, 보드 1개/연결 2개, 원문 감상과 관계 유지. 손상 reference 거부, 두 번째 insert에서 저장 실패 주입→전체 취소→정상 재시도. 기존 보관함 덮어쓰기 거부.
- 표지 마지막 note 삭제: runtime command와 직접 IndexedDB write 모두 거부, 기존 note 유지.
- catalog-only: 상태·0점·미평가 재조회 및 새 브라우저 백업 복원, 기존 저장 작품 덮어쓰기 거부.
- `npm run build`: **PASS**, 15 routes.
- React Doctor `npx react-doctor@latest --verbose --diff`: **49→49**, 기존 dependency 공급망 경고 1개·기존 복잡도 경고 6개 유지. 이번 추가 경고는 추출/병렬 조회 정리로 제거했다. 이 점수를 품질 합격으로 해석하지 않는다. dependency는 바꾸지 않았다.
- 격리 샘플 화면 10장(390/1440): JS page error 0, 가로 overflow 0. 모바일 홈·보드·Memory View·데이터 화면을 열어 확인했고 작은 썸네일의 글자 잘림을 수정했다. 기존 Title Hub/갤러리 320px 회귀도 통과했다.

## 결과 파일

상위 workspace `.moemoa-improvements-2026-09-22/`에 raw logs, `changed-files.json`, `visual-check.json`, `screens/`를 보관했다. 이 폴더의 baseline은 이번 작업 이전 소스이며 실제 개인 브라우저 데이터 복사본이 아니다.

## 남은 작업과 결정

- W05 전체: dirty 이탈 확인, 읽기 오류의 세부 종류, 모든 생성/수정의 중복 실행 방어까지 전수 완료한 것은 아니다.
- W07: Web 작품 우선 작성 순서와 Memory 상세 읽기/편집 모드 재편은 후속 제품 흐름 변경으로 남겼다. 이번에는 기존 작성 순서와 상세 편집 구조를 유지했다.
- W08: Archive 다중 선택/보드 담기, 날짜 필터, scroll 복귀·모든 history 분기, 보드 제안 빈도 조절은 남아 있다.
- Home: 충분한 기간의 월·연 회고, 다른 기억 보기, 고급 분석·사용성 실험은 후속. 이번 후보는 기록 생성일 기준이며 시청일/열람 이력/감정 변화를 추정하지 않는다.
- W09: OAuth·계정 전환·실제 다기기·Android 실기기·Public gate는 별도. 이번 mock/native URL/로컬 브라우저 성공으로 출시 완료를 선언하지 않는다.
- W10 및 카탈로그 보류 자료는 이번에 변경하지 않았다.

## 데이터·보안·롤백

새 production dependency, schema migration, 운영 계정/DB mutation, 이미지 업로드, public 활성화, analytics 원문 추가 없음. 실험 기록은 테스트 전용 브라우저에서 생성했다. 이번 변경을 되돌릴 때는 baseline과 `changed-files.json`으로 해당 파일만 비교/복구하며 기존 미커밋 개발분을 `git reset`으로 삭제하지 않는다. 운영 배포 시에는 사용자 지시대로 Git commit/push→Vercel Git 연동→운영 SHA 확인 절차를 따른다.
