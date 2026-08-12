# Codex 코드 리뷰 프롬프트

`AGENTS.md`, 관련 ExecPlan, `docs/moemoa/09_CHANGE_CONTROL_AND_REPORTING.md`와 변경 도메인 명세를 읽어라.

다음 우선순위로 review하라.

1. data loss, cross-account access, private/public exposure, security.
2. confirmed decision violation.
3. migration and rollback correctness.
4. offline/local-first and sync conflicts.
5. image rights state, report/takedown/delete propagation.
6. tests, logs, analytics privacy.
7. performance and maintainability.
8. style.

각 finding에 severity, file/line evidence, user impact, reproduction, recommended fix를 포함하라. 요약보다 findings를 먼저 제시하라. 문제가 없으면 어떤 영역과 테스트를 확인했는지 명시하라.
