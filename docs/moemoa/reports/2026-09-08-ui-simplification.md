# 화면 복잡도 정리 — 2026-09-08

## 결과
기존 갤러리를 유지하면서 기본 화면의 중복 조작과 반복 안내를 줄였다. 로컬 구현 후 사용자 추가 승인으로 운영 배포까지 완료했다.

- `src/components/library/LibraryFiltersPanel.jsx`, `src/features/titles/components/TitleCollectionView.jsx`: Titles의 동일 상태 select/chip 중복을 제거하고 고급 필터 기본 접기. 기존 Library 호출의 기본 동작은 유지. 장르 검색·태그·열 크기·정렬·뷰 전환 유지.
- `src/features/memory/components/MemoryCardComposer.jsx`, `memory-card-composer.css`: 큰 소개와 중복 진행 표시 제거, 개인정보/저장 안내는 펼쳐 읽기, 실제 이미지 ticket이 있을 때 권리 확인 표시. 저장 조건 유지. 제목·패널 크기와 강조 축소.
- `src/features/memory/components/MemoryBoardView.jsx`, `memory-board.css`: 새 보드와 카드 추가 도구 접기. 기본 상세는 읽기 상태이고 편집 버튼으로 정보/삭제/재정렬/제거 노출. 입력 스타일 통일.
- `src/features/memory/components/ArchiveView.jsx`, `src/features/titles/components/TitleHub.jsx`, `src/components/home/HomeMemoryOverview.jsx`: 반복 소개·설명 및 홈 최근 기억 영역의 중복 작성 버튼 제거. 공통 작성 진입점 유지.
- `src/messages/ko.js`, `en.js`: 보드 편집/닫기 라벨 추가.
- `tests/title-collection.spec.ts`, `memory-board.spec.ts`, `memory-card-composer.spec.ts`: 기본 접힘과 실제 열기 동작, 단일 상태 필터, 변경된 설명 노출에 맞게 검증. 기존 데이터 재사용·삭제 독립성·권리 동의 검증 유지.

## 읽은 기준과 가정
AGENTS.md, CODEX_START_HERE.md, 확정 결정 01, 제품 흐름 02, Title Hub UI spec, PLANS.md, 변경 통제 09 및 관련 실제 컴포넌트·메시지·테스트. 이전 운영 화면 분석을 근거로 사용자가 승인한 정리 범위만 적용. 도메인/제품 결정 변경 없음. ExecPlan: `../plans/2026-09-08-ui-simplification.md`.

## 검증
- Node 24: `scripts/run-e2e.mjs tests/title-collection.spec.ts tests/memory-board.spec.ts tests/memory-card-composer.spec.ts tests/title-cross-surface.spec.ts --project=chromium --workers=1 --reporter=line`: 30/30 통과. MOEMOA_VISUAL_TEST=1, loopback port 4392 사용.
- `node_modules/astro/astro.js build`: 15페이지 성공. 기존 큰 chunk 경고 유지.
- `npx react-doctor@latest --verbose --diff`: 71/100, 복잡도 경고 6개로 기존 수준 유지. 이 변경에서 복잡도 재구조화는 범위에 포함하지 않음.
- `git diff --check`: 통과.
- 작성/보드 데스크톱 로컬 화면 육안 확인, Titles/Board 320px 키보드·가로 넘침 관련 브라우저 테스트 통과.

## 데이터·보안·복구 및 남은 범위
DB/사용자 데이터/동기화/공개 정책/분석 이벤트 변경 없음. 이미지 권리 동의와 표지 기반 기억의 개인 신호 필수 조건 유지. UI 변경만 되돌리면 복구 가능하다. Android 실기기 검증·APK 생성은 하지 않았다. 기존 다른 작업의 변경 파일을 보존했으며 commit/push하지 않았다.

## 후속 운영 배포

- 사용자 `배포 ㄱ` 승인으로 production 설정의 격리 후보를 빌드, 검증 후 promote했다.
- 운영: https://www.moemoa.xyz / Deployment `dpl_9XFykvvfB6weyT64JByvKg11BJ3r`, Ready. 운영 도메인 inspect로 동일 deployment 확인.
- 후보: https://anime-collector-1zq16c5ec-newrreds-projects.vercel.app
- Snapshot: `D:/hong/Web/Anime/.moemoa-release-2026-09-08-ui-cleanup`. 입력 270개가 현재 소스와 일치하고 이전 배포 대비 변경 입력은 이번 UI 관련 11개 파일뿐이다.
- Node 24 production build 15페이지 성공. 개발 테스트 어댑터 및 비공개 환경값 출력 검사 통과.
- 출력 manifest SHA256: `77c7705bd5a16aca17e9f842d3fc9459e33bc716f39a3af6b5ec830bfeac997e`.
- 후보/운영 각각 16개 smoke 검사 통과. 작성 안내 접기, 보드 생성·추가·편집 후 닫기, 모바일 320px, 실제 카탈로그 표지·장르 검색·열 크기 유지, Memory 저장·화면 간 연결, 계정 표시 검사 포함. page error 0, account write 0. 격리 브라우저의 로컬 데이터로 검증했다.
- 운영 파일 78개: 63개 byte hash 일치, 15개 HTML은 Astro UID와 기존 Vercel analytics 삽입 필드 정규화 후 일치. 실패 0개.
- 후보 작성 모바일 및 운영 보드 캡처 육안 확인. 증거는 snapshot의 `production-smoke.json`, `production-gallery-smoke.json`, `live-artifact-verification.json`, `production-board.png` 등.
- 이전 운영은 `dpl_7CswVCMgTNWLU8vzh7A3ULPCeGxm`. 필요 시 아래 명령으로 복구한다. DB 복구는 필요하지 않다.

```powershell
npx --yes vercel@59.11.7 rollback https://anime-collector-pniu0nwge-newrreds-projects.vercel.app --yes --scope newrreds-projects
```
