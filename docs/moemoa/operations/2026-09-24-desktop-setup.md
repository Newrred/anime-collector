# Windows + Codex 새 PC 시작

사용자 승인: 별도 브랜치 없이 GitHub master로 개발본 이전(2026-09-24).

1. Git for Windows, Node.js 24.19.0, Codex 설치.
2. `git clone https://github.com/Newrred/anime-collector.git`
3. Codex에서 clone된 anime-collector 폴더 자체를 프로젝트로 열기.
4. `npm ci`, `npm run test:unit`, `npm run build` 실행. 브라우저 검사는 `npx playwright install chromium` 후 실행.
5. AGENTS.md, CODEX_START_HERE.md, docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md를 읽고 W09부터 재개.

기존 .env.production은 공개 catalog URL/anon key만 포함한다. Auth/서버 비밀 환경 파일과 개인 인증은 별도 설정한다. 로컬 사진과 브라우저 기록, 상위 workspace의 catalog canonical/checkpoint 및 원본 로그는 Git에 포함하지 않는다. 카탈로그 전체 재생성 전에는 관련 workspace를 별도로 옮겨야 한다.

Android SDK/JDK와 개인 Codex 스킬은 새 PC에서 확인한다. SQL 계약은 WSL/Ubuntu PostgreSQL14에서 tools/publication-boundary/run-local-postgres.sh로 검사한다. 실제 Supabase/Storage/Android 검증은 아직 미완료다.

다음 작업은 기존 갤러리를 유지한 W09 보드 미리보기·게시·방문자 UI 연결이다. Public 활성화와 운영 DB migration은 이번 이전에 포함하지 않는다.
