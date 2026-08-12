# Codex 최초 프롬프트 — 저장소 감사

이 저장소에서 MOEMOA 작업을 시작한다.

먼저 `AGENTS.md`, `CODEX_START_HERE.md`, `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`, `docs/moemoa/03_REPOSITORY_AUDIT_PROTOCOL.md`를 읽어라. 그 다음 저장소 루트와 기존 프로젝트 지침, README, package/build/test 설정을 확인하라.

이번 단계에서는 코드, lockfile, 설정, 데이터 파일을 수정하지 마라. 의존성을 설치·업그레이드하지 말고, DB migration이나 전체 formatter를 실행하지 마라. 안전한 read-only 명령과 이미 준비된 비파괴 검증만 사용하라.

다음을 증거 기반으로 감사하라.

1. Web, Android, backend, database, auth, local storage, sync 구조.
2. 현재 프레임워크와 재사용 가능한 코드.
3. AniList runtime search/detail/image dependency.
4. aliases/legacy data와 internal ID/provenance 상태.
5. 현재 log/library/tier/card/board 모델.
6. image intake, local file lifecycle, upload/public state.
7. analytics, crash/error logs, PII 위험.
8. unit/integration/E2E, CI/CD, build status.
9. 기존 문서의 2026-08-10 상태 메모와 현재 코드의 차이.
10. Web + Android, image-first Memory Card, Archive, Board, local-first account 모델을 구현하기 위한 Gap.

모든 핵심 주장에 파일 경로와 가능한 경우 line range 또는 code symbol을 포함하라. 확인되지 않은 사실은 UNKNOWN으로 표시하라.

다음 문서만 새로 작성하라.

- `docs/moemoa/reports/repository-audit.md`
- `docs/moemoa/reports/implementation-gap-analysis.md`
- `docs/moemoa/reports/architecture-options.md`
- `docs/moemoa/reports/open-decision-questions.md`

`architecture-options.md`에는 현재 스택을 최대한 재사용하는 안을 포함해 2~3개 옵션을 비교하라. 아직 권장안을 구현하지 마라.

마지막 응답에는 읽은 지침, 실행한 명령, 생성한 문서, 가장 큰 5개 Gap, 사용자 결정이 필요한 항목을 요약하라.
