# MOEMOA Codex 인수인계 패키지 설치 안내

> **문서 상태: `REFERENCE / DISTRIBUTION_GUIDE` — 2026-08-11**
> 이 저장소에는 패키지 설치와 최초 감사가 완료되어 있다. 현재 작업에서는 파일을 다시 복사하거나 audit prompt를 반복하지 말고 [`docs/moemoa/README.md`](docs/moemoa/README.md) → [`01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`](docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md) → [`reports/open-decision-questions.md`](docs/moemoa/reports/open-decision-questions.md) 순서로 읽는다. 아래 설치 절차는 새 clone이나 다른 저장소에 패키지를 배포할 때만 사용한다.

- 작성 기준일: 2026-08-11
- 목적: 현재 ChatGPT 세션을 프로젝트로 이동하지 못하더라도, 기존 MOEMOA 저장소에서 같은 제품 맥락과 작업 규칙을 유지하며 Codex 작업을 시작하게 한다.
- 권장 사용 방식: 이 패키지를 저장소에 복사한 뒤, Codex를 **저장소 루트**에서 시작한다.

## 1. 패키지에서 가장 중요한 파일

| 파일 | 역할 |
| --- | --- |
| `AGENTS.md` | Codex가 매 작업 전에 따라야 할 저장소 수준 규칙 |
| `CODEX_START_HERE.md` | 문서 지도, 작업별 필수 참조 문서, 최초 실행 순서 |
| `PLANS.md` | 여러 파일·마이그레이션·장기 작업에 사용할 ExecPlan 규격 |
| `docs/moemoa/README.md` | 전체 문서 상태, 우선순위, legacy·snapshot 분류 |
| `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | 확정 결정과 아직 Codex가 임의로 결정하면 안 되는 항목 |
| `docs/moemoa/08_CODEX_PHASE_RUNBOOK.md` | 단계별 작업·산출물·검수·승인 게이트 |
| `prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md` | Codex 첫 메시지로 사용할 복사·붙여넣기 프롬프트 |

## 2. 저장소에 복사하는 방법

### 저장소 루트에 `AGENTS.md`가 없는 경우

다음 파일과 폴더를 저장소 루트에 복사한다.

```text
AGENTS.md
CODEX_START_HERE.md
PLANS.md
docs/moemoa/
prompts/moemoa/
templates/moemoa/
```

### 저장소 루트에 기존 `AGENTS.md`가 있는 경우

기존 파일을 덮어쓰지 않는다.

1. 패키지의 `AGENTS.md`에서 `MOEMOA project instructions` 섹션을 기존 파일에 병합한다.
2. 기존 테스트·포맷·브랜치 규칙과 충돌하는 항목을 확인한다.
3. 충돌 시 기존 저장소의 실제 실행 규칙을 유지하되, 제품 결정과 안전 게이트는 삭제하지 않는다.
4. 병합 결과를 첫 Codex 감사 단계에서 보고하게 한다.

## 3. 새 저장소에서의 최초 실행 순서

1. Codex를 저장소 루트에서 연다.
2. `prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md` 내용을 첫 메시지로 전달한다.
3. 첫 단계에서는 코드 수정, 패키지 설치, 데이터 마이그레이션을 허용하지 않는다.
4. Codex가 작성한 다음 문서를 검토한다.
   - `docs/moemoa/reports/repository-audit.md`
   - `docs/moemoa/reports/implementation-gap-analysis.md`
   - `docs/moemoa/reports/architecture-options.md`
   - `docs/moemoa/reports/open-decision-questions.md`
5. 감사 결과를 승인한 뒤에만 `prompts/moemoa/02_ARCHITECTURE_AND_EXECPLAN.md`로 진행한다.

이 checkout의 최초 감사 결과는 2026-08-11 `master@e71f211` 기준으로 이미 `docs/moemoa/reports/`에 있다. 코드·인프라가 크게 바뀌지 않았다면 prompt 01을 다시 실행하지 않는다. 다음 단계인 prompt 02도 사용자가 `TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01` 검토 또는 architecture planning을 요청한 뒤에만 사용한다.

## 4. 문서를 저장소에 커밋하는 권장 방식

```text
docs/codex-handoff 또는 docs/moemoa 문서 추가
→ 별도 문서 커밋
→ 저장소 감사
→ 제품·기술 결정 갱신
→ 구현 브랜치 시작
```

권장 첫 커밋 메시지:

```text
docs: add MOEMOA Codex handoff and execution protocol
```

## 5. 이 패키지가 대체하지 않는 것

- 실제 저장소 감사
- 대상 국가의 법률 자문
- 외부 데이터 소스별 이용조건 검토
- 개인정보보호 영향평가
- 운영 인력과 예산 결정
- 프로덕션 배포 승인

이 문장을 적용할 범위를 구분한다.

- **이 checkout:** 2026-08-11 `master@e71f211` 감사가 완료되었다. 현재 구현 사실은 `docs/moemoa/reports/repository-audit.md`를 사용하고, code/config/migration이 크게 바뀌면 재검증한다.
- **새 저장소에 이 패키지를 설치하는 경우:** 포함된 역사 메모를 현재 사실로 사용하지 말고 prompt 01로 실제 저장소를 반드시 감사한다.
