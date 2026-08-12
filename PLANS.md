# MOEMOA ExecPlan 규격

> **문서 상태: `CURRENT`**
> 제품 결정은 `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`, 변경·보고 규칙은 `docs/moemoa/09_CHANGE_CONTROL_AND_REPORTING.md`, 복사용 형식은 `templates/moemoa/EXEC_PLAN_TEMPLATE.md`를 함께 사용한다.

## 1. 언제 ExecPlan이 필수인가

다음 중 하나라도 해당하면 Codex는 구현 전에 ExecPlan을 작성하거나 기존 계획을 갱신해야 한다.

- 여러 디렉터리 또는 5개 이상의 파일을 바꾸는 작업
- DB 스키마·데이터 마이그레이션
- 인증·동기화·이미지 수명주기 변경
- Web과 Android에 동시에 영향을 주는 기능
- 외부 데이터 수집·정규화 파이프라인
- 공개 UGC, 신고·차단·삭제·이의제기
- 새 프로덕션 의존성 또는 인프라 공급자 도입
- 기존 안정화 구조의 대규모 교체
- 출시·롤백·데이터 복구와 관련된 작업
- 하루 이상 또는 여러 작업 세션에 걸칠 가능성이 있는 작업

## 2. ExecPlan 원칙

- 계획은 저장소의 실제 파일 경로와 명령을 사용한다.
- 계획은 독립적으로 이해 가능해야 한다.
- 진행 중 발견한 사실과 결정 변경을 문서에 누적한다.
- 완료된 항목, 남은 항목, 차단 요인을 명시한다.
- 각 마일스톤은 눈으로 확인하거나 테스트로 증명할 수 있는 결과를 가져야 한다.
- 계획이 제품 결정을 변경하면 구현을 멈추고 Decision Log 승인부터 받는다.

## 3. 필수 섹션

```markdown
# <작업명> ExecPlan

## 1. 목적과 사용자 결과
## 2. 관련 확정 결정
## 3. 현재 상태와 저장소 증거
## 4. 범위
### 포함
### 제외
## 5. 아키텍처·데이터 흐름
## 6. 변경 파일 지도
## 7. 데이터·스키마 마이그레이션
## 8. 마일스톤
## 9. 테스트와 검증
## 10. 보안·개인정보·권리 영향
## 11. 관찰 가능성·분석 이벤트
## 12. 롤백·복구
## 13. 위험과 완화
## 14. 필요한 사용자 결정
## 15. 진행 기록
## 16. 발견 사항과 계획 변경
## 17. 완료 보고
```

## 4. 마일스톤 작성 규칙

나쁜 예:

```text
- 백엔드 구현
- 프론트 구현
- 테스트
```

좋은 예:

```text
Milestone 1 — LOCAL_ONLY 카드 저장
- Android Share Target에서 image/*를 수신한다.
- 사용자가 저장 전 작품과 이미지를 확인한다.
- 앱 전용 저장소에 복사하고 VisualAsset(storageScope=LOCAL_ONLY)을 생성한다.
- 네트워크가 없어도 MemoryCard와 Archive가 원자적으로 저장된다.
- 테스트: 공유 인텐트, 권한 거부, 파일 삭제, 중복 저장, 앱 재시작.
```

## 5. 계획 승인 게이트

다음 작업은 사용자 승인 전 실행하지 않는다.

- destructive migration
- production dependency replacement
- full-catalog ingestion
- production deployment
- public UGC enablement
- public screenshot/fanart enablement
- private image auto-upload
- deletion of legacy aliases/data

## 6. 진행 기록 형식

```text
[YYYY-MM-DD HH:MM] 완료: ...
[YYYY-MM-DD HH:MM] 발견: ...
[YYYY-MM-DD HH:MM] 변경: 원래 계획 ... → 새 계획 ... / 이유 ...
[YYYY-MM-DD HH:MM] 차단: 사용자 결정 필요 ...
```

## 7. 완료 보고 최소 요건

- 목표 달성 여부
- 실제 변경 파일
- 실행한 테스트와 결과
- 마이그레이션 결과와 롤백 확인
- 알려진 한계
- 남은 게이트
- 문서 업데이트 목록
