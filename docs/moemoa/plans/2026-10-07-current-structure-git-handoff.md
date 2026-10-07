# 현재 구조 문서화와 Git 배포 인계 ExecPlan

## 1. 목적과 사용자 결과

2026-10-07의 실제 `master` 소스, 사용자 화면 흐름, 운영 상태를 하나의 읽기 쉬운 문서로 정리한다. 공개 Git 저장소와 운영 Web이 같은 Git 커밋을 가리키는지 검증한 후 두 링크를 사용자에게 제공한다.

## 2. 관련 확정 결정

- `AGENTS.md:31-42`: 운영 배포는 `master` Git push와 Vercel Git 배포의 동일 SHA 확인으로 마감한다. 사용자가 이번 요청에서 소스 업데이트와 운영 일치를 명시했다.
- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:704-719`: 감상 기록과 Memory는 별도이며, 취소된 컬렉션 재배치는 되살리지 않는다.
- 이 문서는 기존 제품 결정을 변경하지 않는다.

## 3. 현재 상태와 저장소 증거

- 작업 시작 시 `master`와 `origin/master`는 `31fd31eea91760b6737b5b2e9fc9d25318c1ddd0`로 같았다.
- 운영 `/build-info.json`도 같은 SHA, `source=vercel-git`, `semanticMatch=true`였다.
- 미반영 파일은 이전 턴의 `docs/moemoa/reports/2026-10-07-live-flow-consolidation-audit.md` 한 개였다.
- GitHub 저장소 `Newrred/anime-collector`는 PUBLIC이며 기본 브랜치는 `master`다.

## 4. 범위

### 포함

- 현재 운영 화면·경로와 레거시 연결의 재현 가능한 구조 문서
- 기존 흐름 감사에서 개인 계정 관찰 수치 제거
- `CODEX_START_HERE.md`에서 최신 구조 문서로 연결
- 문서 검증, `master` 커밋·push, Git 배포 SHA·사이트 열람 확인

### 제외

- 사용자 기록/DB/이미지 변경, 기능/UI 수정, Public 플래그 활성화, Android 배포
- 레거시 화면 삭제 또는 제품 결정 변경

## 5. 아키텍처·데이터 흐름

문서의 사실 출처는 `src/pages`, `src/components/PrimaryNavigationLinks.jsx`, `src/components/TopNavDataMenu.jsx`, `src/features/bookshelf`, `src/features/titles`, `src/features/memory`, `src/repositories`, `src/lib/supabaseClient.js`, `.env.production`, `vercel.json`이다. 제품 목표와 구현 상태를 구별한다.

## 6. 변경 파일 지도

- `docs/moemoa/CURRENT_STRUCTURE_AND_FLOW.md`: 읽기 순서, 화면 지도, 데이터/동기화/운영 경계
- `docs/moemoa/reports/2026-10-07-live-flow-consolidation-audit.md`: 현재 화면 증거와 개선 후보, 공개 가능한 표현
- `CODEX_START_HERE.md`: 최신 스냅샷 링크
- 이 ExecPlan: 범위·검증·릴리스 절차

## 7. 데이터·스키마 마이그레이션

없다. `supabase/migrations/20261007093000_title_state_sync.sql`은 이전 릴리스의 이력으로만 설명한다.

## 8. 마일스톤

1. 코드·현재 운영·Git 상태 대조 및 문서 증거 확인.
2. 공개 가능한 최신 구조 문서 작성과 이전 감사 익명화.
3. 문서 차이·링크·빌드 확인 후 `master`에 커밋·push.
4. 원격 SHA, Vercel 배포, `/build-info.json`, 주요 운영 화면을 대조하고 링크를 전달.

## 9. 테스트와 검증

- `git diff --check`; 문서 안 경로 존재 검사; 비밀값·개인 계정 관찰값 검사.
- `npm run build`로 현재 소스가 빌드되는지 확인한다. 문서만 변경했더라도 Git 배포의 사전 확인이다.
- `gh run`/Vercel Git 배포 결과와 운영 `build-info.json`의 `commit`, `checkoutCommit`, `source`, `semanticMatch`를 확인한다.

## 10. 보안·개인정보·권리 영향

공개 저장소 문서에 계정 이메일, 개인 기록 내용, 이미지, 토큰을 싣지 않는다. 기존 권리/공개 설정은 변경하지 않는다.

## 11. 관찰 가능성·분석 이벤트

신규 이벤트 없음. 기존 `/build-info.json`과 Git/CI/Vercel 배포 상태를 릴리스 증거로 사용한다.

## 12. 롤백·복구

문서 전용 릴리스다. 필요한 경우 후속 Git revert로 문서를 되돌린다. DB와 사용자 데이터는 건드리지 않는다.

## 13. 위험과 완화

- 과거 문서의 ‘최신’ 표현을 현행 사실로 오독할 수 있으므로 새 문서를 시작 문서 맨 위에 연결하고 기준 날짜를 명시한다.
- docs-only Git push도 자동 배포를 유발한다. 실제 SHA가 바뀐 뒤 사이트가 새 커밋을 제공할 때까지 완료로 보고하지 않는다.
- 운영 앱의 로그인 데이터는 브라우저마다 다르므로 계정 수치를 구조 증거로 사용하지 않는다.

## 14. 필요한 사용자 결정

이번 요청에 Git 업데이트와 현재 운영 서비스의 소스 일치가 명시되어 있어 문서 전용 Git 배포는 승인 범위다. 추후 UI 통합 구현과 제품 명칭 변경은 이번 릴리스 범위 밖이다.

## 15. 진행 기록

- 2026-10-07: `master=origin/master=31fd31e`; 운영 build-info도 동일. 공개 저장소 확인. 문서화 시작.
- 2026-10-07: 현재 구조/흐름 문서를 작성하고 앞선 감사의 개인 계정 관찰 건수를 제거했다. `npm run build`에서 Astro 20개 경로 생성 성공. 기존 큰 JS chunk 경고만 표시됐다.

## 16. 발견 사항과 계획 변경

- 앞선 화면 감사에 로그인 계정의 작품/기록 개수가 들어 있었다. 공개 Git 반영 전에 이를 일반화한다.

## 17. 완료 보고

최종 Git 커밋·운영 배포 SHA와 검증 결과는 이번 작업의 사용자 보고에서 제공한다. 이 계획 파일에 자기 자신의 최종 SHA를 기록하지 않는다.
