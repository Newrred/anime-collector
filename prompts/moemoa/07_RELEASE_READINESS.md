# 출시 준비 검토 프롬프트

`docs/moemoa/07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`, `08_CODEX_PHASE_RUNBOOK.md`, 현재 release ExecPlan과 UGC gate checklist를 읽어라.

코드 변경보다 출시 증거를 검토하라.

- commit/version
- migrations and backup
- test matrix
- crash/error and performance
- activation events
- account/export/delete
- private image access
- public delete propagation
- report/block/appeal
- feature flags and kill switches
- moderator coverage/SLA
- allowed image types
- screenshot/fanart rights gates
- rollback rehearsal

결과를 GO, CONDITIONAL GO, NO-GO로 분류하고 차단 항목을 구체적으로 기록하라. 프로덕션 배포나 플래그 활성화는 사용자의 명시적 승인 없이는 실행하지 마라.
